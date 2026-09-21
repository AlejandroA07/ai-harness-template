import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { loadCatalog } from './catalog-loader.mjs';
import { planInstallation, applyInstallation } from './selection-installation.mjs';
import { planGlobalInstallation, applyGlobalInstallation } from './global-installation.mjs';
import { assertSafeDirectory, isPathWithin } from './skill-lib.mjs';

const plans = new WeakMap();
const platforms = ['claude', 'codex'];
function fail(message) { throw new Error(message); }

async function canonicalTarget(input) {
  const unresolved = path.resolve(input);
  await assertSafeDirectory(unresolved, unresolved);
  return fs.realpath(unresolved).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await fs.realpath(path.dirname(unresolved)), path.basename(unresolved));
  });
}

async function visibleEntries(directory) {
  try {
    await assertSafeDirectory(path.dirname(directory), directory);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => !entry.name.startsWith('.') && (entry.isDirectory() || entry.isSymbolicLink()))
      .map((entry) => entry.name).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function customAgentConflicts(target) {
  const root = path.join(target, '.claude', 'agents');
  const rootInfo = await fs.lstat(root).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  if (!rootInfo) return [];
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) return ['Claude custom-agent root is not a real directory'];
  const found = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        found.push(path.relative(root, child));
      } else if (entry.isDirectory()) await walk(child);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) found.push(path.relative(root, child));
    }
  }
  await walk(root);
  return found.length ? [`Claude custom-agent discovery is not empty: ${found.join(', ')}`] : [];
}

function componentSummary(kind, plan) {
  return { kind, platform: plan.platform, applicable: plan.applicable, installed: plan.installed,
    changes: structuredClone(plan.changes), conflicts: [...plan.conflicts], migrated: structuredClone(plan.migrated ?? []) };
}

export async function planFullProfileInstallation(repository, options) {
  const { operation = 'apply', target: suppliedTarget, scope, platform, legacyRoot: suppliedLegacyRoot = null } = options;
  if (!['apply', 'audit'].includes(operation) || scope !== 'machine' || platform !== 'both'
    || typeof suppliedTarget !== 'string' || !path.isAbsolute(suppliedTarget) || /[\x00-\x1f]/.test(suppliedTarget)) {
    fail('Full managed profile requires plan/apply/audit, --platform both, --scope machine and an absolute --target');
  }
  if (suppliedLegacyRoot !== null && (operation !== 'apply' || typeof suppliedLegacyRoot !== 'string'
    || !path.isAbsolute(suppliedLegacyRoot) || /[\x00-\x1f]/.test(suppliedLegacyRoot))) {
    fail('Full-profile migration requires an absolute --legacy-root for apply');
  }
  const root = await fs.realpath(repository);
  const target = await canonicalTarget(suppliedTarget);
  const legacyRoot = suppliedLegacyRoot === null ? null : path.resolve(suppliedLegacyRoot);
  if (await isPathWithin(target, root)) fail('Full-profile target must be outside the source checkout');
  const catalog = await loadCatalog(root);
  const ids = catalog.capabilities.filter((entry) => ['skills', 'workflows'].includes(entry.module)
    && entry.scopes.includes('machine') && platforms.every((name) => entry.platforms.includes(name)))
    .map((entry) => entry.id).sort();
  if (!ids.length) fail('Full managed profile has no machine capabilities');

  const conflicts = await customAgentConflicts(target);
  const components = [];
  for (const name of platforms) {
    const discovery = path.join(target, name === 'codex' ? '.agents' : '.claude', 'skills');
    const extras = (await visibleEntries(discovery)).filter((entry) => !ids.includes(entry));
    if (extras.length) conflicts.push(`${name}: noncanonical visible skills require review: ${extras.join(', ')}`);
    const skillPlan = await planInstallation(root, { operation, ids: operation === 'apply' ? ids : [], platform: name,
      scope: 'machine', target, legacyRoot });
    components.push({ kind: 'skills', plan: skillPlan });
    conflicts.push(...skillPlan.conflicts.map((message) => `${name} skills: ${message}`));
    const globalPlan = await planGlobalInstallation(root, { operation, platform: name, scope: 'machine', target, legacyRoot });
    components.push({ kind: 'global-configuration', plan: globalPlan });
    conflicts.push(...globalPlan.conflicts.map((message) => `${name} global configuration: ${message}`));
  }
  const changes = components.flatMap(({ kind, plan }) => plan.changes.map((change) => ({ ...change, component: kind, platform: plan.platform })));
  const result = { version: 1, stage: 'full-profile-preflight', operation, target, platform: 'both', scope: 'machine',
    profile: 'full-managed', legacyRoot, selected: ids, exactInventory: true,
    installed: components.every(({ plan }) => plan.installed), components: components.map(({ kind, plan }) => componentSummary(kind, plan)),
    changes, conflicts, applicable: conflicts.length === 0,
    activation: 'Both platform configurations and the exact canonical skill inventory; hook trust remains interactive.' };
  plans.set(result, { root, options: { operation, target, platform: 'both', scope: 'machine', legacyRoot }, fingerprint: JSON.stringify(result) });
  return result;
}

export async function applyFullProfileInstallation(candidate) {
  const prepared = plans.get(candidate);
  if (!prepared) fail('Apply requires a fresh in-process full-profile plan');
  const checked = await planFullProfileInstallation(prepared.root, prepared.options);
  if (!checked.applicable) fail(`Full-profile conflicts: ${checked.conflicts.join('; ')}`);
  if (checked.operation === 'audit') fail('Audit is read-only');
  if (!equal(JSON.parse(prepared.fingerprint), checked)) fail('Full-profile preconditions changed; plan again');

  const completed = [];
  try {
    for (const name of platforms) {
      const skillPlan = await planInstallation(prepared.root, { operation: 'apply', ids: checked.selected,
        platform: name, scope: 'machine', target: checked.target, legacyRoot: checked.legacyRoot });
      await applyInstallation(skillPlan);
      completed.push(`${name} skills`);
      const globalPlan = await planGlobalInstallation(prepared.root, { operation: 'apply', platform: name,
        scope: 'machine', target: checked.target, legacyRoot: checked.legacyRoot });
      await applyGlobalInstallation(globalPlan);
      completed.push(`${name} global configuration`);
    }
  } catch (error) {
    throw new Error(`Full-profile application stopped; completed: ${completed.join(', ') || 'none'}; rerun the read-only plan after resolving the reported state. ${error.message}`, { cause: error });
  }
  const audit = await planFullProfileInstallation(prepared.root, { operation: 'audit', target: checked.target,
    platform: 'both', scope: 'machine' });
  if (!audit.applicable) fail(`Full-profile post-apply audit failed: ${audit.conflicts.join('; ')}`);
  return { ...audit, operation: 'apply', applied: true, noOp: checked.changes.length === 0, completed };
}
