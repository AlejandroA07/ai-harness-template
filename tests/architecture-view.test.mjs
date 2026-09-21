import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { buildArchitectureModel, renderArchitectureMarkdown } from '../scripts/architecture-view.mjs';
import { validateTokenMeasurements } from '../scripts/cost-inventory.mjs';
import { planInstallation, applyInstallation } from '../scripts/selection-installation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const node = (model, id) => model.nodes.find((entry) => entry.id === id);

test('architecture view links modules through platforms and capabilities to validated sources', async () => {
  const model = await buildArchitectureModel(root);
  assert.equal(model.version, 1);
  assert.equal(model.context, null);
  assert.equal(model.nodes.filter((entry) => entry.kind === 'module').length, 7);
  assert.equal(model.nodes.filter((entry) => entry.kind === 'capability').length, 22);
  assert.equal(model.nodes.filter((entry) => entry.kind === 'integration').length, 4);
  assert.equal(model.costs.capabilities.length, 22);
  assert.equal(model.costs.measurements.samples.length, 3);
  assert.equal(node(model, 'capability:implement').state.planned, 'not-evaluated');
  assert.equal(node(model, 'capability:implement').state.installed, 'not-inspected');
  assert.ok(model.edges.some((entry) => entry.from === 'module:workflows' && entry.to === 'module:skills' && entry.type === 'depends-on'));
  assert.ok(model.edges.some((entry) => entry.from === 'platform:global-configuration:codex'
    && entry.to === 'configuration:global-configuration:codex' && entry.type === 'contains'));
  assert.ok(model.edges.some((entry) => entry.from === 'capability:implement' && entry.to === 'capability:tdd' && entry.type === 'requires'));
  assert.ok(model.edges.some((entry) => entry.from === 'integration:graphify'
    && entry.to === 'integration-capability:graphify:query' && entry.type === 'exposes'));
  assert.deepEqual(node(model, 'integration:context7').targets, ['claude:project', 'codex:machine', 'codex:project']);
  assert.ok(model.edges.some((entry) => entry.from === 'capability:implement'
    && entry.to === 'source:skills/engineering/implement/SKILL.md'));
  assert.equal(model.interchange.graphify.decision, 'linked-separate');
  assert.match(model.interchange.graphify.rationale, /provenance/);
});

test('architecture plan keeps planned, installed and observed state separate', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'architecture-view-'));
  const target = path.join(temporary, 'machine home');
  try {
    await fs.mkdir(target);
    const install = await planInstallation(root, { operation: 'apply', target, platform: 'codex', scope: 'machine', ids: ['research'] });
    assert.equal(install.applicable, true, install.conflicts.join('; '));
    await applyInstallation(install);
    const model = await buildArchitectureModel(root, { platform: 'codex', scope: 'machine', target, selections: ['tdd', 'graphify'] });
    assert.deepEqual(node(model, 'capability:research').state, { planned: 'not-selected', installed: 'installed', observed: 'consistent' });
    assert.deepEqual(node(model, 'capability:tdd').state, { planned: 'selected', installed: 'not-installed', observed: 'absent' });
    assert.deepEqual(node(model, 'integration:graphify').state, { planned: 'selected', installed: 'not-installed', observed: 'absent' });
    assert.equal(model.audits.skills.applicable, true);
    assert.equal(model.audits.skills.installed, true);
    assert.equal(model.audits.integrations.installed, false);
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});

test('architecture selections reject unsupported modules and unknown IDs', async () => {
  await assert.rejects(buildArchitectureModel(root, { platform: 'codex', scope: 'project', modules: ['global-configuration'] }), /Unsupported platform\/scope/);
  await assert.rejects(buildArchitectureModel(root, { platform: 'codex', scope: 'machine', selections: ['unknown'] }), /Unknown architecture/);
  await assert.rejects(buildArchitectureModel(root, { selections: ['research'] }), /requires one --platform and --scope/);
  await assert.rejects(buildArchitectureModel(root, { platform: 'codex', scope: 'machine', target: 'relative' }), /absolute safe path/);
  await assert.rejects(buildArchitectureModel(root, { platform: 'codex', scope: 'machine', target: '/tmp/unsafe\npath' }), /absolute safe path/);
});

test('architecture Markdown exposes navigation, relationship provenance, costs and interchange decision', async () => {
  const markdown = renderArchitectureMarkdown(await buildArchitectureModel(root));
  assert.match(markdown, /Global → platform → capability → source navigation/);
  assert.match(markdown, /planned \/ installed \/ observed/i);
  assert.match(markdown, /\[`skills\/engineering\/implement\/SKILL\.md`\]/);
  assert.match(markdown, /stage-invokes/);
  assert.match(markdown, /Graphify interchange decision/);
  assert.match(markdown, /linked but separate/);
});

test('measured token samples use a strict separate ledger', () => {
  const valid = { version: 1, samples: [{ date: '2026-01-01', agentVersion: 'Agent 1', model: 'Model', project: 'Project', scenario: 'Scenario', mcps: 'none', result: '10 tokens', method: 'status' }], plannedSamples: [] };
  assert.equal(validateTokenMeasurements(valid), valid);
  for (const mutate of [
    (value) => { value.samples[0].result = ''; },
    (value) => { value.samples[0].extra = 'unknown'; },
    (value) => { value.samples.push(structuredClone(value.samples[0])); },
    (value) => { value.version = 2; },
  ]) {
    const fixture = structuredClone(valid);
    mutate(fixture);
    assert.throws(() => validateTokenMeasurements(fixture));
  }
});

test('checked-in architecture and token views match deterministic generation', async () => {
  const architecture = spawnSync(process.execPath, [path.join(root, 'scripts/architecture-view.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(architecture.status, 0, architecture.stderr);
  assert.equal(architecture.stdout, await fs.readFile(path.join(root, 'ARCHITECTURE.md'), 'utf8'));
  const costs = spawnSync(process.execPath, [path.join(root, 'scripts/token-costs.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(costs.status, 0, costs.stderr);
  assert.equal(costs.stdout, await fs.readFile(path.join(root, 'TOKEN-COSTS.md'), 'utf8'));
  assert.match(costs.stdout, /User-provided \/context sample; saved 5\.1k/);
  assert.match(costs.stdout, /Tool adapter inventory/);
});
