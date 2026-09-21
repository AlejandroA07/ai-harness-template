import { sealReceipt, verifyReceiptEvidence, storeReceiptEvidence, planReceiptEvidence, verifyOwnershipHead, ownershipHeadBytes } from './installation-evidence.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { assertSafeDirectory, isPathWithin } from './skill-lib.mjs';
import { digest, encode, stat, readRegular, payloadHash, treeFiles, acquireTargetLock, releaseTargetLock, publishFiles } from './installation-core.mjs';
import { object, parseSettings, getSetting, setSetting, pruneContainers, hookCount, removeExactHook, hookGroups, inspectFeatures, editFeatures } from './global-settings.mjs';
import { deniedClaudeBuiltInTools } from '../components/claude-tool-policy.mjs';

const plans = new WeakMap();
const hashPattern = /^[a-f0-9]{64}$/;
const scalarDefinitions = { includeCoAuthoredBy: false, autoMemoryEnabled: false, 'permissions.disableBypassPermissionsMode': 'disable' };
const containerNames = ['permissions', 'hooks'];
const sourceRuntimeFiles = ['components/guard-git.mjs', 'components/guard-policy.mjs', 'guidance/claude.md', 'guidance/codex.md'];
const runtimeFiles = [...sourceRuntimeFiles, 'policy.json'];
const scalarState = (value) => value === undefined ? { present: false } : { present: true, value };
const bytesEqual = (a, b) => a === null ? b === null : b !== null && a.equals(b);
function fail(message) { throw new Error(message); }
function shape(value, fields) {
  if (!object(value) || !equal(Object.keys(value).sort(), [...fields].sort())) fail('Malformed global installation receipt');
}
function quotePosix(value) { return `'${value.replaceAll("'", "'\\''")}'`; }
function quoteWindows(value) {
  if (/["%!\r\n]/.test(value)) fail('Windows hook paths cannot contain quotes, percent signs, exclamation marks or newlines');
  return `"${value}"`;
}
function hook(platform, runtime, executable = process.execPath) {
  const program = path.join(runtime, 'components', 'guard-git.mjs');
  if (platform === 'claude') return { matcher: 'Bash|PowerShell|Read', hooks: [{ type: 'command', command: executable, args: [program], timeout: 10 }] };
  const command = process.platform === 'win32'
    ? `${quoteWindows(executable)} ${quoteWindows(program)}`
    : `${quotePosix(executable)} ${quotePosix(program)}`;
  const handler = { type: 'command', command, timeout: 10 };
  if (platform === 'codex') {
    if (process.platform === 'win32') handler.commandWindows = command;
    handler.statusMessage = 'Checking command against machine policy';
  }
  return { matcher: platform === 'codex' ? 'Bash|Read' : 'Bash|PowerShell|Read', hooks: [handler] };
}
async function optionalFile(file) {
  try { return await readRegular(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function sourceBundle(root) {
  const files = {};
  for (const relative of sourceRuntimeFiles) {
    const source = relative.startsWith('guidance/')
      ? `global/${relative === 'guidance/codex.md' ? 'AGENTS.md' : 'CLAUDE.md'}` : relative;
    await assertSafeDirectory(root, path.dirname(path.join(root, source)));
    const bytes = await readRegular(path.join(root, source));
    files[relative] = relative.startsWith('guidance/') ? Buffer.from(bytes.toString('utf8').replaceAll('{{HARNESS_ROOT}}', root)) : bytes;
  }
  const template = parseSettings(await readRegular(path.join(root, 'global/claude-settings.json')));
  const denials = [...new Set([...template.permissions.deny, ...deniedClaudeBuiltInTools])];
  if (denials.some((entry) => typeof entry !== 'string')) fail('Invalid canonical permission denials');
  files['policy.json'] = Buffer.from(encode({ version: 1, executable: process.execPath, denials }));
  return { files, hash: payloadHash(files), denials };
}
async function legacyState(sourceRoot, legacyRoot, platform) {
  const guidanceName = platform === 'codex' ? 'AGENTS.md' : 'CLAUDE.md';
  const guidance = Buffer.from((await readRegular(path.join(sourceRoot, 'global', guidanceName))).toString('utf8')
    .replaceAll('{{HARNESS_ROOT}}', legacyRoot));
  const templatePath = platform === 'codex' ? 'global/codex-hooks/hooks.json.template' : 'global/claude-settings.json';
  const template = JSON.parse((await readRegular(path.join(sourceRoot, templatePath))).toString('utf8')
    .replaceAll('{{HARNESS_ROOT}}', legacyRoot.replaceAll('\\', '/'))
    .replaceAll('{{HARNESS_ROOT_WINDOWS}}', legacyRoot.replaceAll('\\', '\\\\')));
  return { guidance, hook: template.hooks.PreToolUse[0] };
}
function validateReceipt(receipt, { target, platform }) {
  shape(receipt, ['version', 'evidence', 'target', 'platform', 'module', 'profile', 'runtime', 'guidanceHash', 'scalars', 'addedDenials', 'hookOwned',
    'createdContainers', 'settingsExisted', 'hookArrayExisted', 'denyArrayExisted', 'configExisted', 'features', 'createdFeatureTable']);
  if (receipt.version !== 2 || receipt.target !== target || receipt.platform !== platform || receipt.module !== 'global-configuration'
    || receipt.profile !== 'coexistence' || !hashPattern.test(receipt.runtime) || !hashPattern.test(receipt.guidanceHash)) fail('Global receipt identity mismatch');
  for (const key of ['hookOwned', 'settingsExisted', 'hookArrayExisted', 'denyArrayExisted', 'configExisted', 'createdFeatureTable']) {
    if (typeof receipt[key] !== 'boolean') fail('Invalid global receipt flag');
  }
  shape(receipt.scalars, platform === 'claude' ? Object.keys(scalarDefinitions) : []);
  for (const [key, state] of Object.entries(receipt.scalars)) {
    shape(state, state.present === true ? ['present', 'value'] : ['present']);
    if (typeof state.present !== 'boolean' || (state.present && typeof state.value !== typeof scalarDefinitions[key])) fail('Invalid prior setting');
    if (state.present && key === 'permissions.disableBypassPermissionsMode' && !['disable', 'enable'].includes(state.value)) fail('Invalid prior bypass setting');
  }
  if (!Array.isArray(receipt.addedDenials) || receipt.addedDenials.some((entry) => typeof entry !== 'string')
    || new Set(receipt.addedDenials).size !== receipt.addedDenials.length
    || (platform === 'codex' && receipt.addedDenials.length)) fail('Invalid receipt permission ownership');
  if (!Array.isArray(receipt.createdContainers) || receipt.createdContainers.some((entry) => !containerNames.includes(entry))
    || new Set(receipt.createdContainers).size !== receipt.createdContainers.length) fail('Invalid receipt container ownership');
  shape(receipt.features, platform === 'codex' ? ['hooks', 'memories'] : []);
  if (Object.values(receipt.features).some((value) => value !== null && typeof value !== 'boolean')) fail('Invalid prior feature value');
}
async function safePaths(target, locations) {
  for (const directory of [locations.store, locations.runtimes, path.dirname(locations.guidance)]) await assertSafeDirectory(target, directory);
}
async function parents(target, locations) {
  const result = {};
  for (const end of [locations.store, locations.runtimes, path.dirname(locations.guidance)]) {
    let current = end;
    while (true) {
      const info = await stat(current);
      result[current] = info ? [info.dev, info.ino, info.mode] : null;
      if (current === target) break;
      current = path.dirname(current);
    }
  }
  return result;
}

export async function planGlobalInstallation(repository, options) {
  const { operation = 'apply', target: inputTarget, platform, scope, legacyRoot: inputLegacyRoot = null } = options;
  if (!['apply', 'audit', 'remove'].includes(operation) || !['codex', 'claude'].includes(platform) || scope !== 'machine'
    || typeof inputTarget !== 'string' || !path.isAbsolute(inputTarget) || /[\x00-\x1f]/.test(inputTarget)) {
    fail('Global lifecycle requires an absolute --target, one --platform and --scope machine');
  }
  if (inputLegacyRoot !== null && (operation !== 'apply' || typeof inputLegacyRoot !== 'string'
    || !path.isAbsolute(inputLegacyRoot) || /[\x00-\x1f]/.test(inputLegacyRoot))) {
    fail('Legacy global migration requires an absolute legacy root for apply');
  }
  const unresolved = path.resolve(inputTarget);
  await assertSafeDirectory(unresolved, unresolved);
  const target = await fs.realpath(unresolved).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await fs.realpath(path.dirname(unresolved)), path.basename(unresolved));
  });
  const root = await fs.realpath(repository);
  const legacyRoot = inputLegacyRoot === null ? null : path.resolve(inputLegacyRoot);
  if (await isPathWithin(target, root)) fail('Installation target must be outside the source checkout');
  const platformRoot = path.join(target, platform === 'codex' ? '.codex' : '.claude');
  const locations = { store: path.join(target, '.ai-harness/installations', platform), runtimes: path.join(target, '.ai-harness/runtime'),
    guidance: path.join(platformRoot, platform === 'codex' ? 'AGENTS.md' : 'CLAUDE.md'),
    settings: path.join(platformRoot, platform === 'codex' ? 'hooks.json' : 'settings.json'), config: path.join(platformRoot, 'config.toml') };
  locations.receipt = path.join(locations.store, 'global.json');
  locations.ownership = path.join(locations.store, 'global-current.json');
  locations.lock = path.join(target, '.ai-harness-install.lock');
  for (const owned of [locations.store, locations.runtimes, platformRoot]) {
    if (await isPathWithin(root, owned)) fail('Global installation overlaps the source checkout');
  }
  await safePaths(target, locations);
  const bundle = operation === 'apply' ? await sourceBundle(root) : { files: {}, hash: null, denials: [] };
  const input = { guidance: await optionalFile(locations.guidance), settings: await optionalFile(locations.settings),
    receipt: await optionalFile(locations.receipt), config: platform === 'codex' ? await optionalFile(locations.config) : null };
  let previous = null;
  if (input.receipt !== null) {
    try { previous = JSON.parse(input.receipt.toString('utf8')); } catch { fail('Malformed global installation receipt'); }
    await verifyReceiptEvidence(target, locations.store, previous);
    validateReceipt(previous, { target, platform, denials: bundle.denials });
  }
  input.ownership = await verifyOwnershipHead(target, locations.ownership, previous?.evidence ?? null);
  const conflicts = [];
  if (await stat(locations.lock)) conflicts.push('Target is locked; inspect the running or interrupted operation');
  const runtime = bundle.hash ? path.join(locations.runtimes, bundle.hash) : null;
  const previousRuntime = previous ? path.join(locations.runtimes, previous.runtime) : null;
  let ownedFiles = null;
  let previousPolicy = null;
  if (previous) {
    try {
      await assertSafeDirectory(target, previousRuntime);
      ownedFiles = await treeFiles(previousRuntime);
      if (!equal(Object.keys(ownedFiles).sort(), [...runtimeFiles].sort()) || payloadHash(ownedFiles) !== previous.runtime
        || digest(ownedFiles[`guidance/${platform}.md`]) !== previous.guidanceHash) fail('Owned runtime mismatch');
      previousPolicy = JSON.parse(ownedFiles['policy.json'].toString('utf8'));
      shape(previousPolicy, ['version', 'executable', 'denials']);
      if (previousPolicy.version !== 1 || typeof previousPolicy.executable !== 'string' || !path.isAbsolute(previousPolicy.executable)
        || /[\x00-\x1f]/.test(previousPolicy.executable) || !Array.isArray(previousPolicy.denials)
        || previousPolicy.denials.some((entry) => typeof entry !== 'string')
        || previous.addedDenials.some((entry) => !previousPolicy.denials.includes(entry))) fail('Invalid runtime policy');
      if (input.guidance === null || !input.guidance.equals(ownedFiles[`guidance/${platform}.md`])) conflicts.push('guidance: owned content is missing or edited');
    } catch { conflicts.push('runtime: owned payload is missing, edited or unsafe'); }
  }
  const legacy = !previous && operation === 'apply' && legacyRoot ? await legacyState(root, legacyRoot, platform) : null;
  const adoptingLegacyGuidance = legacy && input.guidance !== null && input.guidance.equals(legacy.guidance);
  if (!previous && operation === 'apply' && input.guidance !== null && !adoptingLegacyGuidance) {
    conflicts.push('guidance: unowned or legacy content requires a reviewed migration');
  }
  if (operation === 'apply') {
    await assertSafeDirectory(target, runtime);
    if (await stat(runtime)) {
      if (payloadHash(await treeFiles(runtime)) !== bundle.hash) conflicts.push('runtime: unowned store collision');
    }
  }
  const settings = parseSettings(input.settings);
  const modified = structuredClone(settings);
  let groups = hookGroups(settings);
  if (settings.disableAllHooks === true && operation !== 'remove') conflicts.push('hooks: all hooks are disabled; reconcile the local setting before activation');
  const expected = hook(platform, runtime ?? previousRuntime ?? locations.runtimes, operation === 'apply' ? process.execPath : previousPolicy?.executable ?? process.execPath);
  const oldHook = previous ? hook(platform, previousRuntime, previousPolicy?.executable ?? process.execPath) : null;
  if (previous && hookCount(groups, oldHook) !== 1) conflicts.push('hooks: owned or required hook is missing, duplicated or edited');
  // A known checkout hook is migration evidence, not permission to remove it.
  if (!previous && operation === 'apply' && !legacy) {
    const legacyCommands = [root, path.resolve(repository)].flatMap((directory) => {
      const forward = directory.replaceAll('\\', '/');
      const backward = forward.replaceAll('/', '\\');
      return [forward + '/components/guard-git.mjs', backward + '\\components\\guard-git.mjs', backward + '/components/guard-git.mjs']
        .map((program) => `node "${program}"`);
    });
    if (groups.some((group) => group.hooks.some((entry) => legacyCommands.includes(entry.command)))) conflicts.push('hooks: legacy checkout hook requires a reviewed migration');
  }
  let migratedLegacyHook = false;
  if (legacy) {
    const count = hookCount(groups, legacy.hook);
    if (count !== 1) conflicts.push('hooks: exact legacy checkout hook is missing, duplicated or edited');
    else {
      groups = removeExactHook(groups, legacy.hook);
      setSetting(modified, ['hooks', 'PreToolUse'], scalarState(groups));
      migratedLegacyHook = true;
    }
  }
  const features = platform === 'codex' ? inspectFeatures(input.config?.toString('utf8') ?? '') : null;
  const receipt = previous ? structuredClone(previous) : { version: 2, target, platform, module: 'global-configuration', profile: 'coexistence',
    runtime: bundle.hash, guidanceHash: operation === 'apply' ? digest(bundle.files[`guidance/${platform}.md`]) : null, scalars: {}, addedDenials: [],
    hookOwned: hookCount(groups, expected) === 0, createdContainers: containerNames.filter((name) => !Object.hasOwn(settings, name)),
    settingsExisted: input.settings !== null, hookArrayExisted: getSetting(settings, ['hooks', 'PreToolUse']).present,
    denyArrayExisted: platform === 'claude' && getSetting(settings, ['permissions', 'deny']).present,
    configExisted: input.config !== null, features: features?.values ?? {}, createdFeatureTable: features ? features.featureHeader === null : false };
  if (platform === 'claude') {
    for (const [name, value] of Object.entries(scalarDefinitions)) {
      const keys = name.split('.');
      const actual = getSetting(settings, keys);
      if (actual.present && (typeof actual.value !== typeof value
        || (typeof value === 'string' && !['disable', 'enable'].includes(actual.value)))) fail('Incompatible owned setting value');
      if (previous && !equal(actual, scalarState(value))) conflicts.push(`${name}: owned setting was edited`);
      if (!previous) receipt.scalars[name] = actual;
      if (operation === 'apply') setSetting(modified, keys, scalarState(value));
      if (operation === 'remove' && previous) setSetting(modified, keys, previous.scalars[name]);
    }
    const actual = getSetting(settings, ['permissions', 'deny']);
    const deny = actual.present ? actual.value : [];
    if (!Array.isArray(deny) || deny.some((entry) => typeof entry !== 'string')) fail('Incompatible permission deny array');
    if (previous && previousPolicy?.denials.some((entry) => !deny.includes(entry))) conflicts.push('permissions.deny: required denial is missing');
    if (operation === 'apply') {
      const retired = receipt.addedDenials.filter((entry) => !bundle.denials.includes(entry));
      const retained = deny.filter((entry) => !retired.includes(entry));
      const additions = bundle.denials.filter((entry) => !retained.includes(entry));
      receipt.addedDenials = [...new Set([...receipt.addedDenials.filter((entry) => !retired.includes(entry)), ...additions])];
      setSetting(modified, ['permissions', 'deny'], scalarState([...retained, ...additions]));
    } else if (operation === 'remove' && previous) {
      const retained = deny.filter((entry) => !previous.addedDenials.includes(entry));
      setSetting(modified, ['permissions', 'deny'], retained.length || previous.denyArrayExisted ? scalarState(retained) : { present: false });
    }
  } else if (previous && !equal(features.values, { hooks: true, memories: false })) conflicts.push('features: owned Codex feature values were edited');
  if (operation === 'apply') {
    if (previous && !previous.hookOwned && !equal(oldHook, expected)) conflicts.push('hooks: existing unowned hook cannot be replaced automatically');
    let retained = previous?.hookOwned && !equal(oldHook, expected) ? removeExactHook(groups, oldHook) : groups;
    if (!hookCount(retained, expected)) retained = [...retained, expected];
    if (hookCount(retained, expected) !== 1) conflicts.push('hooks: duplicate exact hook');
    setSetting(modified, ['hooks', 'PreToolUse'], scalarState(retained));
    receipt.runtime = bundle.hash;
    receipt.guidanceHash = digest(bundle.files[`guidance/${platform}.md`]);
  } else if (operation === 'remove' && previous) {
    const retained = previous.hookOwned ? removeExactHook(groups, oldHook) : groups;
    setSetting(modified, ['hooks', 'PreToolUse'], retained.length || previous.hookArrayExisted ? scalarState(retained) : { present: false });
    pruneContainers(modified, previous.createdContainers.map((name) => [name]));
  }
  let config = input.config;
  if (platform === 'codex' && operation !== 'audit' && (operation === 'apply' || previous)) {
    const updated = editFeatures(input.config?.toString('utf8') ?? '', operation === 'apply' ? { hooks: true, memories: false } : previous.features,
      operation === 'remove' && previous.createdFeatureTable);
    config = operation === 'remove' && !previous.configExisted && !updated.trim() ? null : Buffer.from(updated);
  }
  const outputSettings = equal(settings, modified) ? input.settings : (operation === 'remove' && !previous.settingsExisted && !Object.keys(modified).length ? null : Buffer.from(encode(modified)));
  const sealedReceipt = sealReceipt(receipt);
  const after = operation === 'audit' || (operation === 'remove' && !previous) ? input : {
    guidance: operation === 'apply' ? bundle.files[`guidance/${platform}.md`] : null,
    settings: outputSettings, config, ownership: operation === 'apply' ? ownershipHeadBytes(sealedReceipt.evidence) : null, receipt: operation === 'apply' ? Buffer.from(encode(sealedReceipt)) : null };
  const operations = ['guidance', 'settings', ...(platform === 'codex' ? ['config'] : []), 'ownership', 'receipt']
    .filter((id) => !bytesEqual(input[id], after[id])).map((id) => ({ id, file: locations[id], before: input[id], after: after[id], receipt: id === 'receipt' }));
  const evidence = operation === 'apply' ? await planReceiptEvidence(target, locations.store, sealedReceipt) : null;
  const plan = { version: 1, stage: 'target-preflight', operation, target, platform, scope, module: 'global-configuration', profile: 'coexistence',
    installed: previous !== null, selected: ['global-configuration'], dependencies: ['shared-policy-runtime'],
    changes: operations.map(({ id, file, before, after }) => ({ id, path: file, action: after === null ? 'remove' : before === null ? 'create' : 'update' })),
    receiptChanged: operations.some((entry) => entry.receipt), evidence, applicable: conflicts.length === 0, conflicts,
    activation: settings.disableAllHooks === true && operation !== 'remove' ? 'Guard activation is blocked: local settings disable all hooks.' : operation === 'remove' ? 'Removal restores prior owned settings; shared runtime is retained.'
      : operation === 'audit' && !previous ? 'No global installation receipt is present.'
        : platform === 'codex' ? 'Configuration enables hooks and disables memories; review/trust through /hooks remains interactive.' : 'Configuration enables the PreToolUse guard and disables automatic memory.',
    tools: [process.execPath, 'git (when checking push commands)'], runtime: operation === 'apply' ? runtime : previousRuntime,
    retainedRuntime: 'Shared immutable runtime revisions are retained on removal.' };
  plan.migrated = { guidance: Boolean(adoptingLegacyGuidance), hook: migratedLegacyHook };
  const parentState = await parents(target, locations);
  plans.set(plan, { root: path.resolve(repository), options: { operation, target, platform, scope, legacyRoot }, locations, bundle, previous, receipt: sealedReceipt, operations, input,
    fingerprint: encode({ plan, input: Object.fromEntries(Object.entries(input).map(([key, bytes]) => [key, bytes === null ? null : digest(bytes)])),
      source: bundle.hash, owned: ownedFiles ? payloadHash(ownedFiles) : null, parents: parentState }) });
  return plan;
}

export async function applyGlobalInstallation(candidate, { checkpoint = async () => {} } = {}) {
  const prepared = plans.get(candidate);
  if (!prepared) fail('Apply requires a fresh in-process global plan');
  const plan = await planGlobalInstallation(prepared.root, prepared.options);
  if (!plan.applicable) fail(`Global installation conflicts: ${plan.conflicts.join('; ')}`);
  if (plan.operation === 'audit') fail('Audit is read-only');
  if (plans.get(plan).fingerprint !== prepared.fingerprint) fail('Global installation preconditions changed');
  if (!prepared.operations.length) return { ...plan, applied: true, noOp: true };
  await fs.mkdir(plan.target).catch((error) => { if (error.code !== 'EEXIST') throw error; });
  const lock = await acquireTargetLock(plan.target);
  let staging, retain = false;
  try {
    const locked = await planGlobalInstallation(prepared.root, prepared.options);
    locked.conflicts = locked.conflicts.filter((message) => !message.startsWith('Target is locked'));
    locked.applicable = locked.conflicts.length === 0;
    const before = JSON.parse(prepared.fingerprint);
    const current = JSON.parse(plans.get(locked).fingerprint);
    current.plan = locked;
    if (before.parents[plan.target] === null) before.parents[plan.target] = current.parents[plan.target];
    if (!equal(before, current)) fail('Global installation preconditions changed under lock');
    await checkpoint('locked');
    await safePaths(plan.target, prepared.locations);
    if (!equal(current.parents, await parents(plan.target, prepared.locations))) fail('Parent directory changed under lock');
    await fs.mkdir(prepared.locations.store, { recursive: true, mode: 0o700 });
    staging = await fs.mkdtemp(path.join(prepared.locations.store, '.global-stage-'));
    if (plan.operation === 'apply') {
      const destination = path.join(prepared.locations.runtimes, prepared.bundle.hash);
      await assertSafeDirectory(plan.target, destination);
      if (!await stat(destination)) {
        const payload = path.join(staging, 'runtime');
        for (const [relative, bytes] of Object.entries(prepared.bundle.files)) {
          const file = path.join(payload, relative);
          await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
          await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
        }
        if (payloadHash(await treeFiles(payload)) !== prepared.bundle.hash) fail('Staged runtime mismatch');
        await fs.mkdir(prepared.locations.runtimes, { recursive: true, mode: 0o700 });
        await fs.rename(payload, destination);
      } else if (payloadHash(await treeFiles(destination)) !== prepared.bundle.hash) fail('Runtime changed before publication');
    }
    if (plan.operation === 'apply') await storeReceiptEvidence(plan.target, prepared.locations.store, staging, prepared.receipt);
    const journal = { version: 1, previousReceipt: prepared.previous, nextReceipt: plan.operation === 'remove' ? null : prepared.receipt,
      changes: prepared.operations.map(({ id, before, after }) => ({ id, before: before === null ? null : digest(before), after: after === null ? null : digest(after) })) };
    await fs.mkdir(path.dirname(prepared.locations.guidance), { recursive: true, mode: 0o700 });
    const parentState = await parents(plan.target, prepared.locations);
    const observed = { ...prepared.input };
    await publishFiles({ target: plan.target, staging, operations: prepared.operations, journal, checkpoint: async (phase, id) => {
      if (id) observed[id] = prepared.operations.find((operation) => operation.id === id).after;
      await checkpoint(phase, id);
      if (prepared.previous) await verifyReceiptEvidence(plan.target, prepared.locations.store, prepared.previous);
      if (plan.operation === 'apply') await verifyReceiptEvidence(plan.target, prepared.locations.store, prepared.receipt);
      await safePaths(plan.target, prepared.locations);
      const currentParents = await parents(plan.target, prepared.locations);
      for (const [directory, identity] of Object.entries(parentState)) {
        if (identity !== null && !equal(identity, currentParents[directory])) fail('Parent directory changed during publication');
      }
      const revisions = new Set([prepared.previous?.runtime, ...(plan.operation === 'apply' ? [prepared.bundle.hash] : [])].filter(Boolean));
      for (const revision of revisions) {
        if (payloadHash(await treeFiles(path.join(prepared.locations.runtimes, revision))) !== revision) fail('Runtime changed during publication');
      }
      for (const [kind, bytes] of Object.entries(observed)) {
        if (kind === 'config' && plan.platform !== 'codex') continue;
        if (!bytesEqual(await optionalFile(prepared.locations[kind]), bytes)) fail('Target state changed during publication');
      }
    } });
    return { ...plan, installed: plan.operation === 'apply', applied: true, noOp: false };
  } catch (error) { retain = Boolean(error.recoveryRequired); throw error; }
  finally {
    if (!retain) {
      await safePaths(plan.target, prepared.locations);
      if (staging) await fs.rm(staging, { recursive: true, force: true });
      await releaseTargetLock(lock);
    }
  }
}
