import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { loadIntegrationCatalog, planIntegrations } from './integration-catalog.mjs';
import { acquireTargetLock, digest, encode, payloadHash, publishFiles, readRegular, releaseTargetLock, stat, treeFiles } from './installation-core.mjs';
import { ownershipHeadBytes, sealReceipt, storeReceiptEvidence, verifyOwnershipHead, verifyReceiptEvidence } from './installation-evidence.mjs';
import { assertSafeDirectory, isPathWithin, parseSkill, renderSkillDocuments } from './skill-lib.mjs';

const plans = new WeakMap();
const sameBytes = (left, right) => left === null ? right === null : right !== null && left.equals(right);
const fail = (message) => { throw new Error(message); };
const adapterIds = new Set(['archify', 'graphify']);
const mcpIds = new Set(['context7', 'playwright']);

function layout(target, platform, scope) {
  const store = path.join(target, scope === 'project' ? '.harness' : '.ai-harness', 'installations', platform, 'integrations');
  return {
    store,
    receipt: path.join(store, 'receipt.json'),
    ownership: path.join(store, 'current.json'),
    artifacts: path.join(store, 'artifacts'),
    discovery: path.join(target, platform === 'codex' ? '.agents' : '.claude', 'skills'),
    configuration: path.join(target, platform === 'codex' ? '.codex/config.toml'
      : scope === 'project' ? '.mcp.json' : '.claude.json'),
    lock: path.join(target, '.ai-harness-install.lock'),
  };
}

function artifactName(integration) {
  const name = new URL(integration.provenance.artifact.url).pathname.split('/').at(-1);
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(name)) fail('Unsafe integration artifact name');
  return name;
}

function artifactDigest(artifact, bytes) {
  return artifact.format === 'npm'
    ? `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`
    : digest(bytes);
}

export function verifyIntegrationArtifact(integration, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== integration.provenance.artifact.size) fail(`Artifact size mismatch for ${integration.id}`);
  const expected = integration.provenance.artifact.integrity ?? integration.provenance.artifact.sha256;
  if (artifactDigest(integration.provenance.artifact, bytes) !== expected) fail(`Artifact digest mismatch for ${integration.id}`);
  return { size: bytes.length, digest: expected, format: integration.provenance.artifact.format };
}

async function optional(target, file) {
  await assertSafeDirectory(target, path.dirname(file));
  try {
    const bytes = await readRegular(file);
    if (bytes.length > 20_000_000) fail('Integration-owned file exceeds the inspection limit');
    return bytes;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function validateReceipt(receipt, target, platform, scope) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || !equal(Object.keys(receipt).sort(), ['entries', 'evidence', 'module', 'platform', 'profile', 'scope', 'target', 'version'].sort())
    || receipt.version !== 2 || receipt.module !== 'tool-integrations' || receipt.profile !== 'coexistence'
    || receipt.target !== target || receipt.platform !== platform || receipt.scope !== scope || !Array.isArray(receipt.entries)) fail('Malformed integration receipt');
  const ids = [];
  for (const entry of receipt.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || !equal(Object.keys(entry).sort(), ['adapterFiles', 'adapterHash', 'artifact', 'configuration', 'enabled', 'id'].sort())
      || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id)
      || !/^[a-f0-9]{64}$/.test(entry.adapterHash) || !Array.isArray(entry.adapterFiles)
      || !equal(entry.adapterFiles, [...new Set(entry.adapterFiles)].sort())
      || entry.adapterFiles.some((file) => !['SKILL.md', 'agents/openai.yaml'].includes(file)) || !Array.isArray(entry.enabled)
      || entry.enabled.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))) fail('Malformed integration receipt entry');
    const expectedAdapterFiles = adapterIds.has(entry.id)
      ? platform === 'codex' ? ['SKILL.md', 'agents/openai.yaml'] : ['SKILL.md'] : [];
    if (!equal(entry.adapterFiles, expectedAdapterFiles)) fail('Malformed integration adapter inventory');
    if (!entry.artifact || !Number.isSafeInteger(entry.artifact.size) || typeof entry.artifact.digest !== 'string'
      || entry.artifact.size < 1 || entry.artifact.size > 20_000_000
      || !/^(?:[a-f0-9]{64}|sha512-[A-Za-z0-9+/]+={0,2})$/.test(entry.artifact.digest)
      || typeof entry.artifact.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(entry.artifact.name)
      || !equal(entry.enabled, [...new Set(entry.enabled)].sort())) fail('Malformed integration artifact receipt');
    if (entry.configuration !== null && (!entry.configuration || typeof entry.configuration !== 'object'
      || !['json', 'toml'].includes(entry.configuration.kind) || typeof entry.configuration.path !== 'string'
      || !['string', 'object'].includes(typeof entry.configuration.owned))) fail('Malformed integration configuration receipt');
    if (entry.configuration) {
      const expectedPath = path.relative(target, layout(target, platform, scope).configuration).split(path.sep).join('/');
      if (entry.configuration.path !== expectedPath || entry.configuration.kind !== (platform === 'claude' ? 'json' : 'toml')) fail('Integration configuration target mismatch');
      if (platform === 'claude') {
        const owned = entry.configuration.owned;
        if (!owned || typeof owned !== 'object' || Array.isArray(owned)
          || !equal(Object.keys(owned).sort(), ['args', 'command']) || typeof owned.command !== 'string'
          || !Array.isArray(owned.args) || owned.args.some((argument) => typeof argument !== 'string')) fail('Malformed integration configuration receipt');
      } else if (typeof entry.configuration.owned !== 'string' || entry.configuration.owned.length > 20_000
        || /[\x00-\x08\x0b-\x1f\x7f]/.test(entry.configuration.owned)
        || !entry.configuration.owned.startsWith(`# BEGIN ai-harness integration ${entry.id}\n`)
        || !entry.configuration.owned.endsWith(`# END ai-harness integration ${entry.id}\n`)) fail('Malformed integration configuration receipt');
    }
    ids.push(entry.id);
  }
  if (!equal(ids, [...new Set(ids)].sort())) fail('Malformed integration receipt selection');
  return receipt;
}

async function loadReceipt(target, locations, platform, scope) {
  const bytes = await optional(target, locations.receipt);
  if (bytes === null) {
    await verifyOwnershipHead(target, locations.ownership, null);
    return { receipt: null, bytes: null };
  }
  let receipt;
  try { receipt = validateReceipt(JSON.parse(bytes), target, platform, scope); } catch (error) { fail(error.message); }
  await verifyReceiptEvidence(target, locations.store, receipt);
  await verifyOwnershipHead(target, locations.ownership, receipt.evidence);
  return { receipt, bytes };
}

async function adapterBytes(root, integration) {
  const relative = typeof integration.adapter === 'string' ? integration.adapter : integration.adapter;
  const file = path.join(root, relative);
  await assertSafeDirectory(root, path.dirname(file));
  return await readRegular(file);
}

function renderAdapter(integration, platform, source) {
  if (!adapterIds.has(integration.id)) return {};
  const skill = parseSkill(source.toString('utf8'), integration.adapter);
  return Object.fromEntries(Object.entries(renderSkillDocuments(skill, platform, true))
    .map(([name, contents]) => [name, Buffer.from(contents)]));
}

export function renderMcpConfiguration(platform, integration, source, hostPlatform = process.platform) {
  if (!mcpIds.has(integration.id)) return null;
  const version = `${integration.runtime.package}@${integration.runtime.version}`;
  if (!Buffer.isBuffer(source) || !source.includes(version)) fail('MCP adapter source differs from its runtime pin');
  const command = hostPlatform === 'win32' ? 'cmd' : 'npx';
  const args = hostPlatform === 'win32' ? ['/c', 'npx', '-y', version] : ['-y', version];
  if (platform === 'claude') return { command, args };
  const body = `[mcp_servers.${integration.id}]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`;
  return `# BEGIN ai-harness integration ${integration.id}\n${body}# END ai-harness integration ${integration.id}\n`;
}

function readJsonConfiguration(bytes) {
  if (bytes === null) return {};
  let parsed;
  try { parsed = JSON.parse(bytes); } catch { fail('Claude MCP configuration is not valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('Claude MCP configuration must be an object');
  if (parsed.mcpServers !== undefined && (!parsed.mcpServers || typeof parsed.mcpServers !== 'object' || Array.isArray(parsed.mcpServers))) fail('Claude mcpServers must be an object');
  return parsed;
}

function renderConfiguration(platform, before, previous, desired, conflicts) {
  if (platform === 'claude') {
    const value = readJsonConfiguration(before);
    value.mcpServers ??= {};
    for (const entry of previous) if (entry.configuration) {
      if (!equal(value.mcpServers[entry.id], entry.configuration.owned)) conflicts.push(`${entry.id}: owned MCP configuration was edited`);
      else delete value.mcpServers[entry.id];
    }
    for (const entry of desired) if (entry.configuration) {
      if (Object.hasOwn(value.mcpServers, entry.id)) conflicts.push(`${entry.id}: unowned MCP configuration collision`);
      else value.mcpServers[entry.id] = entry.configuration.owned;
    }
    if (!Object.keys(value.mcpServers).length) delete value.mcpServers;
    return Object.keys(value).length ? Buffer.from(encode(value)) : null;
  }
  let value = before?.toString('utf8') ?? '';
  for (const entry of previous.toReversed()) if (entry.configuration) {
    const owned = entry.configuration.owned;
    if (value.split(owned).length !== 2) conflicts.push(`${entry.id}: owned MCP configuration was edited`);
    else value = value.replace(owned, '');
  }
  for (const entry of desired) if (entry.configuration) {
    if (new RegExp(`^\\[mcp_servers\\.${entry.id}\\]`, 'm').test(value)) conflicts.push(`${entry.id}: unowned MCP configuration collision`);
    else value += `${value && !value.endsWith('\n') ? '\n' : ''}${value ? '\n' : ''}${entry.configuration.owned}`;
  }
  return value ? Buffer.from(value) : null;
}

function integrationState(entry) {
  return { provisioned: true, configured: true, invocable: mcpIds.has(entry.id), running: false };
}

export async function planIntegrationInstallation(repository, options) {
  const { operation = 'apply', platform, scope, ids = [], enabled = [], artifacts = {}, target: suppliedTarget,
    hostPlatform = process.platform } = options;
  if (!['apply', 'audit', 'remove'].includes(operation) || !['claude', 'codex'].includes(platform)
    || !['machine', 'project'].includes(scope) || typeof suppliedTarget !== 'string' || !path.isAbsolute(suppliedTarget)
    || !artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)
    || !['darwin', 'linux', 'win32'].includes(hostPlatform)) fail('Integration lifecycle requires an absolute target, platform and scope');
  if (operation === 'audit' && (ids.length || enabled.length || Object.keys(artifacts).length)) fail('Integration audit inspects the whole receipt');
  if (operation !== 'audit' && !ids.length) fail('Select at least one integration');
  if (operation === 'remove' && (enabled.length || Object.keys(artifacts).length)) fail('Removal does not accept activation or artifact inputs');
  if (Object.keys(artifacts).some((id) => !ids.includes(id) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))) fail('Artifact input must match one selected integration');
  const unresolved = path.resolve(suppliedTarget);
  await assertSafeDirectory(unresolved, unresolved);
  const target = await fs.realpath(unresolved).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await fs.realpath(path.dirname(unresolved)), path.basename(unresolved));
  });
  const root = await fs.realpath(repository);
  if (await isPathWithin(target, root) || await isPathWithin(root, target)) fail('Integration target must not overlap the harness checkout');
  const locations = layout(target, platform, scope);
  const old = await loadReceipt(target, locations, platform, scope);
  const previous = old.receipt?.entries ?? [];
  const conflicts = [];
  if (await stat(locations.lock)) conflicts.push('Target is locked; inspect the active or interrupted operation');
  const catalog = operation === 'apply' ? await loadIntegrationCatalog(root) : null;
  const selected = operation === 'apply' ? planIntegrations(catalog, { ids, platform, scope, enabled }).integrations : [];
  if (operation === 'remove' && ids.some((id) => !previous.some((entry) => entry.id === id))) fail('Cannot remove an integration not owned by this receipt');
  const desired = new Map(previous.map((entry) => [entry.id, structuredClone(entry)]));
  const renderedAdapters = {};
  const artifactBytes = {};
  if (operation === 'remove') ids.forEach((id) => desired.delete(id));
  if (operation === 'apply') for (const integration of selected) {
    const source = await adapterBytes(root, integration);
    const adapter = renderAdapter(integration, platform, source);
    renderedAdapters[integration.id] = adapter;
    const existing = previous.find((entry) => entry.id === integration.id);
    const name = artifactName(integration);
    let bytes = null;
    const supplied = artifacts[integration.id];
    if (supplied !== undefined) {
      if (typeof supplied !== 'string' || !path.isAbsolute(supplied)) fail(`Artifact path for ${integration.id} must be absolute`);
      const info = await stat(supplied);
      if (!info || info.size !== integration.provenance.artifact.size) fail(`Artifact size mismatch for ${integration.id}`);
      bytes = await readRegular(supplied);
      verifyIntegrationArtifact(integration, bytes);
      artifactBytes[integration.id] = bytes;
    } else if (!existing || existing.artifact.digest !== (integration.provenance.artifact.integrity ?? integration.provenance.artifact.sha256)) {
      conflicts.push(`${integration.id}: provide its pinned artifact with --artifact ${integration.id}=<absolute-path>`);
    }
    desired.set(integration.id, {
      id: integration.id,
      enabled: integration.capabilities.filter((capability) => capability.enabled).map((capability) => capability.id).sort(),
      adapterFiles: Object.keys(adapter).sort(),
      adapterHash: adapterIds.has(integration.id) ? payloadHash(adapter) : digest(source),
      artifact: { name, size: integration.provenance.artifact.size,
        digest: integration.provenance.artifact.integrity ?? integration.provenance.artifact.sha256 },
      configuration: mcpIds.has(integration.id) ? { kind: platform === 'claude' ? 'json' : 'toml',
        path: path.relative(target, locations.configuration).split(path.sep).join('/'), owned: renderMcpConfiguration(platform, integration, source, hostPlatform) } : null,
    });
  }
  const entries = [...desired.values()].sort((a, b) => a.id.localeCompare(b.id));
  const observed = {};
  const observe = async (file) => { if (!Object.hasOwn(observed, file)) observed[file] = await optional(target, file); return observed[file]; };
  for (const entry of previous) {
    const artifact = path.join(locations.artifacts, entry.id, entry.artifact.name);
    const bytes = await observe(artifact);
    if (bytes === null || bytes.length !== entry.artifact.size || artifactDigest({ format: entry.artifact.digest.startsWith('sha512-') ? 'npm' : 'wheel' }, bytes) !== entry.artifact.digest) conflicts.push(`${entry.id}: owned artifact is missing or edited`);
    if (adapterIds.has(entry.id)) {
      const directory = path.join(locations.discovery, entry.id);
      try {
        const adapter = await treeFiles(directory);
        if (!equal(Object.keys(adapter).sort(), entry.adapterFiles) || payloadHash(adapter) !== entry.adapterHash) {
          conflicts.push(`${entry.id}: owned discovery adapter is missing or edited`);
        }
        for (const file of entry.adapterFiles) observed[path.join(directory, file)] = adapter[file];
      } catch { conflicts.push(`${entry.id}: owned discovery adapter is missing or edited`); }
    }
  }
  for (const entry of entries) if (!previous.some((item) => item.id === entry.id)) {
    const artifact = path.join(locations.artifacts, entry.id, entry.artifact.name);
    if (await observe(artifact) !== null) conflicts.push(`${entry.id}: unowned artifact collision`);
    if (adapterIds.has(entry.id)) {
      const directory = path.join(locations.discovery, entry.id);
      await assertSafeDirectory(target, locations.discovery);
      const names = await fs.readdir(locations.discovery).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
      if (await stat(directory) || names.some((name) => name.toLowerCase() === entry.id.toLowerCase())) conflicts.push(`${entry.id}: unowned discovery collision`);
    }
  }
  const managesConfiguration = [...previous, ...entries].some((entry) => entry.configuration);
  const configBefore = managesConfiguration ? await observe(locations.configuration) : null;
  const configAfter = managesConfiguration ? renderConfiguration(platform, configBefore, previous, entries, conflicts) : null;
  const nextReceipt = entries.length ? sealReceipt({ target, platform, scope, module: 'tool-integrations', profile: 'coexistence', entries }) : null;
  const operations = [];
  const add = async (id, file, after, receipt = false) => {
    const before = await observe(file);
    if (!sameBytes(before, after)) operations.push({ id, file, before, after, receipt });
  };
  for (const id of new Set([...previous.map((entry) => entry.id), ...entries.map((entry) => entry.id)])) {
    const before = previous.find((entry) => entry.id === id);
    const after = entries.find((entry) => entry.id === id);
    if (before && (!after || before.artifact.name !== after.artifact.name)) {
      await add(`${id}:artifact:${before.artifact.name}`, path.join(locations.artifacts, id, before.artifact.name), null);
    }
    if (after) {
      const artifact = path.join(locations.artifacts, id, after.artifact.name);
      await add(`${id}:artifact:${after.artifact.name}`, artifact, artifactBytes[id] ?? await observe(artifact));
    }
    if (adapterIds.has(id)) for (const file of new Set([...(before?.adapterFiles ?? []), ...(after?.adapterFiles ?? [])])) {
      await add(`${id}:adapter:${file}`, path.join(locations.discovery, id, file), after?.adapterFiles.includes(file)
        ? (renderedAdapters[id]?.[file] ?? await observe(path.join(locations.discovery, id, file))) : null);
    }
  }
  if (managesConfiguration) await add('mcp-configuration', locations.configuration, configAfter);
  await add('ownership', locations.ownership, nextReceipt ? ownershipHeadBytes(nextReceipt.evidence) : null);
  await add('receipt', locations.receipt, nextReceipt ? Buffer.from(encode(nextReceipt)) : null, true);
  const changes = operations.map(({ id, before, after }) => ({ id, action: after === null ? 'remove' : before === null ? 'create' : 'update' }));
  const states = entries.map((entry) => ({ id: entry.id, enabled: [...entry.enabled], ...integrationState(entry) }));
  const plan = { version: 1, module: 'tool-integrations', operation, target, platform, scope, profile: 'coexistence',
    installed: previous.length > 0, integrations: states, changes: operation === 'audit' ? [] : changes,
    conflicts, applicable: conflicts.length === 0, activation: 'Installation never starts a process, installs a hook, enables memory, or performs network access.',
    notes: ['Artifacts are caller-supplied and checked against the catalog size and digest before publication.',
      'Provisioned, configured, invocable and running are separate states; running is never inferred from a receipt.'] };
  plans.set(plan, { root, options: { ...options, target }, old, nextReceipt, operations,
    fingerprint: encode({ plan, observed: Object.fromEntries(Object.entries(observed).map(([file, bytes]) => [file, bytes === null ? null : digest(bytes)])) }) });
  return plan;
}

export async function applyIntegrationInstallation(candidate, { checkpoint = async () => {} } = {}) {
  const prepared = plans.get(candidate);
  if (!prepared) fail('Apply requires a fresh in-process integration plan');
  const fresh = await planIntegrationInstallation(prepared.root, prepared.options);
  if (!fresh.applicable) fail(`Integration conflicts: ${fresh.conflicts.join('; ')}`);
  if (fresh.operation === 'audit') fail('Audit is read-only');
  if (plans.get(fresh).fingerprint !== prepared.fingerprint) fail('Integration preconditions changed; plan again');
  if (!prepared.operations.length) return { ...fresh, applied: true, noOp: true };
  await fs.mkdir(fresh.target, { recursive: false }).catch((error) => { if (error.code !== 'EEXIST') throw error; });
  const lock = await acquireTargetLock(fresh.target);
  let staging;
  let retain = false;
  try {
    const locked = await planIntegrationInstallation(prepared.root, prepared.options);
    locked.conflicts = locked.conflicts.filter((entry) => !entry.startsWith('Target is locked'));
    locked.applicable = !locked.conflicts.length;
    const state = JSON.parse(plans.get(locked).fingerprint); state.plan = locked;
    const expected = JSON.parse(prepared.fingerprint); expected.plan = { ...fresh, conflicts: [], applicable: true };
    if (!equal(state, expected)) fail('Integration preconditions changed under lock');
    await checkpoint('locked');
    staging = await fs.mkdtemp(path.join(fresh.target, '.integration-stage-'));
    if (prepared.nextReceipt) await storeReceiptEvidence(fresh.target,
      layout(fresh.target, fresh.platform, fresh.scope).store, staging, prepared.nextReceipt);
    await publishFiles({ target: fresh.target, staging, operations: prepared.operations,
      journal: { version: 1, module: 'tool-integrations', changes: fresh.changes }, checkpoint });
    return { ...fresh, installed: Boolean(prepared.nextReceipt), applied: true, noOp: false };
  } catch (error) { retain = Boolean(error.recoveryRequired); throw error; }
  finally {
    if (!retain) {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
      await releaseTargetLock(lock);
    }
  }
}

const actionArguments = {
  graphify: {
    'build-code': (target) => ['extract', target, '--code-only'],
    refresh: (target) => ['update', target],
    cluster: (target) => ['cluster-only', target],
    query: (_target, operands) => ['query', operands[0]],
    path: (_target, operands) => ['path', operands[0], operands[1]],
    explain: (_target, operands) => ['explain', operands[0]],
    export: (_target, operands) => ['export', ...operands],
    'merge-graphs': (_target, operands) => ['merge-graphs', ...operands],
    'remote-ingest': (_target, operands) => ['add', ...operands],
    'database-connectors': (target, operands) => ['extract', target, ...operands],
    'community-labeling': (target, operands) => ['label', target, ...operands],
    'repository-clone': (_target, operands) => ['clone', ...operands],
    'pr-dashboard': (_target, operands) => ['prs', ...operands],
    'pr-triage': (_target, operands) => ['prs', '--triage', ...operands],
    'update-check': (target) => ['check-update', target],
    watch: (target) => [target, '--watch'],
    hooks: () => ['hook', 'install'],
    mcp: (target) => [target, '--mcp'],
    'global-graph': (_target, operands) => ['merge-graphs', ...operands],
    memory: (_target, operands) => ['save-result', ...operands],
    'semantic-media': (_target, operands) => ['add', ...operands],
  },
  archify: {
    doctor: () => ['doctor'],
    validate: (_target, operands) => ['validate', ...operands],
    render: (_target, operands) => ['render', ...operands],
    deliver: (_target, operands) => ['deliver', ...operands],
    preview: (_target, operands) => ['preview', ...operands],
    'update-check': () => ['doctor'],
  },
};

export function planIntegrationAction(installationPlan, { id, capability, operands = [] }) {
  if (!installationPlan || installationPlan.module !== 'tool-integrations' || !installationPlan.target) fail('Action requires a target integration plan');
  if (!Array.isArray(operands) || operands.length > 32
    || operands.some((entry) => typeof entry !== 'string' || !entry || entry.length > 4096 || /[\x00-\x1f]/.test(entry))) fail('Integration operands must be bounded literal non-empty strings');
  const entry = installationPlan.integrations.find((item) => item.id === id);
  if (!entry) fail(`Integration is not installed: ${id}`);
  if (!entry.enabled.includes(capability)) fail(`Integration capability is not enabled: ${id}:${capability}`);
  if (id === 'graphify' && capability === 'query-logging') {
    if (operands.length !== 1 || !path.isAbsolute(operands[0])) fail('Query logging requires one explicit absolute log path');
    return { id, capability, command: null, args: [], cwd: installationPlan.target, environment: { GRAPHIFY_QUERY_LOG: operands[0] },
      invocable: entry.invocable, mode: 'configure', authorized: true, running: false,
      note: 'This environment change is a separate explicit user action; installation does not enable query logging.' };
  }
  const builder = actionArguments[id]?.[capability];
  if (!builder) fail(`No invocation contract for ${id}:${capability}`);
  const args = builder(installationPlan.target, operands);
  if (args.some((argument) => argument === undefined)) fail(`Missing operand for ${id}:${capability}`);
  const locations = layout(installationPlan.target, installationPlan.platform, installationPlan.scope);
  const runtime = path.join(locations.store, 'runtime', id);
  const command = id === 'archify' ? 'node'
    : path.join(runtime, process.platform === 'win32' ? 'Scripts/graphify.exe' : 'bin/graphify');
  const literalArgs = id === 'archify' ? [path.join(runtime, 'bin/archify.mjs'), ...args] : args;
  return { id, capability, command, args: literalArgs, cwd: installationPlan.target, invocable: entry.invocable,
    mode: ['watch', 'hooks', 'mcp'].includes(capability) ? 'activate' : 'invoke', authorized: true, running: false,
    note: entry.invocable
      ? 'This plan contains a literal argument array; execution is a separate explicit user action.'
      : 'The adapter is authorized, but the distribution must be materialized into an executable runtime before this literal argument array can run.' };
}
