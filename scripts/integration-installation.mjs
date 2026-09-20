import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { loadIntegrationCatalog, planIntegrations } from './integration-catalog.mjs';
import { acquireTargetLock, digest, encode, payloadHash, publishFiles, readRegular, releaseTargetLock, stat, treeFiles } from './installation-core.mjs';
import { ownershipHeadBytes, sealReceipt, storeReceiptEvidence, verifyOwnershipHead, verifyReceiptEvidence } from './installation-evidence.mjs';
import { assertSafeDirectory, isPathWithin, parseSkill, renderSkillDocuments } from './skill-lib.mjs';
import { materializeIntegrationRuntime, renderRuntimeCommand, requiredRuntimeProfile } from './integration-runtime.mjs';

const plans = new WeakMap();
const sameBytes = (left, right) => left === null ? right === null : right !== null && left.equals(right);
const fail = (message) => { throw new Error(message); };
const adapterType = (integration) => integration.adapterKind ?? (typeof integration.adapter === 'string' ? 'skill' : 'mcp');

function layout(target, platform, scope) {
  const store = path.join(target, scope === 'project' ? '.harness' : '.ai-harness', 'installations', platform, 'integrations');
  return {
    store,
    receipt: path.join(store, 'receipt.json'),
    ownership: path.join(store, 'current.json'),
    artifacts: path.join(store, 'artifacts'),
    runtimes: path.join(store, 'runtime'),
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

function validateRuntime(runtime) {
  if (runtime === null) return;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)
    || !equal(Object.keys(runtime).sort(), ['command', 'entrypoint', 'fileCount', 'hash', 'kind', 'profile'].sort())
    || !['python-target', 'node-tree'].includes(runtime.kind) || typeof runtime.command !== 'string' || !runtime.command
    || typeof runtime.entrypoint !== 'string' || !runtime.entrypoint || typeof runtime.profile !== 'string' || !runtime.profile
    || !Number.isSafeInteger(runtime.fileCount) || runtime.fileCount < 1 || runtime.fileCount > 30_000
    || !/^[a-f0-9]{64}$/.test(runtime.hash)) fail('Malformed integration runtime receipt');
  if (runtime.kind === 'python-target' && !path.isAbsolute(runtime.command)) fail('Python runtime receipt requires an absolute interpreter');
  if (runtime.kind === 'node-tree' && !path.isAbsolute(runtime.command)) fail('Node runtime receipt requires an absolute interpreter');
  if (!/^[A-Za-z0-9@._/-]+$/.test(runtime.entrypoint)
    || runtime.entrypoint.split('/').some((part) => !part || part === '.' || part === '..')) fail('Unsafe integration runtime entrypoint');
}

function validateHooks(hooks) {
  if (hooks === null) return;
  if (!Array.isArray(hooks) || hooks.length !== 2) fail('Malformed integration hook receipt');
  const expected = ['.git/hooks/post-checkout', '.git/hooks/post-commit'];
  if (!equal(hooks.map((entry) => entry.path).sort(), expected)) fail('Malformed integration hook inventory');
  for (const hook of hooks) {
    if (!hook || typeof hook !== 'object' || Array.isArray(hook)
      || !equal(Object.keys(hook).sort(), ['mode', 'path', 'sha256'])
      || hook.mode !== 0o700 || !/^[a-f0-9]{64}$/.test(hook.sha256)) fail('Malformed integration hook receipt');
  }
}

function validateReceipt(receipt, target, platform, scope) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || !equal(Object.keys(receipt).sort(), ['entries', 'evidence', 'module', 'platform', 'profile', 'scope', 'target', 'version'].sort())
    || receipt.version !== 2 || receipt.module !== 'tool-integrations' || receipt.profile !== 'coexistence'
    || receipt.target !== target || receipt.platform !== platform || receipt.scope !== scope || !Array.isArray(receipt.entries)) fail('Malformed integration receipt');
  const ids = [];
  for (const entry of receipt.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || ![6, 7, 8].includes(Object.keys(entry).length)
      || Object.keys(entry).some((key) => !['adapterFiles', 'adapterHash', 'artifact', 'configuration', 'enabled', 'hooks', 'id', 'runtime'].includes(key))
      || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id)
      || !/^[a-f0-9]{64}$/.test(entry.adapterHash) || !Array.isArray(entry.adapterFiles)
      || !equal(entry.adapterFiles, [...new Set(entry.adapterFiles)].sort())
      || entry.adapterFiles.some((file) => !['SKILL.md', 'agents/openai.yaml'].includes(file)) || !Array.isArray(entry.enabled)
      || entry.enabled.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))) fail('Malformed integration receipt entry');
    const expectedAdapterFiles = ['archify', 'graphify'].includes(entry.id)
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
    validateRuntime(entry.runtime ?? null);
    validateHooks(entry.hooks ?? null);
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
  receipt.entries = receipt.entries.map((entry) => ({ ...entry, runtime: entry.runtime ?? null, hooks: entry.hooks ?? null }));
  return { receipt, bytes };
}

async function adapterBytes(root, integration) {
  const file = path.join(root, integration.adapter);
  await assertSafeDirectory(root, path.dirname(file));
  return await readRegular(file);
}

function renderAdapter(integration, platform, source) {
  if (adapterType(integration) !== 'skill') return {};
  const skill = parseSkill(source.toString('utf8'), integration.adapter);
  return Object.fromEntries(Object.entries(renderSkillDocuments(skill, platform, true))
    .map(([name, contents]) => [name, Buffer.from(contents)]));
}

const shellQuote = (value) => `'${value.replaceAll("'", `'"'"'`)}'`;

function renderGraphifyHooks(target, runtimeRoot, runtime) {
  if (!runtime || runtime.kind !== 'python-target') fail('Graphify hooks require a materialized Python runtime');
  const command = [shellQuote(runtime.command), '-B', '-m', 'graphify', 'update', shellQuote(target)].join(' ');
  const environment = `PYTHONDONTWRITEBYTECODE=1 GRAPHIFY_QUERY_LOG_DISABLE=1 PYTHONPATH=${shellQuote(path.join(runtimeRoot, 'site-packages'))}`;
  const body = Buffer.from(`#!/bin/sh\n${environment} exec ${command}\n`);
  return { 'post-checkout': body, 'post-commit': body };
}

export function renderMcpConfiguration(platform, integration, source, runtimeRoot, runtime = null) {
  if (adapterType(integration) !== 'mcp' && integration.id !== 'graphify') return null;
  const version = `${integration.runtime.package}@${integration.runtime.version}`;
  if (adapterType(integration) === 'mcp' && (!Buffer.isBuffer(source) || !source.includes(version))) fail('MCP adapter source differs from its runtime pin');
  if (!runtime) return null;
  const command = runtime.command;
  const args = runtime.kind === 'python-target'
    ? ['-B', '-m', integration.runtime.mcpModule]
    : [path.join(runtimeRoot, runtime.entrypoint)];
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

function integrationState(entry, invocable = entry.runtime !== null, plannedInvocable = false) {
  return { provisioned: true, configured: entry.adapterFiles.length > 0 || entry.configuration !== null || entry.hooks !== null,
    invocable, plannedInvocable: invocable || plannedInvocable, running: false,
    hooksActivated: entry.hooks !== null, runtime: entry.runtime ? structuredClone(entry.runtime) : null };
}

export async function planIntegrationInstallation(repository, options, internal = {}) {
  const { operation = 'apply', platform, scope, ids = [], enabled = [], artifacts = {}, target: suppliedTarget,
    materialize = false, allowNetwork = false, python = null } = options;
  if (!['apply', 'audit', 'remove'].includes(operation) || !['claude', 'codex'].includes(platform)
    || !['machine', 'project'].includes(scope) || typeof suppliedTarget !== 'string' || !path.isAbsolute(suppliedTarget)
    || !artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)
    || typeof materialize !== 'boolean' || typeof allowNetwork !== 'boolean'
    || (python !== null && (typeof python !== 'string' || !path.isAbsolute(python)))) fail('Integration lifecycle requires an absolute target, platform and scope');
  if (operation === 'audit' && (ids.length || enabled.length || Object.keys(artifacts).length || materialize || allowNetwork || python)) fail('Integration audit inspects the whole receipt');
  if (operation !== 'audit' && !ids.length) fail('Select at least one integration');
  if (operation === 'remove' && (enabled.length || Object.keys(artifacts).length || materialize || allowNetwork || python)) fail('Removal does not accept activation, materialization or artifact inputs');
  if (allowNetwork && !materialize) fail('--allow-network requires --materialize');
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
  const integrationsById = {};
  const runtimeReadiness = {};
  const hookPayloads = {};
  if (operation === 'remove') ids.forEach((id) => desired.delete(id));
  if (operation === 'apply') for (const integration of selected) {
    integrationsById[integration.id] = integration;
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
    const artifactChanged = !existing || existing.artifact.name !== name
      || existing.artifact.digest !== (integration.provenance.artifact.integrity ?? integration.provenance.artifact.sha256);
    let runtime = artifactChanged ? null : existing?.runtime ?? null;
    let runtimePayload = internal.runtimes?.[integration.id] ?? null;
    if (!runtimePayload && integration.runtime.kind === 'release-archive' && bytes) {
      runtimePayload = await materializeIntegrationRuntime({ integration, artifact: bytes });
    }
    if (runtimePayload) {
      if (!runtimePayload.files || !runtimePayload.metadata || runtimePayload.metadata.hash !== payloadHash(runtimePayload.files)) {
        fail(`Invalid prepared runtime for ${integration.id}`);
      }
      runtime = runtimePayload.metadata;
    }
    const active = integration.capabilities.filter((capability) => capability.enabled).map((capability) => capability.id).sort();
    const runtimeReady = runtime !== null && runtime.profile === requiredRuntimeProfile(integration, active);
    runtimeReadiness[integration.id] = runtimeReady;
    if (runtime !== null && !runtimeReady && !materialize) {
      conflicts.push(`${integration.id}: enabled capabilities require --materialize to refresh the owned runtime`);
    }
    const runtimeRoot = path.join(locations.runtimes, integration.id);
    const managesMcp = adapterType(integration) === 'mcp' || (integration.id === 'graphify' && active.includes('mcp'));
    let hooks = null;
    if (integration.id === 'graphify' && active.includes('hooks')) {
      if (scope !== 'project') conflicts.push('graphify: hooks require project scope');
      else if (runtimeReady) {
        const payload = renderGraphifyHooks(target, runtimeRoot, runtime);
        hookPayloads[integration.id] = payload;
        hooks = Object.entries(payload).map(([name, contents]) => ({
          path: `.git/hooks/${name}`, sha256: digest(contents), mode: 0o700,
        })).sort((a, b) => a.path.localeCompare(b.path));
      }
    }
    desired.set(integration.id, {
      id: integration.id,
      enabled: active,
      adapterFiles: Object.keys(adapter).sort(),
      adapterHash: adapterType(integration) === 'skill' ? payloadHash(adapter) : digest(source),
      artifact: { name, size: integration.provenance.artifact.size,
        digest: integration.provenance.artifact.integrity ?? integration.provenance.artifact.sha256 },
      runtime,
      hooks,
      configuration: managesMcp && runtimeReady ? { kind: platform === 'claude' ? 'json' : 'toml',
        path: path.relative(target, locations.configuration).split(path.sep).join('/'),
        owned: renderMcpConfiguration(platform, integration, source, runtimeRoot, runtime) } : null,
    });
    if (runtimePayload) {
      internal.runtimes ??= {};
      internal.runtimes[integration.id] = runtimePayload;
    }
  }
  const entries = [...desired.values()].sort((a, b) => a.id.localeCompare(b.id));
  const observed = {};
  const runtimeTrees = {};
  const observe = async (file) => { if (!Object.hasOwn(observed, file)) observed[file] = await optional(target, file); return observed[file]; };
  for (const entry of previous) {
    const artifact = path.join(locations.artifacts, entry.id, entry.artifact.name);
    const bytes = await observe(artifact);
    if (bytes === null || bytes.length !== entry.artifact.size || artifactDigest({ format: entry.artifact.digest.startsWith('sha512-') ? 'npm' : 'wheel' }, bytes) !== entry.artifact.digest) conflicts.push(`${entry.id}: owned artifact is missing or edited`);
    if (entry.adapterFiles.length) {
      const directory = path.join(locations.discovery, entry.id);
      try {
        const adapter = await treeFiles(directory);
        if (!equal(Object.keys(adapter).sort(), entry.adapterFiles) || payloadHash(adapter) !== entry.adapterHash) {
          conflicts.push(`${entry.id}: owned discovery adapter is missing or edited`);
        }
        for (const file of entry.adapterFiles) observed[path.join(directory, file)] = adapter[file];
      } catch { conflicts.push(`${entry.id}: owned discovery adapter is missing or edited`); }
    }
    if (entry.runtime) {
      const directory = path.join(locations.runtimes, entry.id);
      try {
        const runtime = await treeFiles(directory);
        runtimeTrees[entry.id] = runtime;
        if (Object.keys(runtime).length !== entry.runtime.fileCount || payloadHash(runtime) !== entry.runtime.hash) {
          conflicts.push(`${entry.id}: owned runtime is missing or edited`);
        }
        for (const [file, contents] of Object.entries(runtime)) observed[path.join(directory, file)] = contents;
      } catch { conflicts.push(`${entry.id}: owned runtime is missing or edited`); }
    }
    for (const hook of entry.hooks ?? []) {
      const file = path.join(target, ...hook.path.split('/'));
      try {
        const contents = await observe(file);
        const info = await stat(file);
        if (contents === null || digest(contents) !== hook.sha256 || !info?.isFile() || (info.mode & 0o777) !== hook.mode) {
          conflicts.push(`${entry.id}: owned Git hook is missing or edited`);
        }
      } catch { conflicts.push(`${entry.id}: owned Git hook is missing or edited`); }
    }
  }
  for (const entry of entries) if (!previous.some((item) => item.id === entry.id)) {
    const artifact = path.join(locations.artifacts, entry.id, entry.artifact.name);
    if (await observe(artifact) !== null) conflicts.push(`${entry.id}: unowned artifact collision`);
    if (entry.adapterFiles.length) {
      const directory = path.join(locations.discovery, entry.id);
      await assertSafeDirectory(target, locations.discovery);
      const names = await fs.readdir(locations.discovery).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
      if (await stat(directory) || names.some((name) => name.toLowerCase() === entry.id.toLowerCase())) conflicts.push(`${entry.id}: unowned discovery collision`);
    }
    if (entry.runtime && await stat(path.join(locations.runtimes, entry.id))) conflicts.push(`${entry.id}: unowned runtime collision`);
  }
  for (const entry of entries) if (entry.hooks) {
    const before = previous.find((item) => item.id === entry.id);
    const previouslyOwned = new Set((before?.hooks ?? []).map((hook) => hook.path));
    const git = await stat(path.join(target, '.git'));
    if (!git?.isDirectory() || git.isSymbolicLink()) conflicts.push(`${entry.id}: owned hooks require a regular project .git directory`);
    for (const hook of entry.hooks) if (!previouslyOwned.has(hook.path)
      && await observe(path.join(target, ...hook.path.split('/'))) !== null) conflicts.push(`${entry.id}: unowned Git hook collision`);
  }
  const managesConfiguration = [...previous, ...entries].some((entry) => entry.configuration);
  const configBefore = managesConfiguration ? await observe(locations.configuration) : null;
  const configAfter = managesConfiguration ? renderConfiguration(platform, configBefore, previous, entries, conflicts) : null;
  const nextReceipt = entries.length ? sealReceipt({ target, platform, scope, module: 'tool-integrations', profile: 'coexistence', entries }) : null;
  const operations = [];
  const add = async (id, file, after, receipt = false, mode = undefined) => {
    const before = await observe(file);
    if (!sameBytes(before, after)) operations.push({ id, file, before, after, receipt, mode });
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
    if ((before?.adapterFiles.length ?? 0) || (after?.adapterFiles.length ?? 0)) for (const file of new Set([...(before?.adapterFiles ?? []), ...(after?.adapterFiles ?? [])])) {
      await add(`${id}:adapter:${file}`, path.join(locations.discovery, id, file), after?.adapterFiles.includes(file)
        ? (renderedAdapters[id]?.[file] ?? await observe(path.join(locations.discovery, id, file))) : null);
    }
    const beforeRuntime = before?.runtime ? runtimeTrees[id] ?? {} : {};
    const afterRuntime = after?.runtime ? internal.runtimes?.[id]?.files
      ?? (before?.runtime?.hash === after.runtime.hash ? beforeRuntime : null) : {};
    if (after?.runtime && !afterRuntime) fail(`Prepared runtime files are missing for ${id}`);
    for (const file of new Set([...Object.keys(beforeRuntime), ...Object.keys(afterRuntime ?? {})])) {
      await add(`${id}:runtime:${file}`, path.join(locations.runtimes, id, file), afterRuntime?.[file] ?? null);
    }
    const beforeHooks = new Map((before?.hooks ?? []).map((hook) => [hook.path, hook]));
    const afterHooks = new Map((after?.hooks ?? []).map((hook) => [hook.path, hook]));
    for (const hookPath of new Set([...beforeHooks.keys(), ...afterHooks.keys()])) {
      const name = path.basename(hookPath);
      const afterHook = afterHooks.get(hookPath);
      await add(`${id}:hook:${name}`, path.join(target, ...hookPath.split('/')), afterHook
        ? hookPayloads[id]?.[name] ?? await observe(path.join(target, ...hookPath.split('/'))) : null,
      false, afterHook?.mode);
    }
  }
  if (managesConfiguration) await add('mcp-configuration', locations.configuration, configAfter);
  await add('ownership', locations.ownership, nextReceipt ? ownershipHeadBytes(nextReceipt.evidence) : null);
  await add('receipt', locations.receipt, nextReceipt ? Buffer.from(encode(nextReceipt)) : null, true);
  const changes = operations.map(({ id, before, after }) => ({ id, action: after === null ? 'remove' : before === null ? 'create' : 'update' }));
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const states = entries.map((entry) => ({ id: entry.id, enabled: [...entry.enabled],
    ...integrationState(entry, runtimeReadiness[entry.id] ?? (entry.runtime !== null), materialize && selectedIds.has(entry.id)) }));
  const plan = { version: 1, module: 'tool-integrations', operation, target, platform, scope, profile: 'coexistence',
    installed: previous.length > 0, integrations: states, changes: operation === 'audit' ? [] : changes,
    conflicts, applicable: conflicts.length === 0, activation: 'Installation never starts a process, installs a hook, enables memory, or performs network access.',
    notes: ['Artifacts are caller-supplied and checked against the catalog size and digest before publication.',
      materialize ? 'Materialization is explicitly requested; network access remains denied unless --allow-network is also present.'
        : 'Use --materialize to build an owned executable runtime from the pinned artifact and lock resources.',
      'Provisioned, configured, invocable and running are separate states; running is never inferred from a receipt.'] };
  plans.set(plan, { root, options: { ...options, target }, old, nextReceipt, operations, selected, artifactBytes, integrationsById,
    fingerprint: encode({ plan, observed: Object.fromEntries(Object.entries(observed).map(([file, bytes]) => [file, bytes === null ? null : digest(bytes)])) }) });
  return plan;
}

export async function applyIntegrationInstallation(candidate, { checkpoint = async () => {}, materializer = materializeIntegrationRuntime } = {}) {
  const prepared = plans.get(candidate);
  if (!prepared) fail('Apply requires a fresh in-process integration plan');
  const fresh = await planIntegrationInstallation(prepared.root, prepared.options);
  if (!fresh.applicable) fail(`Integration conflicts: ${fresh.conflicts.join('; ')}`);
  if (fresh.operation === 'audit') fail('Audit is read-only');
  if (plans.get(fresh).fingerprint !== prepared.fingerprint) fail('Integration preconditions changed; plan again');
  if (!prepared.operations.length && !prepared.options.materialize) return { ...fresh, applied: true, noOp: true };
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
    let publication = prepared;
    let result = fresh;
    if (prepared.options.materialize) {
      const runtimes = {};
      const locations = layout(fresh.target, fresh.platform, fresh.scope);
      for (const integration of prepared.selected) {
        const previous = prepared.old.receipt?.entries.find((entry) => entry.id === integration.id);
        const artifact = prepared.artifactBytes[integration.id]
          ?? await readRegular(path.join(locations.artifacts, integration.id, previous?.artifact.name ?? artifactName(integration)));
        const runtimeStage = path.join(staging, `runtime-${integration.id}`);
        await fs.mkdir(runtimeStage, { mode: 0o700 });
        runtimes[integration.id] = await materializer({ repository: prepared.root, integration, artifact,
          enabled: integration.capabilities.filter((entry) => entry.enabled).map((entry) => entry.id),
          staging: runtimeStage, python: prepared.options.python, allowNetwork: prepared.options.allowNetwork });
      }
      result = await planIntegrationInstallation(prepared.root, prepared.options, { runtimes });
      result.conflicts = result.conflicts.filter((entry) => !entry.startsWith('Target is locked'));
      result.applicable = !result.conflicts.length;
      if (!result.applicable) fail(`Integration conflicts: ${result.conflicts.join('; ')}`);
      publication = plans.get(result);
    }
    if (publication.nextReceipt) await storeReceiptEvidence(fresh.target,
      layout(fresh.target, fresh.platform, fresh.scope).store, staging, publication.nextReceipt);
    await publishFiles({ target: fresh.target, staging, operations: publication.operations,
      journal: { version: 1, module: 'tool-integrations', changes: result.changes }, checkpoint });
    return { ...result, installed: Boolean(publication.nextReceipt), applied: true, noOp: false };
  } catch (error) { retain = Boolean(error.recoveryRequired); throw error; }
  finally {
    if (!retain) {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
      await releaseTargetLock(lock);
    }
  }
}

export function planIntegrationAction(installationPlan, { id, capability, operands = [] }) {
  if (!installationPlan || installationPlan.module !== 'tool-integrations' || !installationPlan.target) fail('Action requires a target integration plan');
  if (!Array.isArray(operands) || operands.length > 32
    || operands.some((entry) => typeof entry !== 'string' || !entry || entry.length > 4096 || /[\x00-\x1f]/.test(entry))) fail('Integration operands must be bounded literal non-empty strings');
  const entry = installationPlan.integrations.find((item) => item.id === id);
  if (!entry) fail(`Integration is not installed: ${id}`);
  if (!entry.enabled.includes(capability)) fail(`Integration capability is not enabled: ${id}:${capability}`);
  const locations = layout(installationPlan.target, installationPlan.platform, installationPlan.scope);
  if (!entry.runtime || !entry.invocable) fail(`Integration runtime is not materialized for its enabled capabilities: ${id}`);
  if (id === 'graphify' && capability === 'query-logging') {
    if (operands.length !== 1 || !path.isAbsolute(operands[0])) fail('Query logging requires one explicit absolute log path');
    return { id, capability, command: null, args: [], cwd: installationPlan.target, environment: { GRAPHIFY_QUERY_LOG: operands[0] },
      invocable: entry.invocable, mode: 'configure', authorized: true, running: false,
      note: 'This environment change is a separate explicit user action; installation does not enable query logging.' };
  }
  if (id === 'graphify' && capability === 'hooks') return { id, capability, command: null, args: [], environment: {},
    cwd: installationPlan.target, invocable: true, mode: 'configured', authorized: true, running: false,
    note: 'Graphify hooks are already lifecycle-owned; vendor hook installation is never invoked.' };
  const invocation = renderRuntimeCommand(entry, path.join(locations.runtimes, id), capability, operands, installationPlan.target);
  return { id, capability, ...invocation, cwd: installationPlan.target, invocable: true,
    mode: ['watch', 'hooks', 'mcp'].includes(capability) ? 'activate' : 'invoke', authorized: true, running: false,
    note: 'This plan contains a literal argument array; execution is a separate explicit user action.' };
}
