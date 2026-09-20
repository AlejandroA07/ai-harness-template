import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseSkill, assertSafeDirectory } from './skill-lib.mjs';
import { readRegular } from './installation-core.mjs';

const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const platforms = ['claude', 'codex'];
const scopes = ['machine', 'project'];
const targets = platforms.flatMap((platform) => scopes.map((scope) => `${platform}:${scope}`));
const runtimeKinds = ['npm-package', 'python-wheel', 'release-archive'];
const formats = ['npm', 'wheel', 'zip'];
const modes = ['invoke', 'activate', 'configure'];
const defaults = ['enabled', 'disabled'];
const networkModes = ['none', 'upstash', 'browser-selected-destinations', 'selected-model-provider', 'vendor-release', 'user-selected-source', 'user-selected-destination', 'github'];
const modelModes = ['none', 'required', 'agent-authored-input'];

function fail(message) { throw new Error(message); }
function record(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !fields.includes(key))) fail(`Invalid ${label}`);
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) fail(`Invalid ${label}`);
}
function id(value) { if (typeof value !== 'string' || !idPattern.test(value)) fail('Invalid integration ID'); }
function array(value, validate, label, nonempty = false) {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail(`Invalid ${label}`);
  value.forEach(validate);
  if (new Set(value.map((entry) => JSON.stringify(entry))).size !== value.length) fail(`Duplicate ${label}`);
}
function choices(value, allowed, label) {
  array(value, (entry) => { if (!allowed.includes(entry)) fail(`Unsupported ${label}`); }, label, true);
}
function localPath(value, roots) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9.@_/-]+$/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')
    || !roots.includes(value.split('/')[0])) fail('Unsafe integration path');
}
function secureUrl(value, hosts) {
  let url;
  try { url = new URL(value); } catch { fail('Invalid integration artifact URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.includes(url.hostname)) {
    fail('Untrusted integration artifact URL');
  }
}

function runtimeResource(resource) {
  record(resource, ['path', 'sha256', 'profile'], 'integration runtime resource');
  localPath(resource.path, ['integrations']);
  if (!/^[a-f0-9]{64}$/.test(resource.sha256 ?? '')) fail('Invalid integration runtime resource digest');
  text(resource.profile, 'integration runtime resource profile');
}

export function validateIntegrationCatalog(catalog) {
  record(catalog, ['version', 'integrations'], 'integration catalog');
  if (catalog.version !== 1) fail('Unsupported integration catalog version');
  const ids = new Set();
  array(catalog.integrations, (integration) => {
    record(integration, ['id', 'label', 'description', 'platforms', 'scopes', 'targets', 'adapter', 'runtime', 'provenance', 'capabilities', 'safeguards'], 'integration');
    id(integration.id);
    if (ids.has(integration.id)) fail(`Duplicate integration ID: ${integration.id}`);
    ids.add(integration.id);
    text(integration.label, 'integration label');
    text(integration.description, 'integration description');
    choices(integration.platforms, platforms, 'integration platform');
    choices(integration.scopes, scopes, 'integration scope');
    choices(integration.targets, targets, 'integration target');
    if (integration.targets.some((target) => {
      const [platform, scope] = target.split(':');
      return !integration.platforms.includes(platform) || !integration.scopes.includes(scope);
    })) fail('Integration target exceeds declared platform or scope');
    if (typeof integration.adapter === 'string') localPath(integration.adapter, ['integrations']);
    else {
      record(integration.adapter, integration.platforms, 'platform adapters');
      for (const platform of integration.platforms) localPath(integration.adapter[platform], ['components']);
    }
    record(integration.runtime, ['kind', 'command', 'package', 'entrypoint', 'module', 'mcpModule', 'version', 'minimumRuntime', 'resources'], 'integration runtime');
    if (!runtimeKinds.includes(integration.runtime.kind)) fail('Unsupported integration runtime');
    text(integration.runtime.command, 'runtime command');
    text(integration.runtime.version, 'runtime version');
    text(integration.runtime.minimumRuntime, 'minimum runtime');
    if (integration.runtime.kind === 'release-archive') {
      if (Object.hasOwn(integration.runtime, 'package') || Object.hasOwn(integration.runtime, 'resources')) fail('Archive runtime cannot declare package resources');
      text(integration.runtime.entrypoint, 'archive runtime entrypoint');
      localPath(integration.runtime.entrypoint, ['bin']);
    } else {
      text(integration.runtime.package, 'runtime package');
      array(integration.runtime.resources, runtimeResource, 'integration runtime resources', true);
      if (integration.runtime.kind === 'npm-package') {
        text(integration.runtime.entrypoint, 'npm runtime entrypoint');
        localPath(integration.runtime.entrypoint, ['node_modules']);
      } else {
        text(integration.runtime.module, 'Python runtime module');
        text(integration.runtime.mcpModule, 'Python MCP runtime module');
        if (!/^[a-z][a-z0-9_.]+$/.test(integration.runtime.module)
          || !/^[a-z][a-z0-9_.]+$/.test(integration.runtime.mcpModule)
          || integration.runtime.resources.map((entry) => entry.profile).sort().join(',') !== 'all,base') {
          fail('Invalid Python integration runtime contract');
        }
      }
    }

    record(integration.provenance, ['mode', 'repository', 'reviewedCommit', 'upstreamPath', 'localPath', 'release', 'license', 'notices', 'artifact'], 'integration provenance');
    if (integration.provenance.mode !== 'adapted') fail('Executable integrations require an adapted local boundary');
    secureUrl(integration.provenance.repository, ['github.com']);
    if (integration.provenance.reviewedCommit !== null
      && !/^[a-f0-9]{40}$/.test(integration.provenance.reviewedCommit)) fail('Invalid reviewed integration revision');
    text(integration.provenance.release, 'integration release');
    text(integration.provenance.license, 'integration license');
    localPath(integration.provenance.upstreamPath, [integration.provenance.upstreamPath.split('/')[0]]);
    if (typeof integration.adapter === 'string') {
      if (integration.provenance.localPath !== integration.adapter) fail('Integration local provenance path differs from its adapter');
    } else if (integration.provenance.localPath !== 'components/mcp') fail('MCP integrations must identify their shared adapter boundary');
    array(integration.provenance.notices, (entry) => text(entry, 'integration notice'), 'integration notices', true);
    const artifact = integration.provenance.artifact;
    record(artifact, ['url', 'sha256', 'integrity', 'size', 'format', 'root'], 'integration artifact');
    if (!formats.includes(artifact.format)) fail('Unsupported integration artifact format');
    const allowedHosts = artifact.format === 'npm' ? ['registry.npmjs.org']
      : artifact.format === 'wheel' ? ['files.pythonhosted.org'] : ['github.com'];
    secureUrl(artifact.url, allowedHosts);
    if (!Number.isSafeInteger(artifact.size) || artifact.size < 1 || artifact.size > 20_000_000) fail('Invalid integration artifact size');
    if (artifact.format === 'npm') {
      if (typeof artifact.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(artifact.integrity)
        || Object.hasOwn(artifact, 'sha256')) fail('Invalid npm artifact integrity');
    } else if (!/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '') || Object.hasOwn(artifact, 'integrity')) {
      fail('Invalid integration artifact digest');
    }
    if (artifact.format === 'zip') {
      if (typeof artifact.root !== 'string') fail('Archive artifact requires a root');
      localPath(artifact.root, ['archify']);
    } else if (Object.hasOwn(artifact, 'root')) fail('Only archive artifacts declare a root');

    const featureIds = new Set();
    array(integration.capabilities, (capability) => {
      record(capability, ['id', 'mode', 'default', 'network', 'model', 'writes'], 'integration capability');
      id(capability.id);
      if (featureIds.has(capability.id)) fail(`Duplicate integration capability: ${capability.id}`);
      featureIds.add(capability.id);
      if (!modes.includes(capability.mode) || !defaults.includes(capability.default)
        || !networkModes.includes(capability.network) || !modelModes.includes(capability.model)) {
        fail('Invalid integration capability behavior');
      }
      array(capability.writes, (entry) => text(entry, 'integration write'), 'integration writes');
    }, 'integration capabilities', true);
    record(integration.safeguards, ['automaticHooks', 'automaticWatch', 'automaticMemory', 'automaticNetwork'], 'integration safeguards');
    if (Object.values(integration.safeguards).some((value) => value !== false)) fail('Integrations cannot activate automatically');
    const memory = integration.capabilities.find((entry) => entry.id === 'memory');
    if (memory && memory.default !== 'disabled') fail('Integration memory must default off');
  }, 'integrations', true);
  return catalog;
}

async function readSource(root, relative) {
  const file = path.join(root, relative);
  await assertSafeDirectory(root, path.dirname(file));
  return await readRegular(file);
}

export async function loadIntegrationCatalog(repositoryRoot) {
  const root = await fs.realpath(repositoryRoot);
  const catalog = validateIntegrationCatalog(JSON.parse((await readSource(root, 'catalog/integrations.json')).toString('utf8')));
  for (const integration of catalog.integrations) {
    for (const resource of integration.runtime.resources ?? []) {
      const bytes = await readSource(root, resource.path);
      const actual = crypto.createHash('sha256').update(bytes).digest('hex');
      if (actual !== resource.sha256) fail(`Integration runtime resource drifted: ${resource.path}`);
    }
    if (typeof integration.adapter === 'string') {
      const contents = (await readSource(root, integration.adapter)).toString('utf8');
      const skill = parseSkill(contents, integration.adapter);
      if (skill.name !== integration.id || !contents.includes(integration.runtime.version)) fail('Integration adapter must match its ID and runtime pin');
    } else for (const platform of integration.platforms) {
      const bytes = (await readSource(root, integration.adapter[platform])).toString('utf8');
      const version = `${integration.runtime.package}@${integration.runtime.version}`;
      if (!bytes.includes(version) || !bytes.includes(integration.id)) fail(`Integration adapter differs from ${integration.id} runtime pin`);
      if (platform === 'claude') {
        let parsed;
        try { parsed = JSON.parse(bytes); } catch { fail('Invalid Claude MCP adapter'); }
        if (JSON.stringify(Object.keys(parsed)) !== JSON.stringify(['mcpServers'])
          || JSON.stringify(Object.keys(parsed.mcpServers)) !== JSON.stringify([integration.id])) fail('Invalid Claude MCP adapter ownership');
        const expected = { command: 'npx', args: ['-y', version] };
        if (JSON.stringify(parsed.mcpServers[integration.id]) !== JSON.stringify(expected)) fail('Invalid Claude MCP adapter command');
      } else {
        const expected = `[mcp_servers.${integration.id}]\ncommand = "npx"\nargs = ["-y", "${version}"]\n`;
        if (bytes !== expected) fail('Invalid Codex MCP adapter ownership');
      }
    }
  }
  return catalog;
}

export function planIntegrations(catalog, selection) {
  validateIntegrationCatalog(catalog);
  record(selection, ['ids', 'platform', 'scope', 'enabled'], 'integration selection');
  array(selection.ids, id, 'selected integrations');
  if (!platforms.includes(selection.platform) || !scopes.includes(selection.scope)) fail('Unsupported integration target');
  array(selection.enabled, (entry) => {
    if (typeof entry !== 'string' || !/^([a-z0-9][a-z0-9-]{0,63}):([a-z0-9][a-z0-9-]{0,63})$/.test(entry)) {
      fail('Invalid enabled integration capability');
    }
  }, 'enabled integration capabilities');
  const requested = selection.ids.length ? [...selection.ids].sort()
    : catalog.integrations.filter((entry) => entry.targets.includes(`${selection.platform}:${selection.scope}`)).map((entry) => entry.id).sort();
  const selected = requested.map((name) => {
    const integration = catalog.integrations.find((entry) => entry.id === name);
    if (!integration) fail(`Unknown integration: ${name}`);
    if (!integration.targets.includes(`${selection.platform}:${selection.scope}`)) {
      fail(`Unsupported platform/scope selection for ${name}`);
    }
    const enabled = new Set(selection.enabled.filter((entry) => entry.startsWith(`${name}:`)).map((entry) => entry.slice(name.length + 1)));
    for (const capability of enabled) {
      if (!integration.capabilities.some((entry) => entry.id === capability)) fail(`Unknown ${name} capability: ${capability}`);
    }
    return { ...structuredClone(integration), adapterKind: typeof integration.adapter === 'string' ? 'skill' : 'mcp', adapter: typeof integration.adapter === 'string'
      ? integration.adapter : integration.adapter[selection.platform],
      capabilities: integration.capabilities.map((capability) => ({ ...capability,
        enabled: capability.default === 'enabled' || enabled.has(capability.id),
        activation: capability.default === 'enabled' ? 'selection-default' : enabled.has(capability.id) ? 'explicit' : 'disabled' })) };
  });
  const selectedNames = new Set(requested);
  for (const entry of selection.enabled) if (!selectedNames.has(entry.split(':')[0])) fail('Enabled capability belongs to an unselected integration');
  return { version: 1, stage: 'selection-only', module: 'tool-integrations', platform: selection.platform, scope: selection.scope,
    requested, integrations: selected, applicable: false, targetPreflight: 'not-performed',
    notes: ['Read-only integration preview; no artifact was downloaded, process started, settings changed or runtime activated.',
      'Disabled capabilities require an explicit --enable <integration>:<capability> selection.',
      'Provisioned, configured, invocable and running are reported separately by target lifecycle preflight.'] };
}
