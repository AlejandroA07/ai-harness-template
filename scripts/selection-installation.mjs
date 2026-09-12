import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadCatalog } from './catalog-loader.mjs';
import { planSelection } from './module-catalog.mjs';
import { assertSafeDirectory, parseSkill, renderSkillDocuments, isPathWithin } from './skill-lib.mjs';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = (message) => { throw new Error(message); };
const receipts = new WeakMap();
async function stat(file) {
  try { return await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function readRegular(file) {
  const info = await stat(file);
  if (!info?.isFile() || info.isSymbolicLink() || info.nlink !== 1) fail('Expected an unlinked regular file');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== info.ino || opened.dev !== info.dev) fail('File changed while opening');
    return await handle.readFile();
  } finally { await handle.close(); }
}
async function linkState(file) {
  const info = await stat(file);
  if (!info) return null;
  if (!info.isSymbolicLink()) return { collision: true };
  return { link: path.resolve(path.dirname(file), await fs.readlink(file)) };
}
function fields(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !same(Object.keys(value).sort(), [...keys].sort())) fail('Malformed installation receipt');
}
function ids(value, known) {
  if (!Array.isArray(value) || value.some((id) => !known.has(id))
    || !same(value, [...new Set(value)].sort())) fail('Invalid receipt selection');
}
function payloadHash(files) {
  return digest(encode(Object.keys(files).sort().map((name) => [name, digest(files[name])])));
}
async function treeFiles(directory, prefix = '') {
  await assertSafeDirectory(directory, directory);
  const files = {};
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix + entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await treeFiles(file, relative + '/');
      if (!Object.keys(nested).length) fail('Unexpected empty payload directory');
      Object.assign(files, nested);
    } else files[relative] = await readRegular(file);
  }
  return files;
}
function selection(catalog, requested, platform) {
  if (!requested.length) return { requested: [], capabilities: [] };
  const plan = planSelection(catalog, { ids: requested, modules: [], platforms: [platform], scope: 'machine' });
  if (plan.capabilities.some((entry) => entry.module !== 'skills')) fail('M2 installs machine-scoped Skills only; workflows remain M5');
  return plan;
}
function layout(target, platform) {
  const store = path.join(target, '.ai-harness', 'installations', platform);
  return { store, payloads: path.join(store, 'payloads'), receipt: path.join(store, 'receipt.json'),
    discovery: path.join(target, platform === 'codex' ? '.agents' : '.claude', 'skills'),
    lock: path.join(target, '.ai-harness-install.lock') };
}
async function safeLayout(target, locations) {
  await assertSafeDirectory(target, target);
  await assertSafeDirectory(target, locations.payloads);
  await assertSafeDirectory(target, locations.discovery);
}
function payloadPath(locations, entry) { return path.join(locations.payloads, entry.id, entry.hash); }
async function loadReceipt(locations, target, platform, catalog) {
  if (!await stat(locations.receipt)) return { receipt: null, bytes: null };
  const bytes = await readRegular(locations.receipt);
  let receipt;
  try { receipt = JSON.parse(bytes); } catch { fail('Malformed installation receipt'); }
  fields(receipt, ['version', 'target', 'platform', 'scope', 'profile', 'selected', 'entries']);
  if (receipt.version !== 1 || receipt.target !== target || receipt.platform !== platform
    || receipt.scope !== 'machine' || receipt.profile !== 'coexistence') fail('Receipt target/profile mismatch');
  const known = new Set(catalog.capabilities.filter((entry) => entry.module === 'skills').map((entry) => entry.id));
  ids(receipt.selected, known);
  if (!Array.isArray(receipt.entries)) fail('Malformed receipt entries');
  const entryIds = [];
  for (const entry of receipt.entries) {
    fields(entry, ['id', 'hash', 'consumers']);
    if (!known.has(entry.id) || !/^[a-f0-9]{64}$/.test(entry.hash)) fail('Unsafe receipt entry');
    ids(entry.consumers, new Set(receipt.selected));
    if (!entry.consumers.length) fail('Receipt entry has no consumer');
    entryIds.push(entry.id);
  }
  ids(entryIds, known);
  // Historical dependencies may differ from today's catalog. Consumers must still
  // cover every explicit selection; paths are always derived, never trusted input.
  for (const id of receipt.selected) {
    if (!receipt.entries.some((entry) => entry.id === id && entry.consumers.includes(id))) fail('Incomplete receipt');
  }
  return { receipt, bytes: bytes.toString('utf8') };
}
async function renderPayload(root, capability, platform) {
  const source = path.join(root, capability.source);
  await assertSafeDirectory(root, path.dirname(source));
  const skill = parseSkill((await readRegular(source)).toString('utf8'), source);
  const files = Object.fromEntries(Object.entries(renderSkillDocuments(skill, platform,
    capability.activation.mode === 'user-only')).map(([name, value]) => [name, Buffer.from(value)]));
  for (const resource of capability.resources) {
    const relative = path.posix.relative(path.posix.dirname(capability.source), resource);
    // Match the established platform renderer's resource policy.
    if (relative === 'README.md' || relative.startsWith('agents/')) continue;
    await assertSafeDirectory(root, path.dirname(path.join(root, resource)));
    files[relative] = await readRegular(path.join(root, resource));
  }
  return { files, hash: payloadHash(files) };
}
async function parentIdentity(target, locations) {
  const paths = new Set();
  for (const end of [locations.payloads, locations.discovery]) {
    let current = end;
    while (true) {
      paths.add(current);
      if (current === target) break;
      current = path.dirname(current);
    }
  }
  const result = {};
  for (const file of [...paths].sort()) {
    const info = await stat(file);
    result[file] = info ? [info.dev, info.ino, info.mode] : null;
  }
  return result;
}

// Plans are read-only. Only an in-process plan can be applied, and it is rebuilt
// under the target lock; serialized JSON is never accepted as write authority.
export async function planInstallation(root, options) {
  const { operation = 'apply', platform, scope, ids: requested = [], target: suppliedTarget } = options;
  if (!['apply', 'remove', 'audit'].includes(operation) || !['claude', 'codex'].includes(platform)
    || scope !== 'machine' || typeof suppliedTarget !== 'string' || !path.isAbsolute(suppliedTarget)) {
    fail('Lifecycle requires an absolute --target, one --platform and --scope machine');
  }
  if (operation !== 'audit' && !requested.length) fail('Select at least one skill');
  if (operation === 'audit' && requested.length) fail('Audit inspects the whole platform receipt; omit --select');
  const unresolved = path.resolve(suppliedTarget);
  await assertSafeDirectory(unresolved, unresolved);
  // Canonicalize OS aliases above the explicit target, but reject a linked target.
  const target = await fs.realpath(unresolved).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await fs.realpath(path.dirname(unresolved)), path.basename(unresolved));
  });
  if (await isPathWithin(target, root)) fail('Installation target must be outside the source checkout');
  const catalog = await loadCatalog(root);
  if (requested.length) selection(catalog, requested, platform);
  const locations = layout(target, platform);
  for (const ownedRoot of [locations.store, locations.discovery, locations.lock]) {
    if (await isPathWithin(root, ownedRoot)) fail('Installation paths overlap the source checkout');
  }
  await safeLayout(target, locations);
  const old = await loadReceipt(locations, target, platform, catalog);
  const previous = old.receipt?.entries ?? [];
  const conflicts = [];
  if (await stat(locations.lock)) conflicts.push('Target is locked; inspect the interrupted/running operation before retrying');
  const states = {};
  const ownedHashes = {};
  for (const entry of previous) {
    const discovery = path.join(locations.discovery, entry.id);
    states[entry.id] = await linkState(discovery);
    const expected = payloadPath(locations, entry);
    if (!same(states[entry.id], { link: expected })) conflicts.push(`${entry.id}: owned discovery is missing or changed`);
    try {
      await assertSafeDirectory(target, expected);
      ownedHashes[entry.id] = payloadHash(await treeFiles(expected));
      if (ownedHashes[entry.id] !== entry.hash) conflicts.push(`${entry.id}: owned payload was edited`);
    } catch { conflicts.push(`${entry.id}: owned payload is missing or unsafe`); }
  }
  const selected = new Set(old.receipt?.selected ?? []);
  if (operation === 'apply') requested.forEach((id) => selected.add(id));
  if (operation === 'remove') requested.forEach((id) => selected.delete(id));
  const nextSelected = [...selected].sort();
  const desired = new Map();
  if (operation === 'apply') {
    // Update only the requested closures. Other selections keep their installed
    // revisions and remain independent of source generation or source drift.
    for (const entry of previous) {
      const consumers = entry.consumers.filter((id) => !requested.includes(id));
      if (consumers.length) desired.set(entry.id, { ...entry, consumers });
    }
    for (const consumer of [...requested].sort()) {
      for (const capability of selection(catalog, [consumer], platform).capabilities) {
        const rendered = await renderPayload(root, capability, platform);
        const existing = desired.get(capability.id);
        const consumers = [...new Set([...(existing?.consumers ?? []), consumer])].sort();
        desired.set(capability.id, { id: capability.id, hash: rendered.hash, consumers, files: rendered.files });
      }
    }
  } else {
    for (const entry of previous) {
      const consumers = entry.consumers.filter((id) => selected.has(id));
      if (consumers.length) desired.set(entry.id, { ...entry, consumers });
    }
  }
  const entries = [...desired.values()].sort((a, b) => a.id.localeCompare(b.id));
  const nextReceipt = { version: 1, target, platform, scope: 'machine', profile: 'coexistence', selected: nextSelected,
    entries: entries.map(({ id, hash, consumers }) => ({ id, hash, consumers })) };
  const changes = [];
  for (const id of [...new Set([...previous.map((entry) => entry.id), ...desired.keys()])].sort()) {
    const before = previous.find((entry) => entry.id === id);
    const after = desired.get(id);
    const discovery = path.join(locations.discovery, id);
    if (!Object.hasOwn(states, id)) states[id] = await linkState(discovery);
    const names = await fs.readdir(locations.discovery).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
    if (!before && (states[id] || names.some((name) => name.toLowerCase() === id.toLowerCase()))) conflicts.push(`${id}: unowned discovery collision (legacy adoption requires review)`);
    if (after?.files) {
      const payload = payloadPath(locations, after);
      await assertSafeDirectory(target, payload);
      if (await stat(payload)) {
        if (payloadHash(await treeFiles(payload)) !== after.hash) conflicts.push(`${id}: payload store collision`);
      }
    }
    if (before?.hash !== after?.hash) changes.push({ id, action: !after ? 'remove' : before ? 'update' : 'install',
      discovery, from: before ? payloadPath(locations, before) : null, to: after ? payloadPath(locations, after) : null });
  }
  const receiptChanged = operation !== 'audit' && !same(old.receipt, nextReceipt)
    && (old.receipt !== null || entries.length > 0);
  const plan = { version: 1, stage: 'target-preflight', operation, target, platform, scope, profile: 'coexistence',
    installed: old.receipt !== null && previous.length > 0,
    selected: [...nextSelected], entries: structuredClone(nextReceipt.entries), changes: operation === 'audit' ? [] : changes,
    receiptChanged, receiptPath: locations.receipt, conflicts, applicable: conflicts.length === 0, tools: [],
    activation: 'Discovery only; no hooks, settings, processes or network activation',
    retainedPayloads: 'Immutable payload revisions are retained on update/removal; no recursive garbage collection' };
  receipts.set(plan, { root, options: { ...options, ids: [...requested], target }, locations, old, nextReceipt, entries,
    fingerprint: encode({ old, states, ownedHashes, plan, parents: await parentIdentity(target, locations) }) });
  return plan;
}

export async function applyInstallation(candidate, { checkpoint = async () => {} } = {}) {
  const prepared = receipts.get(candidate);
  if (!prepared) fail('Apply requires a fresh in-process installation plan');
  const { root, options, locations } = prepared;
  const plan = await planInstallation(root, options);
  if (!plan.applicable) fail(`Installation conflicts: ${plan.conflicts.join('; ')}`);
  if (plan.operation === 'audit') fail('Audit is read-only');
  if (receipts.get(plan).fingerprint !== prepared.fingerprint) fail('Installation preconditions changed; plan again');
  if (!plan.changes.length && !plan.receiptChanged) return { ...plan, applied: true, noOp: true };
  await fs.mkdir(plan.target, { recursive: false }).catch((error) => { if (error.code !== 'EEXIST') throw error; });
  await assertSafeDirectory(plan.target, plan.target);
  await fs.mkdir(locations.lock, { mode: 0o700 }).catch(() => fail('Target is locked; no changes applied'));
  let staging;
  const completed = [];
  let publishedReceipt = false;
  let retainStaging = false;
  try {
    // Ignore only our own lock when comparing the freshly inspected state.
    const locked = await planInstallation(root, options);
    locked.conflicts = locked.conflicts.filter((message) => !message.startsWith('Target is locked'));
    locked.applicable = locked.conflicts.length === 0;
    const check = receipts.get(locked);
    const earlier = JSON.parse(prepared.fingerprint);
    const current = JSON.parse(check.fingerprint);
    current.plan = locked;
    // Creating a previously absent target is the sole authorized parent change.
    if (earlier.parents[plan.target] === null) earlier.parents[plan.target] = current.parents[plan.target];
    if (!same(earlier, current)) fail('Installation preconditions changed under lock; plan again');
    await checkpoint('locked');
    await safeLayout(plan.target, locations);
    await fs.mkdir(locations.store, { recursive: true, mode: 0o700 });
    staging = await fs.mkdtemp(path.join(locations.store, '.stage-'));
    await fs.writeFile(path.join(staging, 'transaction.json'), encode({ version: 1,
      previousReceipt: prepared.old.receipt, nextReceipt: prepared.nextReceipt, changes: plan.changes }),
    { flag: 'wx', mode: 0o600 });
    for (const entry of prepared.entries.filter((entry) => entry.files)) {
      const destination = path.join(staging, entry.id);
      for (const [relative, bytes] of Object.entries(entry.files)) {
        const file = path.join(destination, relative);
        await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
      }
      if (payloadHash(await treeFiles(destination)) !== entry.hash) fail('Staged payload mismatch');
    }
    await fs.writeFile(path.join(staging, 'receipt.json'), encode(prepared.nextReceipt), { flag: 'wx', mode: 0o600 });
    await checkpoint('staged');
    await safeLayout(plan.target, locations);
    const receiptNow = await loadReceipt(locations, plan.target, plan.platform, await loadCatalog(root));
    if (!same(receiptNow, prepared.old)) fail('Receipt changed before publication');
    for (const entry of prepared.old.receipt?.entries ?? []) {
      const payload = payloadPath(locations, entry);
      await assertSafeDirectory(plan.target, payload);
      if (payloadHash(await treeFiles(payload)) !== entry.hash) fail('Owned payload changed before publication');
    }
    for (const change of plan.changes) {
      const expected = change.from ? { link: change.from } : null;
      if (!same(await linkState(change.discovery), expected)) fail('Discovery changed before publication');
    }
    for (const entry of prepared.entries.filter((entry) => entry.files)) {
      const destination = payloadPath(locations, entry);
      await assertSafeDirectory(plan.target, destination);
      if (await stat(destination)) {
        if (payloadHash(await treeFiles(destination)) !== entry.hash) fail('Payload changed before publication');
      } else {
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
        await fs.rename(path.join(staging, entry.id), destination);
      }
    }
    await fs.mkdir(locations.discovery, { recursive: true });
    for (const change of plan.changes) {
      await safeLayout(plan.target, locations);
      if (!same(await linkState(change.discovery), change.from ? { link: change.from } : null)) fail('Discovery changed while publishing');
      if (change.from) await fs.rename(change.discovery, path.join(staging, `${change.id}.old`));
      completed.push(change);
      if (change.from) {
        const backup = path.join(staging, `${change.id}.old`);
        if (!(await stat(backup))?.isSymbolicLink()
          || path.resolve(path.dirname(change.discovery), await fs.readlink(backup)) !== change.from) {
          fail('Discovery was replaced while moving it; preserving the moved entry');
        }
      }
      if (change.to) await fs.symlink(change.to, change.discovery, process.platform === 'win32' ? 'junction' : 'dir');
      await checkpoint('discovery', change.id);
    }
    await safeLayout(plan.target, locations);
    for (const entry of prepared.nextReceipt.entries) {
      const expected = payloadPath(locations, entry);
      await assertSafeDirectory(plan.target, expected);
      if (!same(await linkState(path.join(locations.discovery, entry.id)), { link: expected })
        || payloadHash(await treeFiles(expected)) !== entry.hash) fail('Installed state changed before receipt publication');
    }
    if (!same(await loadReceipt(locations, plan.target, plan.platform, await loadCatalog(root)), prepared.old)) fail('Receipt changed while publishing');
    await fs.rename(path.join(staging, 'receipt.json'), locations.receipt);
    publishedReceipt = true;
    await checkpoint('receipt');
    return { ...plan, installed: prepared.nextReceipt.entries.length > 0, applied: true, noOp: false };
  } catch (error) {
    const unresolved = [];
    try {
      await safeLayout(plan.target, locations);
      if (publishedReceipt) {
        if ((await readRegular(locations.receipt)).toString('utf8') !== encode(prepared.nextReceipt)) fail('Receipt changed during rollback');
        if (prepared.old.bytes === null) await fs.unlink(locations.receipt);
        else {
          await fs.writeFile(path.join(staging, 'restore.json'), prepared.old.bytes, { flag: 'wx', mode: 0o600 });
          await fs.rename(path.join(staging, 'restore.json'), locations.receipt);
        }
      }
    } catch { unresolved.push('receipt/parent state changed'); }
    for (const change of [...completed].reverse()) {
      try {
        await safeLayout(plan.target, locations);
        const current = await linkState(change.discovery);
        if (current && !same(current, { link: change.to })) fail('Discovery changed during rollback');
        if (current) await fs.unlink(change.discovery);
        if (change.from) await fs.rename(path.join(staging, `${change.id}.old`), change.discovery);
      } catch { unresolved.push(change.id); }
    }
    retainStaging = unresolved.length > 0;
    throw new Error(`${error.message}; completed: ${completed.map((entry) => entry.id).join(', ') || 'none'}; ${retainStaging
      ? `recovery required for ${unresolved.join(', ')}; retained staging and lock` : 'owned discovery and receipt changes rolled back'}`, { cause: error });
  } finally {
    if (!retainStaging) {
      if (staging) {
        await safeLayout(plan.target, locations);
        await fs.rm(staging, { recursive: true, force: true });
      }
      await fs.rmdir(locations.lock);
    }
  }
}
