import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from './catalog-loader.mjs';
import { planSelection } from './module-catalog.mjs';
import { loadIntegrationCatalog, planIntegrations } from './integration-catalog.mjs';
import { planInstallation } from './selection-installation.mjs';
import { planGlobalInstallation } from './global-installation.mjs';
import { planProjectInstallation } from './project-installation.mjs';
import { planIntegrationInstallation } from './integration-installation.mjs';
import { buildCostInventory } from './cost-inventory.mjs';

const platforms = ['claude', 'codex'];
const scopes = ['machine', 'project'];
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const fail = (message) => { throw new Error(message); };
const sourceId = (source) => `source:${source}`;
const platformId = (module, platform) => `platform:${module}:${platform}`;
const capabilityId = (id) => `capability:${id}`;
const integrationId = (id) => `integration:${id}`;
const integrationCapabilityId = (integration, capability) => `integration-capability:${integration}:${capability}`;

function state(planned, installed, observed) {
  return { planned, installed, observed };
}
function plannedState(context, selected) {
  return context ? (selected ? 'selected' : 'not-selected') : 'not-evaluated';
}
function installedState(target, installed) {
  return target ? (installed ? 'installed' : 'not-installed') : 'not-inspected';
}
function observedState(target, installed, audit) {
  if (!target) return 'not-inspected';
  if (!installed) return 'absent';
  return audit?.applicable ? 'consistent' : 'conflict';
}
function addSource(nodes, edges, from, source, relationship = 'sourced-by') {
  const id = sourceId(source);
  if (!nodes.has(id)) nodes.set(id, { id, kind: 'source', label: source, source, state: state('not-applicable', 'not-applicable', 'present') });
  edges.push({ from, to: id, type: relationship, provenance: 'declared' });
}
function auditForModule(module, audits) {
  if (module === 'global-configuration') return audits.global;
  if (module === 'project-configuration') return audits.project;
  if (['skills', 'workflows'].includes(module)) return audits.skills;
  if (module === 'tool-integrations') return audits.integrations;
  return null;
}

async function inspectTarget(repositoryRoot, context) {
  if (!context.target) return {};
  const common = { operation: 'audit', target: context.target, platform: context.platform, scope: context.scope };
  const audits = {
    skills: await planInstallation(repositoryRoot, { ...common, ids: [] }),
    integrations: await planIntegrationInstallation(repositoryRoot, { ...common, ids: [], enabled: [], artifacts: {}, materialize: false, allowNetwork: false, python: null }),
  };
  if (context.scope === 'machine') audits.global = await planGlobalInstallation(repositoryRoot, common);
  else audits.project = await planProjectInstallation(repositoryRoot, common);
  return audits;
}

export async function buildArchitectureModel(repositoryRoot, options = {}) {
  const root = await fs.realpath(repositoryRoot);
  const selections = options.selections ?? [];
  const selectedModules = options.modules ?? [];
  const enabled = options.enabled ?? [];
  if (![selections, selectedModules, enabled].every(Array.isArray)
    || [...selections, ...selectedModules].some((entry) => typeof entry !== 'string' || !idPattern.test(entry))) fail('Invalid architecture selection');
  const hasContext = options.platform !== undefined || options.scope !== undefined || options.target !== undefined
    || selections.length || selectedModules.length || enabled.length;
  if (hasContext && (!platforms.includes(options.platform) || !scopes.includes(options.scope))) fail('Architecture target or plan requires one --platform and --scope');
  if (options.target !== undefined && (typeof options.target !== 'string' || !path.isAbsolute(options.target) || /[\x00-\x1f\x7f]/.test(options.target))) fail('Architecture target must be an absolute safe path');
  const context = hasContext ? { platform: options.platform, scope: options.scope, target: options.target ?? null } : null;

  const catalog = await loadCatalog(root);
  const integrationCatalog = await loadIntegrationCatalog(root);
  const costs = await buildCostInventory(root, catalog, integrationCatalog);
  const moduleNames = new Set(catalog.modules.map((entry) => entry.id));
  if (selectedModules.some((entry) => !moduleNames.has(entry))) fail('Unknown architecture module selection');
  const publicModules = new Set(catalog.modules.filter((entry) => entry.visibility === 'public').map((entry) => entry.id));
  if (selectedModules.some((entry) => !publicModules.has(entry))) fail('Internal modules are not selectable');
  if (context && selectedModules.some((name) => {
    const module = catalog.modules.find((entry) => entry.id === name);
    return !module.platforms.includes(context.platform) || !module.scopes.includes(context.scope);
  })) fail('Unsupported platform/scope architecture module selection');
  const knownCapabilities = new Set(catalog.capabilities.map((entry) => entry.id));
  const knownIntegrations = new Set(integrationCatalog.integrations.map((entry) => entry.id));
  const capabilitySelections = selections.filter((entry) => knownCapabilities.has(entry));
  const integrationSelections = selections.filter((entry) => knownIntegrations.has(entry));
  if (selections.some((entry) => !knownCapabilities.has(entry) && !knownIntegrations.has(entry))) fail('Unknown architecture capability or integration selection');
  if (new Set(selections).size !== selections.length || new Set(selectedModules).size !== selectedModules.length) fail('Duplicate architecture selection');

  const capabilityModules = selectedModules.filter((entry) => ['skills', 'workflows'].includes(entry));
  const capabilityPlan = capabilitySelections.length || capabilityModules.length
    ? planSelection(catalog, { ids: capabilitySelections, modules: capabilityModules, platforms: [context.platform], scope: context.scope }) : null;
  const wantsIntegrations = integrationSelections.length || selectedModules.includes('tool-integrations');
  const integrationPlan = wantsIntegrations || enabled.length
    ? planIntegrations(integrationCatalog, { ids: integrationSelections, platform: context.platform, scope: context.scope, enabled }) : null;
  const plannedCapabilities = new Set(capabilityPlan?.capabilities.map((entry) => entry.id) ?? []);
  const plannedIntegrations = new Map((integrationPlan?.integrations ?? []).map((entry) => [entry.id, entry]));
  const audits = await inspectTarget(root, context ?? {});
  const installedCapabilities = new Set(audits.skills?.entries.map((entry) => entry.id) ?? []);
  const installedIntegrations = new Map((audits.integrations?.integrations ?? []).map((entry) => [entry.id, entry]));
  const costByCapability = new Map(costs.capabilities.map((entry) => [entry.id, entry]));
  const nodes = new Map();
  const edges = [];
  nodes.set('harness', { id: 'harness', kind: 'root', label: 'Harness', state: state('not-applicable', 'not-applicable', 'declared') });

  for (const module of catalog.modules) {
    const audit = auditForModule(module.id, audits);
    const configInstalled = module.id === 'global-configuration' ? Boolean(audits.global?.installed)
      : module.id === 'project-configuration' ? Boolean(audits.project?.installed) : false;
    const memberInstalled = module.id === 'tool-integrations' ? installedIntegrations.size > 0
      : ['skills', 'workflows'].includes(module.id) && catalog.capabilities.some((entry) => entry.module === module.id && installedCapabilities.has(entry.id));
    const selected = selectedModules.includes(module.id)
      || (['skills', 'workflows'].includes(module.id) && catalog.capabilities.some((entry) => entry.module === module.id && plannedCapabilities.has(entry.id)))
      || (module.id === 'tool-integrations' && plannedIntegrations.size > 0);
    const installed = configInstalled || memberInstalled;
    nodes.set(`module:${module.id}`, { id: `module:${module.id}`, kind: 'module', label: module.label, module: module.id,
      visibility: module.visibility, description: module.description, platforms: [...module.platforms], scopes: [...module.scopes],
      state: state(plannedState(context, selected), installedState(context?.target, installed), observedState(context?.target, installed, audit)) });
    edges.push({ from: 'harness', to: `module:${module.id}`, type: 'contains', provenance: 'declared' });
    for (const dependency of module.requires) edges.push({ from: `module:${module.id}`, to: `module:${dependency}`, type: 'depends-on', provenance: 'declared' });
    for (const platform of module.platforms) {
      const id = platformId(module.id, platform);
      nodes.set(id, { id, kind: 'platform', label: platform, module: module.id, platform, scopes: [...module.scopes],
        state: state(plannedState(context, selected && context.platform === platform),
          installedState(context?.target, installed && context.platform === platform),
          context?.target && context.platform === platform ? observedState(context.target, installed, audit) : 'not-inspected') });
      edges.push({ from: `module:${module.id}`, to: id, type: 'supports', provenance: 'declared' });
    }
    for (const source of module.sources) addSource(nodes, edges, `module:${module.id}`, source);
  }

  for (const moduleId of ['global-configuration', 'project-configuration']) {
    const module = catalog.modules.find((entry) => entry.id === moduleId);
    for (const platform of module.platforms) {
      const id = `configuration:${moduleId}:${platform}`;
      const relevant = context && context.platform === platform && context.scope === module.scopes[0];
      const audit = moduleId === 'global-configuration' ? audits.global : audits.project;
      const installed = relevant && Boolean(audit?.installed);
      const selected = relevant && selectedModules.includes(moduleId);
      nodes.set(id, { id, kind: 'configuration', label: `${module.label} for ${platform}`, module: moduleId, platform,
        scopes: [...module.scopes], activation: moduleId === 'global-configuration' ? 'session guidance and platform hooks' : 'project guidance and verification command',
        state: state(plannedState(context, selected), installedState(context?.target, installed), relevant ? observedState(context?.target, installed, audit) : 'not-inspected') });
      edges.push({ from: platformId(moduleId, platform), to: id, type: 'contains', provenance: 'declared' });
      for (const source of module.sources) addSource(nodes, edges, id, source);
    }
  }

  for (const capability of catalog.capabilities) {
    const installed = installedCapabilities.has(capability.id);
    const id = capabilityId(capability.id);
    nodes.set(id, { id, kind: 'capability', label: capability.label, capability: capability.id, module: capability.module,
      platforms: [...capability.platforms], scopes: [...capability.scopes], activation: capability.activation,
      cost: costByCapability.get(capability.id), state: state(plannedState(context, plannedCapabilities.has(capability.id)),
        installedState(context?.target, installed), observedState(context?.target, installed, audits.skills)) });
    for (const platform of capability.platforms) edges.push({ from: platformId(capability.module, platform), to: id, type: 'contains', provenance: 'declared' });
    addSource(nodes, edges, id, capability.source);
    for (const resource of capability.resources) addSource(nodes, edges, id, resource, 'resource');
    for (const dependency of capability.requires) edges.push({ from: id, to: capabilityId(dependency), type: 'requires', provenance: 'declared' });
    for (const use of capability.uses) edges.push({ from: id, to: capabilityId(use.id), type: 'uses', condition: use.when, provenance: 'declared' });
    for (const route of capability.routes) edges.push({ from: id, to: capabilityId(route), type: 'routes-to', provenance: 'declared' });
    for (const stage of capability.workflow?.stages ?? []) for (const invoked of stage.invokes) {
      edges.push({ from: id, to: capabilityId(invoked), type: 'stage-invokes', stage: stage.id, condition: stage.when ?? null, provenance: 'declared' });
    }
  }

  for (const integration of integrationCatalog.integrations) {
    const planned = plannedIntegrations.get(integration.id);
    const installed = installedIntegrations.get(integration.id);
    const id = integrationId(integration.id);
    const adapters = typeof integration.adapter === 'string' ? [integration.adapter] : Object.values(integration.adapter);
    nodes.set(id, { id, kind: 'integration', label: integration.label, integration: integration.id, module: 'tool-integrations',
      platforms: [...integration.platforms], scopes: [...integration.scopes], targets: [...integration.targets], activation: 'explicit installation and invocation',
      provenance: { kind: 'declared', release: integration.provenance.release, mode: integration.provenance.mode },
      cost: costs.integrationAdapters.filter((entry) => entry.id === integration.id),
      state: state(plannedState(context, Boolean(planned)), installedState(context?.target, Boolean(installed)),
        observedState(context?.target, Boolean(installed), audits.integrations)), runtime: installed ? { provisioned: installed.provisioned,
        configured: installed.configured, invocable: installed.invocable, hooksActivated: installed.hooksActivated, running: installed.running } : null });
    for (const platform of integration.platforms) edges.push({ from: platformId('tool-integrations', platform), to: id, type: 'contains', provenance: 'declared' });
    for (const source of [...new Set([...adapters, integration.provenance.localPath, ...(integration.runtime.resources ?? []).map((entry) => entry.path)])]) addSource(nodes, edges, id, source);
    for (const capability of integration.capabilities) {
      const childId = integrationCapabilityId(integration.id, capability.id);
      const enabledNow = installed?.enabled.includes(capability.id) ?? false;
      const enabledPlanned = planned?.capabilities.find((entry) => entry.id === capability.id)?.enabled ?? false;
      nodes.set(childId, { id: childId, kind: 'integration-capability', label: capability.id, integration: integration.id,
        capability: capability.id, mode: capability.mode, default: capability.default, network: capability.network, model: capability.model,
        state: state(plannedState(context, enabledPlanned), installedState(context?.target, enabledNow),
          observedState(context?.target, enabledNow, audits.integrations)) });
      edges.push({ from: id, to: childId, type: 'exposes', provenance: 'declared' });
    }
  }

  const model = { version: 1, generatedFrom: ['catalog/modules.json', 'catalog/integrations.json', 'catalog/token-measurements.json', 'validated lifecycle receipts'],
    context: context ? { platform: context.platform, scope: context.scope, targetInspected: Boolean(context.target) } : null,
    stateLegend: { planned: ['selected', 'not-selected', 'not-evaluated', 'not-applicable'], installed: ['installed', 'not-installed', 'not-inspected', 'not-applicable'],
      observed: ['consistent', 'conflict', 'absent', 'not-inspected', 'present', 'declared'] },
    nodes: [...nodes.values()], edges,
    audits: Object.fromEntries(Object.entries(audits).map(([name, audit]) => [name, { applicable: audit.applicable, installed: audit.installed,
      conflicts: [...audit.conflicts] }])), costs,
    interchange: { graphify: { decision: 'linked-separate', joinKey: 'normalized repository-relative source path',
      catalogEvidence: 'declared architecture and receipt-validated installation state', graphifyEvidence: 'extracted or inferred source graph',
      rationale: 'Graphify node-link graphs do not preserve the catalog lifecycle, state, workflow-stage or relationship-provenance contract. Direct merge would blur authored architecture with extracted evidence.',
      path: '.scratch/graphify-harness-2026-09-10/graph.html' } } };
  return model;
}

const escapeCell = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\n', ' ');
const link = (source) => `[\`${source}\`](${source})`;
const sourceLinks = (model, id) => model.edges.filter((edge) => edge.from === id && ['sourced-by', 'resource'].includes(edge.type))
  .map((edge) => model.nodes.find((node) => node.id === edge.to)?.source).filter(Boolean).map(link).join('<br>');
const renderState = (entry) => `${entry.state.planned} / ${entry.state.installed} / ${entry.state.observed}`;

export function renderArchitectureMarkdown(model) {
  const modules = model.nodes.filter((entry) => entry.kind === 'module');
  const capabilities = model.nodes.filter((entry) => ['configuration', 'capability', 'integration'].includes(entry.kind));
  const relationships = model.edges.filter((entry) => ['depends-on', 'requires', 'uses', 'routes-to', 'stage-invokes'].includes(entry.type));
  const integrationCapabilities = model.nodes.filter((entry) => entry.kind === 'integration-capability');
  const label = new Map(model.nodes.map((entry) => [entry.id, entry.label]));
  const moduleRows = modules.map((entry) => `| ${escapeCell(entry.label)} | ${entry.visibility} | ${entry.platforms.join('/')} | ${entry.scopes.join('/')} | ${renderState(entry)} | ${model.edges.filter((edge) => edge.from === entry.id && edge.type === 'depends-on').map((edge) => label.get(edge.to)).join(', ') || '—'} |`).join('\n');
  const pathRows = modules.flatMap((module) => model.nodes.filter((entry) => entry.kind === 'platform' && entry.module === module.module)
    .map((entry) => `| ${escapeCell(module.label)} | ${entry.platform} | ${model.edges.filter((edge) => edge.from === entry.id && edge.type === 'contains').map((edge) => label.get(edge.to)).join(', ') || 'source/runtime ownership'} |`)).join('\n');
  const capabilityRows = capabilities.map((entry) => `| ${entry.module} | ${escapeCell(entry.label)} | ${(entry.targets ?? entry.platforms ?? [entry.platform]).join('/')} | ${escapeCell(entry.activation)} | ${renderState(entry)} | ${sourceLinks(model, entry.id) || '—'} |`).join('\n');
  const relationshipRows = relationships.map((entry) => `| ${escapeCell(label.get(entry.from))} | ${entry.type} | ${escapeCell(label.get(entry.to))} | ${entry.stage ?? '—'} | ${escapeCell(entry.condition ?? '—')} | ${entry.provenance} |`).join('\n');
  const toolRows = integrationCapabilities.map((entry) => `| ${entry.integration} | ${entry.capability} | ${entry.mode} | ${entry.default} | ${entry.network} | ${entry.model} | ${renderState(entry)} |`).join('\n');
  const capabilityCost = model.costs.capabilities.reduce((sum, entry) => sum + entry.metadataEstimatedTokens, 0);
  const bodyCost = model.costs.capabilities.reduce((sum, entry) => sum + entry.bodyEstimatedTokens, 0);
  const adapterCost = model.costs.integrationAdapters.reduce((sum, entry) => sum + entry.metadataEstimatedTokens, 0);
  return `# Harness architecture

Generated by \`node scripts/architecture-view.mjs --write\` from the validated catalogs. This is a logical architecture view, not evidence that every capability is installed or running.

## State semantics

Every selectable row reports **planned / installed / observed** separately:

- planned: selected in this view, not selected, or not evaluated in the static overview;
- installed: claimed by a validated ownership receipt, or not inspected when no target is supplied;
- observed: receipt-owned files are consistent, conflicting, absent, or not inspected. Running processes are never inferred.

The checked-in overview is target-free, so its state is normally \`not-evaluated / not-inspected / not-inspected\`. Use \`node scripts/architecture-view.mjs --platform <platform> --scope <scope> --target <absolute-target> --json\` for a receipt-backed view.

## Modules

| Module | Visibility | Platforms | Scopes | Planned / installed / observed | Depends on |
| --- | --- | --- | --- | --- | --- |
${moduleRows}

## Global → platform → capability → source navigation

| Module | Platform | Capabilities |
| --- | --- | --- |
${pathRows}

| Module | Capability or integration | Platforms or exact targets | Activation | Planned / installed / observed | Canonical source |
| --- | --- | --- | --- | --- | --- |
${capabilityRows}

## Declared relationships

Installation dependencies, conditional uses, routes and workflow-stage invocations remain different edge kinds. A route or conditional use is not an installation dependency.

| From | Edge | To | Stage | Condition | Provenance |
| --- | --- | --- | --- | --- | --- |
${relationshipRows}

## Tool capability edges

| Integration | Capability | Mode | Default | Network | Model | Planned / installed / observed |
| --- | --- | --- | --- | --- | --- | --- |
${toolRows}

## Cost inventory

Static discovery metadata is approximately ${capabilityCost} tokens across the 22 canonical skills/workflows, with ${bodyCost} tokens loaded only when their bodies are invoked. Skill-based tool adapters add approximately ${adapterCost} discovery tokens. MCP configuration bytes are inventoried, but runtime tool-schema tokens stay explicitly unmeasured until a client loads them. See [\`TOKEN-COSTS.md\`](TOKEN-COSTS.md); measured samples live separately in [\`catalog/token-measurements.json\`](catalog/token-measurements.json) and survive regeneration.

## Graphify interchange decision

Keep the catalog view and Graphify source graph linked but separate. Their safe join key is a normalized repository-relative source path. The catalog owns declared modules, workflow stages, activation and receipt-backed state; Graphify owns extracted or inferred source evidence. Direct graph merge is rejected for M7 because Graphify's node-link format cannot preserve those lifecycle and provenance distinctions. The existing local [Graphify relationship view](.scratch/graphify-harness-2026-09-10/graph.html) remains a separate regenerable code view.
`;
}

function parseArgs(args) {
  const result = { selections: [], modules: [], enabled: [], json: false, write: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (['--json', '--write'].includes(option)) {
      const key = option.slice(2);
      if (result[key]) fail(`Duplicate ${option}`);
      result[key] = true;
      continue;
    }
    if (!['--platform', '--scope', '--target', '--select', '--module', '--enable'].includes(option)) fail(`Unsupported option: ${option}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) fail(`Missing value for ${option}`);
    if (option === '--select') result.selections.push(value);
    else if (option === '--module') result.modules.push(value);
    else if (option === '--enable') result.enabled.push(value);
    else {
      if (seen.has(option)) fail(`Duplicate ${option}`);
      seen.add(option);
      result[option.slice(2)] = value;
    }
  }
  if (result.write && (result.json || result.platform || result.scope || result.target || result.selections.length || result.modules.length || result.enabled.length)) {
    fail('--write produces only the target-free Markdown overview');
  }
  return result;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const options = parseArgs(process.argv.slice(2));
  const model = await buildArchitectureModel(root, options);
  const output = options.json ? `${JSON.stringify(model, null, 2)}\n` : renderArchitectureMarkdown(model);
  if (options.write) {
    await fs.writeFile(path.join(root, 'ARCHITECTURE.md'), output);
    console.log(`Wrote ${path.join(root, 'ARCHITECTURE.md')}`);
  } else process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`Architecture: ${error.message}`); process.exitCode = 1; });
}
