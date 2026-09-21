import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { loadCatalog } from './catalog-loader.mjs';
import { planInstallation, applyInstallation } from './selection-installation.mjs';
import { planGlobalInstallation, applyGlobalInstallation } from './global-installation.mjs';
import { planFullProfileControls, applyFullProfileControls } from './full-profile-controls.mjs';
import { assertSafeDirectory, isPathWithin, isAbsolutePathInput } from './skill-lib.mjs';
import { acquireTargetLock, encode, publishFiles, readRegular, releaseTargetLock, stat } from './installation-core.mjs';
import { ownershipHeadBytes, planReceiptEvidence, sealReceipt, storeReceiptEvidence,
  verifyOwnershipHead, verifyReceiptEvidence } from './installation-evidence.mjs';

const plans = new WeakMap();
const platforms = ['claude', 'codex'];
function fail(message) { throw new Error(message); }
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function profileLocations(target) {
  const store = path.join(target, '.ai-harness', 'installations', 'full-managed');
  return { store, receipt: path.join(store, 'receipt.json'), ownership: path.join(store, 'current.json'),
    lock: path.join(target, '.ai-harness-install.lock') };
}

function validateProfileReceipt(receipt, target) {
  const fields = ['version', 'evidence', 'target', 'platform', 'scope', 'profile', 'selected', 'components', 'controls'];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || !same(Object.keys(receipt).sort(), fields.sort()) || receipt.version !== 2 || receipt.target !== target
    || receipt.platform !== 'both' || receipt.scope !== 'machine' || receipt.profile !== 'full-managed'
    || !Array.isArray(receipt.selected) || !same(receipt.selected, [...new Set(receipt.selected)].sort())
    || receipt.selected.some((id) => typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id))
    || !Array.isArray(receipt.components) || receipt.components.length !== 4
    || !receipt.controls || typeof receipt.controls !== 'object' || Array.isArray(receipt.controls)) fail('Malformed full-profile receipt');
  for (const component of receipt.components) {
    if (!component || typeof component !== 'object' || Array.isArray(component)
      || !same(Object.keys(component).sort(), ['evidence', 'kind', 'platform'])
      || !['skills', 'global-configuration'].includes(component.kind)
      || !platforms.includes(component.platform) || typeof component.evidence !== 'string'
      || !/^[a-f0-9]{64}$/.test(component.evidence)) fail('Malformed full-profile component ownership');
  }
  const identities = receipt.components.map(({ kind, platform }) => `${platform}:${kind}`).sort();
  if (!same(identities, platforms.flatMap((name) => [`${name}:global-configuration`, `${name}:skills`]).sort())) {
    fail('Malformed full-profile component inventory');
  }
}

async function loadProfileReceipt(target) {
  const locations = profileLocations(target);
  if (!await stat(locations.receipt)) {
    await verifyOwnershipHead(target, locations.ownership, null);
    return { locations, receipt: null, bytes: null };
  }
  const bytes = await readRegular(locations.receipt);
  let receipt;
  try { receipt = JSON.parse(bytes); } catch { fail('Malformed full-profile receipt'); }
  validateProfileReceipt(receipt, target);
  await verifyReceiptEvidence(target, locations.store, receipt);
  await verifyOwnershipHead(target, locations.ownership, receipt.evidence);
  return { locations, receipt, bytes };
}

function componentOwnership(components, evidenceKey) {
  return components.map(({ kind, plan }) => ({ kind, platform: plan.platform, evidence: plan[evidenceKey] }))
    .sort((left, right) => `${left.platform}:${left.kind}`.localeCompare(`${right.platform}:${right.kind}`));
}

async function publishProfileReceipt(target, previous, nextReceipt) {
  const { locations } = await loadProfileReceipt(target);
  await fs.mkdir(target).catch((error) => { if (error.code !== 'EEXIST') throw error; });
  const lock = await acquireTargetLock(target);
  let staging, retain = false;
  try {
    const current = await loadProfileReceipt(target);
    if (!same(current.receipt, previous.receipt)) fail('Full-profile receipt changed before publication');
    await fs.mkdir(locations.store, { recursive: true, mode: 0o700 });
    staging = await fs.mkdtemp(path.join(locations.store, '.stage-'));
    if (nextReceipt) await storeReceiptEvidence(target, locations.store, staging, nextReceipt);
    await publishFiles({ target, staging, operations: [
      { id: 'ownership', file: locations.ownership,
        before: previous.receipt ? ownershipHeadBytes(previous.receipt.evidence) : null,
        after: nextReceipt ? ownershipHeadBytes(nextReceipt.evidence) : null },
      { id: 'receipt', file: locations.receipt, before: previous.bytes,
        after: nextReceipt ? Buffer.from(encode(nextReceipt)) : null, receipt: true },
    ], journal: { version: 1, previousReceipt: previous.receipt, nextReceipt,
      changes: ['ownership', 'receipt'] } });
  } catch (error) {
    retain = Boolean(error.recoveryRequired);
    throw error;
  } finally {
    if (!retain) {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
      await releaseTargetLock(lock);
    }
  }
}

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
  if (!['apply', 'audit', 'remove'].includes(operation) || scope !== 'machine' || platform !== 'both'
    || typeof suppliedTarget !== 'string' || !path.isAbsolute(suppliedTarget) || /[\x00-\x1f]/.test(suppliedTarget)) {
    fail('Full managed profile requires plan/apply/audit/remove, --platform both, --scope machine and an absolute --target');
  }
  if (suppliedLegacyRoot !== null && (operation !== 'apply' || !isAbsolutePathInput(suppliedLegacyRoot))) {
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

  const previousProfile = await loadProfileReceipt(target);
  const conflicts = operation === 'remove' ? [] : await customAgentConflicts(target);
  const controlsPlan = await planFullProfileControls(root, { operation, target,
    previous: previousProfile.receipt?.controls ?? null });
  conflicts.push(...controlsPlan.conflicts.map((message) => `machine controls: ${message}`));
  const components = [];
  for (const name of platforms) {
    const discovery = path.join(target, name === 'codex' ? '.agents' : '.claude', 'skills');
    const extras = operation === 'remove' ? [] : (await visibleEntries(discovery)).filter((entry) => !ids.includes(entry));
    if (extras.length) conflicts.push(`${name}: noncanonical visible skills require review: ${extras.join(', ')}`);
    const skillPlan = await planInstallation(root, { operation, ids: operation === 'audit' ? [] : ids, platform: name,
      scope: 'machine', target, legacyRoot });
    components.push({ kind: 'skills', plan: skillPlan });
    conflicts.push(...skillPlan.conflicts.map((message) => `${name} skills: ${message}`));
    const globalPlan = await planGlobalInstallation(root, { operation, platform: name, scope: 'machine', target, legacyRoot });
    components.push({ kind: 'global-configuration', plan: globalPlan });
    conflicts.push(...globalPlan.conflicts.map((message) => `${name} global configuration: ${message}`));
  }
  const currentComponents = componentOwnership(components, 'currentReceiptEvidence');
  const plannedComponents = componentOwnership(components, operation === 'apply' ? 'plannedReceiptEvidence' : 'currentReceiptEvidence');
  for (const component of operation === 'remove' ? [] : components.filter(({ kind }) => kind === 'skills')) {
    if (!same(component.plan.selected, ids) || !same(component.plan.entries.map((entry) => entry.id).sort(), ids)) {
      conflicts.push(`${component.plan.platform} skills: installed selection is not the exact full-profile inventory`);
    }
  }
  if (operation !== 'apply' && !previousProfile.receipt) conflicts.push('Full-profile receipt is missing');
  if (previousProfile.receipt) {
    if (!same(previousProfile.receipt.selected, ids)) conflicts.push('Full-profile receipt selection does not match the canonical inventory');
    if (!same(previousProfile.receipt.components, currentComponents)) conflicts.push('Full-profile component ownership changed');
  }
  const nextReceipt = operation === 'apply' ? sealReceipt({ version: 2, target, platform: 'both', scope: 'machine',
    profile: 'full-managed', selected: ids, components: plannedComponents, controls: controlsPlan.ownership }) : previousProfile.receipt;
  const receiptChanged = operation === 'remove' ? previousProfile.receipt !== null
    : operation === 'apply' && !same(previousProfile.receipt, nextReceipt);
  const evidence = operation === 'apply' && receiptChanged
    ? await planReceiptEvidence(target, previousProfile.locations.store, nextReceipt) : null;
  const changes = components.flatMap(({ kind, plan }) => plan.changes.map((change) => ({ ...change, component: kind, platform: plan.platform })));
  changes.push(...controlsPlan.changes.map((change) => ({ ...change, component: 'machine-controls', platform: 'both' })));
  if (receiptChanged) changes.push({ id: 'full-profile-receipt', path: previousProfile.locations.receipt,
    action: operation === 'remove' ? 'remove' : previousProfile.receipt ? 'update' : 'create', component: 'profile', platform: 'both' });
  const result = { version: 1, stage: 'full-profile-preflight', operation, target, platform: 'both', scope: 'machine',
    profile: 'full-managed', legacyRoot, selected: ids, exactInventory: true,
    installed: previousProfile.receipt !== null && components.every(({ plan }) => plan.installed)
      && same(previousProfile.receipt.selected, ids) && same(previousProfile.receipt.components, currentComponents),
    components: components.map(({ kind, plan }) => componentSummary(kind, plan)),
    controls: structuredClone(controlsPlan), changes, receiptChanged, receiptPath: previousProfile.locations.receipt,
    evidence, conflicts, applicable: conflicts.length === 0,
    activation: controlsPlan.active
      ? 'Both platform configurations, the exact canonical skill inventory, repository hooks and the Windows memory lock where applicable; hook trust remains interactive.'
      : 'Both platform configurations and the exact canonical skill inventory; live machine controls are reported but not changed for an isolated target.' };
  plans.set(result, { root, options: { operation, target, platform: 'both', scope: 'machine', legacyRoot },
    previousProfile, nextReceipt, controlsPlan, fingerprint: JSON.stringify(result) });
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
  let controlsApplied = false;
  try {
    for (const name of checked.operation === 'remove' ? [...platforms].reverse() : platforms) {
      if (checked.operation === 'remove') {
        const globalPlan = await planGlobalInstallation(prepared.root, { operation: 'remove', platform: name,
          scope: 'machine', target: checked.target });
        await applyGlobalInstallation(globalPlan);
        completed.push(`${name} global configuration`);
      }
      const skillPlan = await planInstallation(prepared.root, { operation: checked.operation, ids: checked.selected,
        platform: name, scope: 'machine', target: checked.target, legacyRoot: checked.legacyRoot });
      await applyInstallation(skillPlan);
      completed.push(`${name} skills`);
      if (checked.operation === 'apply') {
        const globalPlan = await planGlobalInstallation(prepared.root, { operation: 'apply', platform: name,
          scope: 'machine', target: checked.target, legacyRoot: checked.legacyRoot });
        await applyGlobalInstallation(globalPlan);
        completed.push(`${name} global configuration`);
      }
    }
    await applyFullProfileControls(prepared.controlsPlan);
    controlsApplied = true;
    completed.push('machine controls');
    await publishProfileReceipt(checked.target, prepared.previousProfile,
      checked.operation === 'remove' ? null : prepared.nextReceipt);
    completed.push('full-profile receipt');
  } catch (error) {
    if (controlsApplied && checked.operation === 'apply' && !prepared.previousProfile.receipt) {
      try {
        const rollback = await planFullProfileControls(prepared.root, { operation: 'remove', target: checked.target,
          previous: prepared.controlsPlan.ownership });
        await applyFullProfileControls(rollback);
      } catch {
        completed.push('machine controls require reviewed recovery');
      }
    }
    throw new Error(`Full-profile application stopped; completed: ${completed.join(', ') || 'none'}; rerun the read-only plan after resolving the reported state. ${error.message}`, { cause: error });
  }
  if (checked.operation === 'remove') return { ...checked, installed: false, applied: true,
    noOp: checked.changes.length === 0 && !checked.receiptChanged, completed };
  const audit = await planFullProfileInstallation(prepared.root, { operation: 'audit', target: checked.target,
    platform: 'both', scope: 'machine' });
  if (!audit.applicable) fail(`Full-profile post-apply audit failed: ${audit.conflicts.join('; ')}`);
  return { ...audit, operation: 'apply', applied: true, noOp: checked.changes.length === 0 && !checked.receiptChanged, completed };
}
