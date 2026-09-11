// Pure catalog validation and dependency planning. No filesystem or process access.
const platforms = ['claude', 'codex'];
const scopes = ['machine', 'project'];
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

function fail(message) { throw new Error(message); }
function record(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid ${label}`);
  if (Object.keys(value).some((key) => !fields.includes(key))) fail(`Unknown field in ${label}`);
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) fail(`Invalid ${label}`);
}
function id(value) { if (typeof value !== 'string' || !idPattern.test(value)) fail('Invalid catalog ID'); }
function array(value, validate, label, nonempty = false) {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail(`Invalid ${label}`);
  value.forEach(validate);
  if (new Set(value.map((entry) => JSON.stringify(entry))).size !== value.length) fail(`Duplicate ${label}`);
}
function choices(value, allowed, label) {
  array(value, (entry) => { if (!allowed.includes(entry)) fail(`Unsupported ${label}`); }, label, true);
}
function localPath(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._/-]+$/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) fail('Unsafe catalog path');
}

export function validateCatalog(catalog) {
  record(catalog, ['version', 'modules', 'capabilities'], 'catalog');
  if (catalog.version !== 1) fail('Unsupported catalog version');
  const modules = new Map();
  array(catalog.modules, (module) => {
    record(module, ['id', 'label', 'visibility', 'platforms', 'scopes', 'sources', 'description'], 'module');
    id(module.id);
    if (modules.has(module.id)) fail(`Duplicate module ID: ${module.id}`);
    modules.set(module.id, module);
    text(module.label, 'module label');
    text(module.description, 'module description');
    if (!['public', 'internal'].includes(module.visibility)) fail('Invalid module visibility');
    choices(module.platforms, platforms, 'platform');
    choices(module.scopes, scopes, 'scope');
    array(module.sources, (source) => {
      localPath(source);
      if (!['global', 'project', 'skills', 'components', 'scripts', 'catalog'].includes(source.split('/')[0])) fail('Unsupported module source root');
    }, 'module sources', true);
  }, 'modules', true);
  const capabilities = new Map();
  const sources = new Set();
  array(catalog.capabilities, (capability) => {
    record(capability, ['id', 'label', 'module', 'source', 'platforms', 'scopes', 'requires', 'uses', 'routes', 'prerequisites', 'resources', 'workflow', 'provenanceRef', 'description', 'activation', 'provenance'], 'capability');
    id(capability.id);
    if (capabilities.has(capability.id) || modules.has(capability.id)) fail(`Duplicate catalog ID: ${capability.id}`);
    capabilities.set(capability.id, capability);
    text(capability.label, 'capability label');
    const module = modules.get(capability.module);
    if (!module || module.visibility !== 'public') fail(`Unknown public module: ${capability.module}`);
    localPath(capability.source);
    if (!/^skills\/(engineering|productivity)\/[a-z0-9-]+\/SKILL\.md$/.test(capability.source)) fail('Unsupported capability source');
    if (sources.has(capability.source)) fail('Duplicate capability source/discovery entry');
    sources.add(capability.source);
    choices(capability.platforms, platforms, 'platform');
    choices(capability.scopes, scopes, 'scope');
    if (capability.platforms.some((value) => !module.platforms.includes(value))
      || capability.scopes.some((value) => !module.scopes.includes(value))) fail('Capability support exceeds its module');
    array(capability.requires, id, 'required dependencies');
    array(capability.routes, id, 'routes');
    array(capability.uses, (use) => {
      record(use, ['id', 'when'], 'conditional use');
      id(use.id);
      text(use.when, 'use condition');
    }, 'conditional uses');
    const relationships = [...capability.requires, ...capability.routes, ...capability.uses.map((use) => use.id)];
    if (new Set(relationships).size !== relationships.length) fail('Ambiguous duplicate capability relationship');
    array(capability.prerequisites, (value) => text(value, 'invocation prerequisite'), 'prerequisites');
    array(capability.resources, (resource) => {
      localPath(resource);
      if (!resource.startsWith(capability.source.slice(0, -'SKILL.md'.length)) || resource === capability.source) fail('Resource escapes capability directory');
    }, 'resources');
    if (capability.module === 'workflows') {
      record(capability.workflow, ['stages'], 'workflow');
      const stageIds = new Set();
      const invoked = new Set();
      array(capability.workflow.stages, (stage) => {
        record(stage, ['id', 'label', 'invokes', 'when', 'approval', 'artifacts'], 'workflow stage');
        id(stage.id);
        if (stageIds.has(stage.id)) fail(`Duplicate workflow stage: ${stage.id}`);
        stageIds.add(stage.id);
        text(stage.label, 'workflow stage label');
        array(stage.invokes, (target) => { id(target); invoked.add(target); }, 'stage invocations');
        if (Object.hasOwn(stage, 'when')) text(stage.when, 'stage condition');
        if (Object.hasOwn(stage, 'approval')) text(stage.approval, 'approval point');
        array(stage.artifacts, (artifact) => text(artifact, 'workflow artifact'), 'workflow artifacts');
      }, 'workflow stages', true);
      for (const target of [...capability.requires, ...capability.uses.map((use) => use.id)]) {
        if (!invoked.has(target)) fail(`Workflow stages omit invoked capability: ${target}`);
      }
      for (const target of invoked) {
        if (![...capability.requires, ...capability.uses.map((use) => use.id)].includes(target)) {
          fail(`Workflow stage invocation lacks an installation relationship: ${target}`);
        }
      }
    } else if (Object.hasOwn(capability, 'workflow')) fail('Only workflows may declare ordered stages');
    id(capability.provenanceRef);
    if (capability.provenanceRef !== capability.id) fail('Provenance reference must identify the canonical capability');
    if (Object.hasOwn(capability, 'description')) text(capability.description, 'description');
    if (Object.hasOwn(capability, 'activation') && !['user-only', 'model-or-user'].includes(capability.activation)) fail('Invalid activation');
    if (Object.hasOwn(capability, 'provenance')) {
      record(capability.provenance, ['mode', 'repository', 'reviewedCommit', 'upstreamPath'], 'provenance');
      if (!['local', 'exact', 'adapted'].includes(capability.provenance.mode)) fail('Invalid provenance mode');
      if (capability.provenance.mode !== 'local') {
        text(capability.provenance.repository, 'upstream repository');
        if (!/^[a-f0-9]{40}$/.test(capability.provenance.reviewedCommit ?? '')) fail('Invalid provenance revision');
        localPath(capability.provenance.upstreamPath);
      }
    }
  }, 'capabilities');
  for (const capability of capabilities.values()) {
    for (const target of [...capability.requires, ...capability.routes, ...capability.uses.map((use) => use.id)]) {
      if (!capabilities.has(target)) fail(`Unknown relationship target: ${target}`);
    }
  }
  const done = new Set();
  const visiting = new Set();
  function visit(name) {
    if (visiting.has(name)) fail(`Required dependency cycle at ${name}`);
    if (done.has(name)) return;
    visiting.add(name);
    capabilities.get(name).requires.forEach(visit);
    visiting.delete(name);
    done.add(name);
  }
  [...capabilities.keys()].forEach(visit);
  return catalog;
}

export function planSelection(catalog, selection) {
  validateCatalog(catalog);
  record(selection, ['ids', 'modules', 'platforms', 'scope'], 'selection');
  array(selection.ids, id, 'selected IDs');
  array(selection.modules, id, 'selected modules');
  choices(selection.platforms, platforms, 'platform');
  if (!scopes.includes(selection.scope)) fail('Unsupported scope');
  const requested = new Set(selection.ids);
  for (const moduleId of selection.modules) {
    const module = catalog.modules.find((entry) => entry.id === moduleId);
    if (!module || module.visibility !== 'public') fail(`Unknown selectable module: ${moduleId}`);
    const members = catalog.capabilities.filter((entry) => entry.module === moduleId);
    if (!members.length) fail(`Module has no M1 capability definitions: ${moduleId}`);
    members.forEach((entry) => requested.add(entry.id));
  }
  if (!requested.size) fail('Select at least one capability or module');
  const byId = new Map(catalog.capabilities.map((entry) => [entry.id, entry]));
  const ordered = [];
  const included = new Set();
  function include(name) {
    if (included.has(name)) return;
    const capability = byId.get(name);
    if (!capability) fail(`Unknown selected capability: ${name}`);
    if (!capability.scopes.includes(selection.scope)
      || selection.platforms.some((platform) => !capability.platforms.includes(platform))) fail(`Unsupported platform/scope selection for ${name}`);
    [...capability.requires].sort().forEach(include);
    included.add(name);
    ordered.push(capability);
  }
  [...requested].sort().forEach(include);
  return {
    version: 1,
    stage: 'selection-only',
    relationshipProvenance: {
      dependencies: { kind: 'declared', source: 'catalog/modules.json' },
      dependencyConsumers: { kind: 'derived', source: 'catalog/modules.json requires' },
      containment: { kind: 'declared', source: 'catalog/modules.json' },
      conditionalUses: { kind: 'declared', source: 'catalog/modules.json' },
      routes: { kind: 'declared', source: 'catalog/modules.json' },
      prerequisites: { kind: 'declared', source: 'catalog/modules.json' },
      workflow: { kind: 'declared', source: 'catalog/modules.json' },
      activation: { kind: 'source-derived', source: 'skills/invocation-policy.json' },
    },
    applicable: false,
    targetPreflight: 'not-performed',
    inventoryPolicy: 'coexistence',
    platforms: [...selection.platforms].sort(),
    scope: selection.scope,
    requested: [...requested].sort(),
    capabilities: ordered.map((entry) => ({
      id: entry.id, module: entry.module, source: entry.source, resources: [...entry.resources],
      reason: requested.has(entry.id) ? 'selected' : 'required dependency',
      requiredBy: ordered.filter((other) => other.requires.includes(entry.id)).map((other) => other.id).sort(),
      requires: entry.requires.map((id) => ({ id, provenance: 'declared' })),
      activation: { mode: entry.activation ?? 'unresolved', provenance: 'source-derived' },
      provenanceRef: entry.provenanceRef,
      prerequisites: [...entry.prerequisites],
      conditionalUses: entry.uses.map((use) => ({ ...use, included: included.has(use.id), provenance: 'declared' })),
      routes: entry.routes.map((id) => ({ id, included: included.has(id), provenance: 'declared' })),
      workflow: entry.workflow ? { provenance: 'declared', stages: structuredClone(entry.workflow.stages) } : null,
    })),
    discoveryEntries: ordered.flatMap((entry) => [...selection.platforms].sort().map((platform) => ({
      id: entry.id, platform, scope: selection.scope,
      relativePath: `${platform === 'claude' ? '.claude' : '.agents'}/skills/${entry.id}`,
    }))),
    notes: ['Read-only selection preview. No target was inspected, no payload was generated and no tools were probed.',
      'Discovery paths are relative to the future machine or project target. Store paths, conflicts, writes and activation changes require M2 target preflight.',
      'Invocation prerequisites and conditional uses are not installation dependencies. No capabilities are started by this plan.'],
  };
}
