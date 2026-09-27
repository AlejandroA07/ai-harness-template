import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { runTool as defaultRunTool } from './windows-cli.mjs';

const plans = new WeakMap();
const expectedHooksPath = '.githooks';
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

function validateOwnership(value, { repository, active }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !equal(Object.keys(value).sort(), ['repositoryHooks'])) fail('Invalid full-profile control ownership');
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

function setRepositoryHooks(runTool, repository, desired) {
  const args = desired.present
    ? ['config', '--local', '--', 'core.hooksPath', desired.value]
    : ['config', '--local', '--unset', 'core.hooksPath'];
  const result = runTool('git', args, { cwd: repository });
  if (result.error || (desired.present ? result.status !== 0 : ![0, 5].includes(result.status))) {
    fail('Failed to update repository hook configuration');
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
  const { operation, target, previous = null, runTool = defaultRunTool, home = os.homedir() } = options;
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
  };
  if (previous) validateOwnership(previous, { repository, active });
  else if (operation !== 'apply' && active) conflicts.push('Full-profile machine-control ownership is missing');

  const ownership = previous ?? {
    repositoryHooks: active ? { applicable: true, repository, expected: expectedHooksPath,
      owned: current.repositoryHooks.value !== expectedHooksPath, prior: current.repositoryHooks } : { applicable: false },
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
  const plan = { version: 1, operation, active, tools: inspectedTools, ownership,
    changes, conflicts, applicable: conflicts.length === 0 };
  plans.set(plan, { repository, options: { operation, target, previous, runTool, home }, current });
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
  } catch (error) {
    if (completed.includes('repository-hooks')) {
      try { setRepositoryHooks(prepared.options.runTool, prepared.repository, prepared.current.repositoryHooks); } catch {}
    }
    throw new Error(`Machine-control application failed after: ${completed.join(', ') || 'none'}. ${error.message}`, { cause: error });
  }
  return { ...checked, applied: true, noOp: checked.changes.length === 0, completed };
}
