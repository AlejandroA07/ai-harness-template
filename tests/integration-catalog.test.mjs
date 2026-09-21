import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadIntegrationCatalog, planIntegrations, validateIntegrationCatalog } from '../scripts/integration-catalog.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = await loadIntegrationCatalog(root);
const select = (ids, extra = {}) => ({ ids, platform: 'codex', scope: 'project', enabled: [], ...extra });

test('integration catalog pins artifacts, provenance, adapters and inactive defaults', () => {
  assert.equal(catalog.version, 1);
  assert.deepEqual(catalog.integrations.map((entry) => entry.id), ['archify', 'context7', 'graphify', 'playwright']);
  for (const integration of catalog.integrations) {
    assert.equal(integration.provenance.mode, 'adapted');
    assert.ok(integration.provenance.upstreamPath);
    assert.ok(integration.provenance.localPath);
    assert.ok(integration.provenance.notices.length);
    assert.match(integration.provenance.release, /\d/);
    assert.match(integration.provenance.artifact.url, /^https:\/\//);
    assert.ok(integration.provenance.artifact.sha256 || integration.provenance.artifact.integrity);
    assert.ok(Object.values(integration.safeguards).every((value) => value === false));
  }
  const graphify = catalog.integrations.find((entry) => entry.id === 'graphify');
  assert.equal(graphify.provenance.reviewedCommit, '23f2ffaa43fd12f25d9eabe91e6d184b5d89b474');
  assert.equal(graphify.provenance.artifact.sha256, 'e239803288e91c723d6e30540860bd6d5a1dc3f0914b9fc1104b0233e98aaeb8');
  assert.deepEqual(graphify.capabilities.map((entry) => entry.id), [
    'build-code', 'refresh', 'cluster', 'query', 'affected', 'god-nodes', 'path', 'explain', 'diagnose-multigraph',
    'export', 'tree', 'benchmark', 'merge-graphs', 'semantic-media', 'remote-ingest', 'database-connectors',
    'community-labeling', 'provider-management', 'repository-clone', 'pr-dashboard', 'pr-triage', 'query-logging',
    'semantic-update-check', 'watch', 'hooks', 'mcp', 'global-graph', 'memory', 'reflection',
  ]);
  assert.deepEqual(graphify.capabilities.filter((entry) => entry.default === 'disabled').map((entry) => entry.id),
    ['semantic-media', 'remote-ingest', 'database-connectors', 'community-labeling', 'provider-management',
      'repository-clone', 'pr-dashboard', 'pr-triage', 'query-logging', 'semantic-update-check', 'watch', 'hooks', 'mcp',
      'global-graph', 'memory', 'reflection']);
  assert.deepEqual(graphify.capabilities.find((entry) => entry.id === 'query').writes, []);
  assert.equal(graphify.capabilities.find((entry) => entry.id === 'query-logging').default, 'disabled');
  assert.deepEqual(graphify.runtime.resources.map((entry) => entry.profile), ['base', 'all']);
  assert.ok(graphify.runtime.resources.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  for (const id of ['context7', 'playwright']) {
    const integration = catalog.integrations.find((entry) => entry.id === id);
    const runtime = integration.runtime;
    assert.equal(runtime.kind, 'npm-package');
    assert.deepEqual(runtime.resources.map((entry) => path.basename(entry.path)).sort(), ['package-lock.json', 'package.json']);
    assert.equal(integration.provenance.artifact.size, id === 'context7' ? 28_837 : 22_503);
  }
  assert.equal(catalog.integrations.find((entry) => entry.id === 'archify').provenance.artifact.sha256,
    '4c59fa6557a2385beaaef8c7219cc414573acc9f0c30a932d5053b0b20689a46');
});

test('integration plans expose all capabilities without activating optional behavior', () => {
  const plan = planIntegrations(catalog, select(['graphify']));
  assert.deepEqual(plan.requested, ['graphify']);
  assert.equal(plan.applicable, false);
  assert.equal(plan.targetPreflight, 'not-performed');
  assert.equal(plan.integrations[0].adapter, 'integrations/graphify/SKILL.md');
  assert.equal(plan.integrations[0].capabilities.find((entry) => entry.id === 'build-code').enabled, true);
  for (const id of ['semantic-media', 'remote-ingest', 'database-connectors', 'community-labeling', 'provider-management',
    'repository-clone', 'pr-dashboard', 'pr-triage', 'query-logging', 'semantic-update-check', 'watch', 'hooks', 'mcp',
    'global-graph', 'memory', 'reflection']) {
    assert.deepEqual(plan.integrations[0].capabilities.find((entry) => entry.id === id),
      { ...catalog.integrations.find((entry) => entry.id === 'graphify').capabilities.find((entry) => entry.id === id), enabled: false, activation: 'disabled' });
  }
  const optedIn = planIntegrations(catalog, select(['graphify'], { enabled: ['graphify:mcp', 'graphify:watch'] }));
  assert.equal(optedIn.integrations[0].capabilities.find((entry) => entry.id === 'mcp').activation, 'explicit');
  assert.equal(optedIn.integrations[0].capabilities.find((entry) => entry.id === 'watch').activation, 'explicit');
  assert.equal(optedIn.integrations[0].capabilities.find((entry) => entry.id === 'memory').enabled, false);
});

test('platform adapter selection remains target-specific and module selection includes every integration', () => {
  const all = planIntegrations(catalog, select([], { platform: 'claude', scope: 'project' }));
  assert.deepEqual(all.requested, ['archify', 'context7', 'graphify', 'playwright']);
  assert.equal(all.integrations.find((entry) => entry.id === 'context7').adapter, 'components/mcp/claude-context7.json');
  assert.equal(planIntegrations(catalog, select(['context7'])).integrations[0].adapter, 'components/mcp/codex-context7.toml');
  assert.deepEqual(planIntegrations(catalog, select([], { platform: 'claude', scope: 'machine' })).requested, ['archify', 'graphify']);
  assert.throws(() => planIntegrations(catalog, select(['context7'], { platform: 'claude', scope: 'machine' })), /Unsupported platform\/scope/);
});

test('integration validation rejects untrusted acquisition, automatic activation and ambiguous selections', () => {
  const mutations = [
    (value) => { value.version = 2; },
    (value) => { value.integrations[0].id = '../escape'; },
    (value) => { value.integrations[0].adapter = '../outside'; },
    (value) => { value.integrations[0].provenance.localPath = 'components/mcp'; },
    (value) => { value.integrations[0].provenance.notices = []; },
    (value) => { value.integrations[0].provenance.artifact.url = 'http://github.com/archive.zip'; },
    (value) => { value.integrations[0].provenance.artifact.url = 'https://example.com/archive.zip'; },
    (value) => { value.integrations[0].provenance.artifact.sha256 = '../outside'; },
    (value) => { value.integrations[0].provenance.artifact.size = 30_000_000; },
    (value) => { value.integrations[0].safeguards.automaticNetwork = true; },
    (value) => { value.integrations.find((entry) => entry.id === 'graphify').runtime.resources[0].path = '../outside'; },
    (value) => { value.integrations.find((entry) => entry.id === 'graphify').capabilities.find((entry) => entry.id === 'memory').default = 'enabled'; },
  ];
  for (const mutate of mutations) {
    const fixture = structuredClone(catalog);
    mutate(fixture);
    assert.throws(() => validateIntegrationCatalog(fixture), undefined, mutate.toString());
  }
  assert.throws(() => planIntegrations(catalog, select(['unknown'])), /Unknown integration/);
  assert.throws(() => planIntegrations(catalog, select(['graphify'], { enabled: ['graphify:unknown'] })), /Unknown graphify capability/);
  assert.throws(() => planIntegrations(catalog, select(['archify'], { enabled: ['graphify:mcp'] })), /unselected integration/);
});

test('integration loading rejects linked, drifted or expanded adapters and runtime locks', async () => {
  for (const kind of ['linked', 'drifted', 'expanded', 'runtime-lock']) {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'integration-catalog-'));
    const repository = path.join(temporary, 'repository');
    try {
      for (const directory of ['catalog', 'components', 'integrations']) {
        await fs.cp(path.join(root, directory), path.join(repository, directory), { recursive: true });
      }
      const adapter = path.join(repository, 'components/mcp/codex-context7.toml');
      if (kind === 'linked') {
        const outside = path.join(temporary, 'outside');
        await fs.writeFile(outside, '[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp@3.2.5"]\n');
        await fs.unlink(adapter);
        await fs.symlink(outside, adapter);
      } else if (kind === 'drifted') await fs.writeFile(adapter, '[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp@latest"]\n');
      else if (kind === 'expanded') await fs.appendFile(adapter, 'env = { SECRET = "unsafe" }\n');
      else await fs.appendFile(path.join(repository, 'integrations/graphify/base-requirements.txt'), '\nchanged\n');
      await assert.rejects(loadIntegrationCatalog(repository));
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  }
});
