import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { runTool as defaultRunTool } from './windows-cli.mjs';

const plans = new WeakMap();
const expectedHooksPath = '.githooks';
const memoryVariable = 'CLAUDE_CODE_DISABLE_AUTO_MEMORY';
const tools = [
  { id: 'node', command: process.execPath, args: ['--version'], required: true },
  { id: 'git', command: 'git', args: ['--version'], required: true },
  { id: 'gh', command: 'gh', args: ['--version'], required: true },
  { id: 'claude', command: 'claude', args: ['--version'], required: true },
  { id: 'codex', command: 'codex', args: ['--version'], required: true },
  { id: 'gitleaks', command: 'gitleaks', args: ['version'], required: true },
  { id: 'zizmor', command: 'zizmor', args: ['--version'], required: true },
  { id: 'dotnet', command: 'dotnet', args: ['--version'], required: false },
  { id: 'docker', command: 'docker', args: ['--version'], required: false },
];

function fail(message) { throw new Error(message); }
const state = (value) => value === null ? { present: false } : { present: true, value };

function validateState(value, label, allowed = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !equal(Object.keys(value).sort(), value.present === true ? ['present', 'value'] : ['present'])
    || typeof value.present !== 'boolean' || (value.present && (typeof value.value !== 'string'
      || /[\x00-\x1f]/.test(value.value) || value.value.length > 1024
      || (allowed && !allowed.includes(value.value))))) fail(`Invalid ${label} state`);
}

function validateOwnership(value, { repository, systemPlatform, active }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !equal(Object.keys(value).sort(), ['repositoryHooks', 'windowsMemoryLock'])) fail('Invalid full-profile control ownership');
  const hooks = value.repositoryHooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)
    || !equal(Object.keys(hooks).sort(), hooks.applicable
      ? ['applicable', 'expected', 'owned', 'prior', 'repository'] : ['applicable'])
    || hooks.applicable !== active) fail('Invalid repository-hook ownership');
  if (hooks.applicable) {
    if (hooks.repository !== repository || hooks.expected !== expectedHooksPath || typeof hooks.owned !== 'boolean') {
      fail('Repository-hook ownership does not match this checkout');
    }
    validateState(hooks.prior, 'prior repository hook');
  }
  const memory = value.windowsMemoryLock;
  const memoryApplicable = active && systemPlatform === 'win32';
  if (!memory || typeof memory !== 'object' || Array.isArray(memory)
    || !equal(Object.keys(memory).sort(), memory.applicable
      ? ['applicable', 'expected', 'owned', 'prior', 'variable'] : ['applicable'])
    || memory.applicable !== memoryApplicable) fail('Invalid Windows memory-lock ownership');
  if (memory.applicable) {
    if (memory.variable !== memoryVariable || memory.expected !== '1' || typeof memory.owned !== 'boolean') {
      fail('Windows memory-lock ownership does not match the managed control');
    }
    validateState(memory.prior, 'prior Windows memory lock', ['0', '1']);
  }
}

function resultState(result, label) {
  if (result.error || ![0, 1].includes(result.status)) fail(`Unable to inspect ${label}`);
  if (result.status === 1) return state(null);
  const value = (result.stdout ?? '').trim();
  if (!value || /[\x00-\x1f]/.test(value) || value.length > 1024) fail(`Invalid ${label} value`);
  return state(value);
}

function inspectRepositoryHooks(runTool, repository) {
  return resultState(runTool('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: repository }), 'repository hook');
}

function inspectWindowsMemory(runTool) {
  const result = runTool('reg.exe', ['query', 'HKCU\\Environment', '/v', memoryVariable]);
  if (result.error || ![0, 1].includes(result.status)) fail('Unable to inspect Windows memory lock');
  if (result.status === 1) return state(null);
  const line = (result.stdout ?? '').split(/\r?\n/).find((entry) => entry.trim().startsWith(memoryVariable));
  const match = line?.match(/^\s*CLAUDE_CODE_DISABLE_AUTO_MEMORY\s+REG_(?:SZ|EXPAND_SZ)\s+([^\s]+)\s*$/);
  if (!match || !['0', '1'].includes(match[1])) fail('Invalid Windows memory lock value');
  return state(match[1]);
}

function setRepositoryHooks(runTool, repository, desired) {
  const args = desired.present
    ? ['config', '--local', '--', 'core.hooksPath', desired.value]
    : ['config', '--local', '--unset', 'core.hooksPath'];
  const result = runTool('git', args, { cwd: repository });
  if (result.error || (desired.present ? result.status !== 0 : ![0, 5].includes(result.status))) {
    fail('Failed to update repository hook configuration');
  }
}

function setWindowsMemory(runTool, desired) {
  const result = desired.present
    ? runTool('setx', [memoryVariable, desired.value])
    : runTool('reg.exe', ['delete', 'HKCU\\Environment', '/v', memoryVariable, '/f']);
  if (result.error || (desired.present ? result.status !== 0 : ![0, 1].includes(result.status))) {
    fail('Failed to update Windows memory lock');
  }
}

async function sameHome(target, suppliedHome) {
  const canonicalTarget = await fs.realpath(target).catch(() => path.resolve(target));
  const home = await fs.realpath(suppliedHome).catch(() => path.resolve(suppliedHome));
  return process.platform === 'win32'
    ? path.resolve(canonicalTarget).toLowerCase() === path.resolve(home).toLowerCase()
    : path.resolve(canonicalTarget) === path.resolve(home);
}

export async function planFullProfileControls(repository, options = {}) {
  const { operation, target, previous = null, runTool = defaultRunTool,
    systemPlatform = process.platform, home = os.homedir() } = options;
  if (!['apply', 'audit', 'remove'].includes(operation)) fail('Invalid full-profile control operation');
  const active = await sameHome(target, home);
  const inspectedTools = operation === 'remove' ? [] : tools.map(({ id, command, args, required }) => {
    const result = runTool(command, args, { cwd: repository });
    return { id, required, available: !result.error && result.status === 0 };
  });
  const conflicts = inspectedTools.filter((tool) => tool.required && !tool.available)
    .map((tool) => `Required tool is unavailable: ${tool.id}`);
  const current = {
    repositoryHooks: active ? inspectRepositoryHooks(runTool, repository) : null,
    windowsMemoryLock: active && systemPlatform === 'win32' ? inspectWindowsMemory(runTool) : null,
  };
  if (previous) validateOwnership(previous, { repository, systemPlatform, active });
  else if (operation !== 'apply' && active) conflicts.push('Full-profile machine-control ownership is missing');

  const ownership = previous ?? {
    repositoryHooks: active ? { applicable: true, repository, expected: expectedHooksPath,
      owned: current.repositoryHooks.value !== expectedHooksPath, prior: current.repositoryHooks } : { applicable: false },
    windowsMemoryLock: active && systemPlatform === 'win32' ? { applicable: true, variable: memoryVariable, expected: '1',
      owned: current.windowsMemoryLock.value !== '1', prior: current.windowsMemoryLock } : { applicable: false },
  };
  const changes = [];
  if (ownership.repositoryHooks.applicable) {
    const desired = operation === 'remove' && ownership.repositoryHooks.owned
      ? ownership.repositoryHooks.prior : state(expectedHooksPath);
    if (!equal(current.repositoryHooks, desired)) changes.push({ id: 'repository-hooks', action: operation === 'remove' ? 'restore' : 'activate' });
    if (previous && !equal(current.repositoryHooks, state(expectedHooksPath))) {
      conflicts.push('Repository hook configuration changed after full-profile ownership');
    }
  }
  if (ownership.windowsMemoryLock.applicable) {
    const desired = operation === 'remove' && ownership.windowsMemoryLock.owned
      ? ownership.windowsMemoryLock.prior : state('1');
    if (!equal(current.windowsMemoryLock, desired)) changes.push({ id: 'windows-memory-lock', action: operation === 'remove' ? 'restore' : 'activate' });
    if (previous && !equal(current.windowsMemoryLock, state('1'))) {
      conflicts.push('Windows memory lock changed after full-profile ownership');
    }
  }
  const plan = { version: 1, operation, active, tools: inspectedTools, ownership,
    changes, conflicts, applicable: conflicts.length === 0 };
  plans.set(plan, { repository, options: { operation, target, previous, runTool, systemPlatform, home }, current });
  return plan;
}

export async function applyFullProfileControls(candidate) {
  const prepared = plans.get(candidate);
  if (!prepared) fail('Apply requires a fresh in-process machine-control plan');
  const checked = await planFullProfileControls(prepared.repository, prepared.options);
  if (!checked.applicable) fail(`Machine-control conflicts: ${checked.conflicts.join('; ')}`);
  if (checked.operation === 'audit') fail('Audit is read-only');
  if (!equal(checked, candidate)) fail('Machine-control preconditions changed; plan again');
  const completed = [];
  try {
    if (checked.ownership.repositoryHooks.applicable && checked.changes.some(({ id }) => id === 'repository-hooks')) {
      const desired = checked.operation === 'remove' && checked.ownership.repositoryHooks.owned
        ? checked.ownership.repositoryHooks.prior : state(expectedHooksPath);
      setRepositoryHooks(prepared.options.runTool, prepared.repository, desired);
      completed.push('repository-hooks');
    }
    if (checked.ownership.windowsMemoryLock.applicable && checked.changes.some(({ id }) => id === 'windows-memory-lock')) {
      const desired = checked.operation === 'remove' && checked.ownership.windowsMemoryLock.owned
        ? checked.ownership.windowsMemoryLock.prior : state('1');
      setWindowsMemory(prepared.options.runTool, desired);
      completed.push('windows-memory-lock');
    }
  } catch (error) {
    if (completed.includes('repository-hooks')) {
      try { setRepositoryHooks(prepared.options.runTool, prepared.repository, prepared.current.repositoryHooks); } catch {}
    }
    throw new Error(`Machine-control application failed after: ${completed.join(', ') || 'none'}. ${error.message}`, { cause: error });
  }
  return { ...checked, applied: true, noOp: checked.changes.length === 0, completed };
}
