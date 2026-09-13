import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { assertSafeDirectory, isPathWithin } from './skill-lib.mjs';
import { stat, readRegular, digest, encode, payloadHash, acquireTargetLock, releaseTargetLock, publishFiles } from './installation-core.mjs';
import { parseSettings } from './global-settings.mjs';
import { projectSettings } from './project-settings.mjs';
import { projectIgnore, projectFeatures } from './project-state.mjs';
import { projectAdapters, projectTree } from './project-adapters.mjs';
import { receiptPath, runtimeNames, componentNames, filePlatform, allowedProjectFile, validateProjectReceipt } from './project-receipt.mjs';
import { buildVerificationSteps } from './project-verification.mjs';
import { detectDomainSignals, inspectExistingDomainConfiguration, inspectExistingDomainContract, inspectExistingTrackerConfiguration, renderDomainInstructions, renderTrackerInstructions } from './project-configuration.mjs';

const plans = new WeakMap();
const sameBytes = (a, b) => a === null ? b === null : b !== null && a.equals(b);
const settingsFile = (platform) => platform === 'claude' ? '.claude/settings.json' : '.codex/hooks.json';
async function optional(target, relative) {
  const file = path.join(target, relative);
  await assertSafeDirectory(target, path.dirname(file));
  try { return await readRegular(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function inventory(target, relative = '', depth = 0) {
  if (depth > 3) return [];
  await assertSafeDirectory(target, path.join(target, relative));
  const result = [];
  for (const entry of await fs.readdir(path.join(target, relative), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'bin', 'obj', 'dist', 'coverage'].includes(entry.name)) continue;
    const file = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await inventory(target, file, depth + 1));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}
async function parentIdentities(target, files) {
  const result = {};
  for (const file of files) {
    let directory = path.dirname(path.join(target, file));
    await assertSafeDirectory(target, directory);
    while (true) {
      const info = await stat(directory);
      result[directory] = info ? [info.dev, info.ino] : null;
      if (directory === target) break;
      directory = path.dirname(directory);
    }
  }
  return result;
}

export async function planProjectInstallation(repository, options) {
  const { platform, scope, operation = 'apply' } = options;
  if (!['codex', 'claude'].includes(platform) || scope !== 'project' || !['apply', 'audit', 'remove'].includes(operation)
    || typeof options.target !== 'string' || !path.isAbsolute(options.target) || /[\x00-\x1f]/.test(options.target)) throw new Error('Project lifecycle requires an absolute existing target, one platform and project scope');
  await assertSafeDirectory(path.resolve(options.target), path.resolve(options.target));
  const target = await fs.realpath(options.target);
  const root = await fs.realpath(repository);
  if (await isPathWithin(target, root) || await isPathWithin(root, target)) throw new Error('Project target must not overlap the harness checkout');
  const observed = {};
  const read = async (file) => { if (!Object.hasOwn(observed, file)) observed[file] = await optional(target, file); return observed[file]; };
  const rawReceipt = await read(receiptPath);
  let previous = null;
  try { if (rawReceipt) previous = validateProjectReceipt(JSON.parse(rawReceipt)); }
  catch { throw new Error('Malformed project installation receipt'); }
  const conflicts = [];
  const notes = [];
  if (await stat(path.join(target, '.ai-harness-install.lock'))) conflicts.push('Target is locked; inspect the active or interrupted operation');
  for (const file of Object.keys(previous?.owned ?? {})) {
    const bytes = await read(file);
    if (bytes === null || digest(bytes) !== previous.owned[file]) conflicts.push(`Owned project file is missing or edited: ${file}`);
  }
  const active = [...(previous?.platforms ?? [])];
  const selected = active.includes(platform);
  if (operation === 'apply' && !selected) active.push(platform);
  if (operation === 'remove' && selected) active.splice(active.indexOf(platform), 1);
  active.sort();
  const files = await inventory(target);
  const packageBytes = await read('package.json');
  const packageJson = packageBytes ? parseSettings(packageBytes) : {};
  const domain = await inspectExistingDomainConfiguration(target);
  const domainContract = await inspectExistingDomainContract(target);
  await read('CONTEXT.md'); await read('CONTEXT-MAP.md');
  const existingVerifier = await read('scripts/verify.mjs');
  const config = { verification: options.verification ?? previous?.options.verification ?? (existingVerifier ? 'existing' : 'generated'),
    ci: options.ci ?? previous?.options.ci ?? 'none', tracker: options.tracker ?? previous?.options.tracker ?? 'local',
    domainLayout: options.domainLayout ?? previous?.options.domainLayout ?? (domain.state === 'multi-context' || domainContract.layout === 'multi' ? 'multi' : 'single') };
  if (!['existing', 'generated'].includes(config.verification) || !['none', 'github'].includes(config.ci)
    || !['local', 'github'].includes(config.tracker) || !['single', 'multi'].includes(config.domainLayout)) throw new Error('Invalid project configuration option');
  if (operation !== 'apply' && ['verification', 'ci', 'tracker', 'domainLayout'].some((key) => options[key] !== undefined)) throw new Error('Configuration options are only accepted for project apply/plan');
  if (operation === 'apply') {
    if (previous && config.verification !== previous.options.verification) conflicts.push('Changing verifier ownership requires removing the project installation first');
    if (domain.state === 'conflict' || domainContract.state === 'conflict') conflicts.push('Existing domain configuration requires review');
    const layouts = [domain.state === 'multi-context' ? 'multi' : domain.state === 'single-context' ? 'single' : null, domainContract.layout].filter(Boolean);
    if (layouts.some((layout) => layout !== config.domainLayout)) conflicts.push('Domain layout conflicts with existing project documents');
    if (!options.domainLayout && !previous && layouts.length === 0 && detectDomainSignals(files, packageJson).length) conflicts.push('Domain boundaries need review; select --domain-layout single or multi');
    const tracker = await inspectExistingTrackerConfiguration(target, config.tracker === 'github');
    if (tracker.state === 'conflict') conflicts.push('Existing tracker contract requires review; select its tracker or reconcile the custom contract');
  }
  const source = {};
  const sourceFile = async (relative) => { const bytes = await optional(root, relative); if (bytes === null) throw new Error('Missing project source'); source[relative] = bytes; return bytes; };
  const desired = {};
  const preserve = new Set(['AGENTS.md', 'CLAUDE.md', 'docs/agents/domain.md', 'docs/agents/issue-tracker.md', '.gitleaks.toml']);
  if (active.length) {
    for (const name of runtimeNames) desired[`.harness/project-runtime/${name}`] = await sourceFile(`scripts/${name}`);
    for (const name of componentNames) desired[`.harness/hooks/${name}`] = await sourceFile(`components/${name}`);
    desired['.harness/runtime/windows-cli.mjs'] = await sourceFile('scripts/windows-cli.mjs');
    desired['scripts/verify-harness.mjs'] = await sourceFile('project/scripts/verify-harness.mjs');
    desired['AGENTS.md'] = await sourceFile('project/AGENTS.selected.md');
    if (active.includes('claude')) desired['CLAUDE.md'] = await sourceFile('project/CLAUDE.md');
    desired['docs/agents/domain.md'] = Buffer.from(renderDomainInstructions({ multiContext: config.domainLayout === 'multi' }));
    desired['docs/agents/issue-tracker.md'] = Buffer.from(renderTrackerInstructions({ github: config.tracker === 'github' }));
    desired['.gitleaks.toml'] = await sourceFile('project/.gitleaks.toml');
    const hasDotnet = files.some((file) => /\.(?:csproj|sln|slnx)$/i.test(file));
    if (config.verification === 'existing') {
      if (existingVerifier === null) conflicts.push('Existing verification requires scripts/verify.mjs');
      if (config.ci === 'github') conflicts.push('Automatic CI requires generated verification with known dependencies; preserve existing project CI separately');
    } else {
      if (existingVerifier !== null && !previous?.owned['scripts/verify.mjs']) conflicts.push('Existing project verifier is unowned; use --verification existing');
      if (files.some((file) => ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'].includes(file))) conflicts.push('Generated verification supports npm; preserve a project verifier for other package managers');
      const steps = buildVerificationSteps({ hasDotnet, hasNode: packageBytes !== null, isGithub: config.ci === 'github', packageJson, relativeFiles: files });
      if (packageBytes === null && !hasDotnet) conflicts.push('Unknown stack requires an existing scripts/verify.mjs');
      const template = (await sourceFile('project/scripts/verify.mjs.template')).toString('utf8');
      desired['scripts/verify.mjs'] = Buffer.from(template.replace('__VERIFY_STEPS__', JSON.stringify(steps, null, 2)));
      if (config.ci === 'github') {
        if (packageBytes && !files.includes('package-lock.json')) conflicts.push('Generated Node CI requires package-lock.json');
        const globalJson = await read('global.json');
        if (hasDotnet && (!globalJson || !/^\d{1,3}\.\d{1,3}\.\d{1,5}(?:-[A-Za-z0-9.-]{1,80})?$/.test(parseSettings(globalJson).sdk?.version ?? ''))) conflicts.push('Generated .NET CI requires a pinned global.json SDK version');
        const workflow = (await sourceFile('project/.github/workflows/verify.yml')).toString('utf8');
        desired['.github/workflows/harness-project.yml'] = Buffer.from(workflow.replace('name: Verify', 'name: Project harness verification').replace('node scripts/verify.mjs', 'node scripts/verify-harness.mjs'));
      }
    }
  }
  const adapters = await projectAdapters(target, active);
  if (Object.keys(adapters.files).some((file) => !allowedProjectFile(file))) throw new Error('Unsupported project adapter resource path');
  Object.assign(desired, adapters.files);
  // Adapter directories are owned as complete inventories; additional user files
  // block regeneration/removal rather than being silently discarded.
  const allAdapterFiles = new Set([...Object.keys(previous?.owned ?? {}), ...Object.keys(adapters.files)].filter((file) => file.startsWith('.claude/skills/') || file.startsWith('.agents/skills/')));
  for (const directory of new Set([...allAdapterFiles].map((file) => file.split('/').slice(0, 3).join('/')))) {
    await assertSafeDirectory(target, path.join(target, directory));
    if (await stat(path.join(target, directory))) {
      const actual = await projectTree(target, path.join(target, directory));
      if (Object.keys(actual).length && !Object.keys(previous?.owned ?? {}).some((file) => file.startsWith(directory + '/'))) conflicts.push(`Unowned project adapter: ${directory}`);
      for (const [relative, bytes] of Object.entries(actual)) {
        observed[`${directory}/${relative}`] = bytes;
        if (!previous?.owned[`${directory}/${relative}`]) conflicts.push(`Unexpected adapter resource: ${directory}/${relative}`);
      }
    }
  }
  const next = { version: 1, module: 'project-configuration', scope: 'project', profile: 'coexistence', platforms: active, options: config, owned: {}, settings: {}, ignore: null, codexFeatures: null };
  const after = {};
  for (const file of new Set([...Object.keys(previous?.owned ?? {}), ...Object.keys(desired)])) {
    const before = await read(file);
    const wanted = desired[file] ?? null;
    if (wanted !== null && !previous?.owned[file] && before !== null) {
      if (preserve.has(file)) { notes.push(`Preserved existing ${file}; review the harness gate and contract pointers`); continue; }
      conflicts.push(`Unowned project file: ${file}`);
    }
    after[file] = wanted;
    if (wanted !== null) next.owned[file] = digest(wanted);
  }
  for (const name of new Set([...(previous?.platforms ?? []), ...active])) {
    const expected = parseSettings(await sourceFile(`project/.${name}/` + (name === 'claude' ? 'settings.json' : 'hooks.json'))).hooks.PreToolUse[0];
    const file = settingsFile(name);
    const bytes = await read(file);
    try {
      const merged = projectSettings(bytes, expected, previous?.settings[name], !active.includes(name));
      if (active.includes(name)) next.settings[name] = merged.state;
      after[file] = merged.after;
    } catch (error) { conflicts.push(error.message); }
  }
  if (active.length || previous) {
    try {
      const merged = projectIgnore(await read('.gitignore'), previous?.ignore, active.length === 0);
      next.ignore = merged.state;
      after['.gitignore'] = merged.after;
    } catch (error) { conflicts.push(error.message); }
  }
  if (active.includes('codex') || previous?.platforms.includes('codex')) {
    try {
      const merged = projectFeatures(await read('.codex/config.toml'), previous?.codexFeatures, !active.includes('codex'));
      if (active.includes('codex')) next.codexFeatures = merged.state;
      after['.codex/config.toml'] = merged.after;
    } catch (error) { conflicts.push(error.message); }
  }
  if (operation === 'audit') {
    for (const [file, bytes] of Object.entries(adapters.files)) if (previous?.owned[file] !== digest(bytes)) conflicts.push(`Project adapter source drift: ${file}`);
    const oldAdapters = Object.keys(previous?.owned ?? {}).filter((file) => filePlatform(file) && file !== 'CLAUDE.md');
    if (oldAdapters.some((file) => !adapters.files[file])) conflicts.push('Project adapter source inventory changed');
  }
  after[receiptPath] = active.length ? Buffer.from(encode(next)) : null;
  const operations = operation === 'audit' || (operation === 'remove' && !selected) ? [] : Object.entries(after)
    .filter(([file, bytes]) => !sameBytes(observed[file] ?? null, bytes))
    .map(([id, bytes]) => ({ id, file: path.join(target, id), before: observed[id] ?? null, after: bytes, receipt: id === receiptPath }));
  const plan = { version: 1, module: 'project-configuration', scope, profile: 'coexistence', operation, target, platform,
    installed: selected, platforms: active, options: config, applicable: !conflicts.length, conflicts, notes,
    changes: operations.map(({ id, before, after }) => ({ id, action: after === null ? 'remove' : before === null ? 'create' : 'update' })),
    tools: ['Node', 'Git', ...(config.verification === 'generated' ? ['Gitleaks', ...(config.ci === 'github' ? ['Zizmor'] : [])] : ['project verifier dependencies'])],
    activation: 'Run node scripts/verify-harness.mjs. Review project guidance and platform hook trust; no Git configuration or machine settings are changed.' };
  const parents = await parentIdentities(target, Object.keys(observed));
  const fingerprint = encode({ plan, observed: Object.fromEntries(Object.entries(observed).map(([file, bytes]) => [file, bytes === null ? null : digest(bytes)])),
    source: payloadHash(source), adapters: payloadHash(adapters.source), parents, files });
  plans.set(plan, { root, options: { ...options, target, operation }, operations, observed, fingerprint, parents, next,
    adapterSource: payloadHash(adapters.source), source, adapterDirectories: [...new Set([...allAdapterFiles].map((file) => file.split('/').slice(0, 3).join('/')))] });
  return plan;
}

export async function applyProjectInstallation(candidate, { checkpoint = async () => {} } = {}) {
  const prepared = plans.get(candidate);
  if (!prepared) throw new Error('Apply requires a fresh in-process project plan');
  const fresh = await planProjectInstallation(prepared.root, prepared.options);
  if (!fresh.applicable) throw new Error(`Project conflicts: ${fresh.conflicts.join('; ')}`);
  if (fresh.operation === 'audit') throw new Error('Audit is read-only');
  if (plans.get(fresh).fingerprint !== prepared.fingerprint) throw new Error('Project preconditions changed');
  if (!prepared.operations.length) return { ...fresh, applied: true, noOp: true };
  const lock = await acquireTargetLock(fresh.target);
  let staging, retain = false;
  try {
    const locked = await planProjectInstallation(prepared.root, prepared.options);
    locked.conflicts = locked.conflicts.filter((entry) => !entry.startsWith('Target is locked'));
    locked.applicable = !locked.conflicts.length;
    const state = JSON.parse(plans.get(locked).fingerprint); state.plan = locked;
    if (!equal(state, JSON.parse(prepared.fingerprint))) throw new Error('Project preconditions changed under lock');
    await checkpoint('locked');
    if (!equal(prepared.parents, await parentIdentities(fresh.target, Object.keys(prepared.observed)))) throw new Error('Project parents changed');
    for (const operation of prepared.operations) await fs.mkdir(path.dirname(operation.file), { recursive: true, mode: 0o700 });
    staging = await fs.mkdtemp(path.join(fresh.target, '.harness/.project-stage-'));
    const parents = await parentIdentities(fresh.target, Object.keys(prepared.observed));
    const observed = { ...prepared.observed };
    const journal = { version: 1, changes: prepared.operations.map(({ id, before, after }) => ({ id, before: before === null ? null : digest(before), after: after === null ? null : digest(after) })) };
    await publishFiles({ target: fresh.target, staging, operations: prepared.operations, journal, checkpoint: async (phase, id) => {
      if (id) observed[id] = prepared.operations.find((entry) => entry.id === id).after;
      await checkpoint(phase, id);
      if (!equal(parents, await parentIdentities(fresh.target, Object.keys(observed)))) throw new Error('Project parents changed during publication');
      for (const [file, bytes] of Object.entries(observed)) if (!sameBytes(await optional(fresh.target, file), bytes)) throw new Error('Project file changed during publication');
      if (payloadHash((await projectAdapters(fresh.target, fresh.platforms)).source) !== prepared.adapterSource) throw new Error('Project skill source changed during publication');
      for (const [file, bytes] of Object.entries(prepared.source)) if (!sameBytes(await optional(prepared.root, file), bytes)) throw new Error('Harness source changed during publication');
      for (const directory of prepared.adapterDirectories) {
        const actual = await projectTree(fresh.target, path.join(fresh.target, directory));
        const expected = Object.keys(observed).filter((file) => file.startsWith(directory + '/') && observed[file] !== null).map((file) => file.slice(directory.length + 1)).sort();
        if (!equal(Object.keys(actual).sort(), expected)) throw new Error('Project adapter inventory changed during publication');
      }
    } });
    return { ...fresh, installed: fresh.platforms.includes(fresh.platform), applied: true, noOp: false };
  } catch (error) { retain = Boolean(error.recoveryRequired); throw error; }
  finally {
    if (!retain) {
      await assertSafeDirectory(fresh.target, path.join(fresh.target, '.harness'));
      if (staging) await fs.rm(staging, { recursive: true, force: true });
      await releaseTargetLock(lock);
    }
  }
}
