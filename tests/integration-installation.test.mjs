import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { applyIntegrationInstallation, planIntegrationAction, planIntegrationInstallation, renderMcpConfiguration, verifyIntegrationArtifact } from '../scripts/integration-installation.mjs';
import { snapshot } from './helpers/filesystem-snapshot.mjs';

const root = path.resolve(import.meta.dirname, '..');

async function fixture(run) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'integration-installation-'));
  const repository = path.join(temporary, 'harness with spaces');
  const target = path.join(temporary, 'target with spaces');
  try {
    for (const directory of ['catalog', 'components', 'global', 'integrations', 'project', 'scripts', 'skills']) {
      await fs.cp(path.join(root, directory), path.join(repository, directory), { recursive: true });
    }
    await fs.mkdir(target);
    const bytes = {
      graphify: Buffer.from('fixture graphify wheel'),
      archify: Buffer.from('fixture archify archive'),
      context7: Buffer.from('fixture context7 package'),
      playwright: Buffer.from('fixture playwright package'),
    };
    const catalogFile = path.join(repository, 'catalog/integrations.json');
    const catalog = JSON.parse(await fs.readFile(catalogFile));
    for (const integration of catalog.integrations) {
      const artifact = integration.provenance.artifact;
      artifact.size = bytes[integration.id].length;
      if (artifact.format === 'npm') artifact.integrity = `sha512-${crypto.createHash('sha512').update(bytes[integration.id]).digest('base64')}`;
      else artifact.sha256 = crypto.createHash('sha256').update(bytes[integration.id]).digest('hex');
    }
    await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
    const artifacts = {};
    for (const [id, content] of Object.entries(bytes)) {
      artifacts[id] = path.join(temporary, `${id}.artifact`);
      await fs.writeFile(artifacts[id], content);
    }
    await run({ temporary, repository, target, artifacts, catalog });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

const options = (fixture, extra = {}) => ({ operation: 'apply', ids: ['graphify'], enabled: [],
  platform: 'codex', scope: 'project', target: fixture.target,
  artifacts: { graphify: fixture.artifacts.graphify }, ...extra });

test('artifact acquisition accepts only the exact approved bytes', async () => fixture(async (f) => {
  const graphify = f.catalog.integrations.find((entry) => entry.id === 'graphify');
  assert.deepEqual(verifyIntegrationArtifact(graphify, Buffer.from('fixture graphify wheel')), {
    size: 22,
    digest: graphify.provenance.artifact.sha256,
    format: 'wheel',
  });
  assert.throws(() => verifyIntegrationArtifact(graphify, Buffer.from('fixture graphify whee!')), /digest mismatch/);
  assert.throws(() => verifyIntegrationArtifact(graphify, Buffer.from('short')), /size mismatch/);
}));

test('Graphify install, query planning, explicit activation, audit and removal remain independent', async () => fixture(async (f) => {
  await fs.writeFile(path.join(f.target, 'unrelated.txt'), 'preserve');
  const preview = await planIntegrationInstallation(f.repository, options(f));
  assert.equal(preview.applicable, true, preview.conflicts.join('; '));
  assert.deepEqual(preview.integrations[0], {
    id: 'graphify',
    enabled: ['build-code', 'cluster', 'explain', 'export', 'merge-graphs', 'path', 'query', 'refresh'],
    provisioned: true,
    configured: true,
    invocable: false,
    running: false,
  });
  const query = planIntegrationAction(preview, { id: 'graphify', capability: 'query', operands: ['auth flow'] });
  assert.deepEqual(query.args, ['query', 'auth flow']);
  assert.equal(query.invocable, false);
  assert.match(query.note, /materialized/);
  assert.deepEqual(planIntegrationAction(preview, { id: 'graphify', capability: 'query', operands: ['$(touch never)'] }).args,
    ['query', '$(touch never)']);
  assert.throws(() => planIntegrationAction(preview, { id: 'graphify', capability: 'watch' }), /not enabled/);
  assert.equal(preview.activation.includes('never starts a process'), true);
  await applyIntegrationInstallation(preview);
  assert.equal(await fs.readFile(path.join(f.target, 'unrelated.txt'), 'utf8'), 'preserve');
  assert.match(await fs.readFile(path.join(f.target, '.agents/skills/graphify/SKILL.md'), 'utf8'), /name: graphify/);
  assert.match(await fs.readFile(path.join(f.target, '.agents/skills/graphify/agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);

  const audit = await planIntegrationInstallation(f.repository, options(f, { operation: 'audit', ids: [], artifacts: {} }));
  assert.equal(audit.applicable, true, audit.conflicts.join('; '));
  assert.equal(audit.changes.length, 0);

  const activation = await planIntegrationInstallation(f.repository, options(f, {
    enabled: ['graphify:watch', 'graphify:query-logging'], artifacts: {},
  }));
  assert.equal(activation.applicable, true, activation.conflicts.join('; '));
  assert.equal(planIntegrationAction(activation, { id: 'graphify', capability: 'watch' }).running, false);
  assert.deepEqual(planIntegrationAction(activation, { id: 'graphify', capability: 'watch' }).args,
    [await fs.realpath(f.target), '--watch']);
  const logging = planIntegrationAction(activation, { id: 'graphify', capability: 'query-logging',
    operands: [path.join(f.target, '.scratch/queries.jsonl')] });
  assert.deepEqual(logging.environment, { GRAPHIFY_QUERY_LOG: path.join(f.target, '.scratch/queries.jsonl') });
  assert.equal(logging.command, null);
  assert.throws(() => planIntegrationAction(activation, { id: 'graphify', capability: 'query-logging', operands: ['relative'] }), /absolute/);
  await applyIntegrationInstallation(activation);

  const removal = await planIntegrationInstallation(f.repository, options(f, {
    operation: 'remove', enabled: [], artifacts: {},
  }));
  assert.equal(removal.applicable, true, removal.conflicts.join('; '));
  await applyIntegrationInstallation(removal);
  await assert.rejects(fs.readFile(path.join(f.target, '.agents/skills/graphify/SKILL.md')), { code: 'ENOENT' });
  await assert.rejects(fs.readFile(path.join(f.target, '.harness/installations/codex/integrations/receipt.json')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(f.target, 'unrelated.txt'), 'utf8'), 'preserve');
}));

test('MCP adapters merge one owned entry and preserve unrelated shared configuration', async () => {
  for (const platform of ['claude', 'codex']) await fixture(async (f) => {
    const config = path.join(f.target, platform === 'claude' ? '.mcp.json' : '.codex/config.toml');
    await fs.mkdir(path.dirname(config), { recursive: true });
    await fs.writeFile(config, platform === 'claude'
      ? JSON.stringify({ mcpServers: { local: { command: 'local-tool' } }, retained: true }, null, 2) + '\n'
      : 'model = "retained"\n');
    const preview = await planIntegrationInstallation(f.repository, {
      operation: 'apply', ids: ['context7'], enabled: [], platform, scope: 'project', target: f.target,
      artifacts: { context7: f.artifacts.context7 },
    });
    assert.equal(preview.applicable, true, preview.conflicts.join('; '));
    assert.equal(preview.integrations[0].configured, true);
    assert.equal(preview.integrations[0].running, false);
    await applyIntegrationInstallation(preview);
    const installed = await fs.readFile(config, 'utf8');
    assert.match(installed, /context7/);
    assert.match(installed, platform === 'claude' ? /local-tool/ : /model = "retained"/);

    await fs.writeFile(config, installed.replace('context7-mcp@3.2.5', 'context7-mcp@changed'));
    const audit = await planIntegrationInstallation(f.repository, {
      operation: 'audit', ids: [], enabled: [], artifacts: {}, platform, scope: 'project', target: f.target,
    });
    assert.equal(audit.applicable, false);
    assert.match(audit.conflicts.join('; '), /owned MCP configuration was edited/);
    await assert.rejects(applyIntegrationInstallation(audit));
  });
});

test('Windows MCP configuration uses a static command wrapper without interpolating input', async () => fixture(async (f) => {
  const context7 = f.catalog.integrations.find((entry) => entry.id === 'context7');
  const source = await fs.readFile(path.join(f.repository, 'components/mcp/claude-context7.json'));
  assert.deepEqual(renderMcpConfiguration('claude', context7, source, 'win32'), {
    command: 'cmd', args: ['/c', 'npx', '-y', '@upstash/context7-mcp@3.2.5'],
  });
  assert.match(renderMcpConfiguration('codex', context7, source, 'win32'),
    /command = "cmd"\nargs = \["\/c","npx","-y","@upstash\/context7-mcp@3\.2\.5"\]/);
}));

test('Archify uses the same pinned acquisition and removable adapter contract', async () => fixture(async (f) => {
  const privateState = path.join(f.temporary, 'private-claude-state');
  await fs.writeFile(privateState, 'must not be inspected');
  await fs.link(privateState, path.join(f.target, '.claude.json'));
  const preview = await planIntegrationInstallation(f.repository, {
    operation: 'apply', ids: ['archify'], enabled: [], artifacts: { archify: f.artifacts.archify },
    platform: 'claude', scope: 'machine', target: f.target,
  });
  assert.equal(preview.applicable, true, preview.conflicts.join('; '));
  assert.deepEqual(preview.integrations[0].enabled, ['deliver', 'doctor', 'render', 'validate']);
  const doctor = planIntegrationAction(preview, { id: 'archify', capability: 'doctor' });
  assert.equal(doctor.command, 'node');
  assert.match(doctor.args[0], /runtime[\\/]archify[\\/]bin[\\/]archify\.mjs$/);
  assert.deepEqual(doctor.args.slice(1), ['doctor']);
  assert.equal(doctor.invocable, false);
  await applyIntegrationInstallation(preview);
  const skill = await fs.readFile(path.join(f.target, '.claude/skills/archify/SKILL.md'), 'utf8');
  assert.match(skill, /name: archify/);
  assert.match(skill, /disable-model-invocation: true/);
  const removal = await planIntegrationInstallation(f.repository, {
    operation: 'remove', ids: ['archify'], enabled: [], artifacts: {},
    platform: 'claude', scope: 'machine', target: f.target,
  });
  await applyIntegrationInstallation(removal);
  await assert.rejects(fs.readFile(path.join(f.target, '.claude/skills/archify/SKILL.md')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(privateState, 'utf8'), 'must not be inspected');
}));

test('missing, linked, altered and unowned integration resources fail closed without writes', async () => {
  for (const kind of ['missing', 'linked', 'altered', 'collision']) await fixture(async (f) => {
    const artifact = f.artifacts.graphify;
    if (kind === 'linked') {
      const real = path.join(f.temporary, 'real-artifact');
      await fs.rename(artifact, real);
      await fs.symlink(real, artifact);
    }
    if (kind === 'altered') await fs.writeFile(artifact, 'fixture graphify whee!');
    if (kind === 'collision') {
      await fs.mkdir(path.join(f.target, '.agents/skills/graphify'), { recursive: true });
      await fs.writeFile(path.join(f.target, '.agents/skills/graphify/SKILL.md'), 'unowned');
    }
    const before = await snapshot(f.temporary);
    if (kind === 'missing') {
      const plan = await planIntegrationInstallation(f.repository, options(f, { artifacts: {} }));
      assert.equal(plan.applicable, false);
      assert.match(plan.conflicts.join('; '), /provide its pinned artifact/);
    } else if (kind === 'collision') {
      const plan = await planIntegrationInstallation(f.repository, options(f));
      assert.equal(plan.applicable, false);
      assert.match(plan.conflicts.join('; '), /unowned discovery collision/);
    } else await assert.rejects(planIntegrationInstallation(f.repository, options(f)));
    assert.deepEqual(await snapshot(f.temporary), before);
  });
});

test('shared setup CLI plans and applies the integration lifecycle without invoking a vendor tool', async () => fixture(async (f) => {
  const run = (...args) => spawnSync(process.execPath, [path.join(f.repository, 'scripts/setup.mjs'), ...args], {
    cwd: f.temporary,
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(f.temporary, 'unused-home'), USERPROFILE: path.join(f.temporary, 'unused-home') },
  });
  const preview = run('plan', '--module', 'tool-integrations', '--select', 'graphify',
    '--platform', 'codex', '--scope', 'project', '--json');
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(JSON.parse(preview.stdout).requested, ['graphify']);
  const lifecycle = ['--module', 'tool-integrations', '--select', 'graphify', '--platform', 'codex',
    '--scope', 'project', '--target', f.target, '--artifact', `graphify=${f.artifacts.graphify}`, '--json'];
  const planned = run('plan', ...lifecycle);
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).applicable, true);
  const applied = run('apply', ...lifecycle, '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).applied, true);
  const audit = run('audit', '--module', 'tool-integrations', '--platform', 'codex', '--scope', 'project',
    '--target', f.target, '--json');
  assert.equal(audit.status, 0, audit.stderr);
  assert.equal(JSON.parse(audit.stdout).applicable, true);
  const removed = run('remove', '--module', 'tool-integrations', '--select', 'graphify', '--platform', 'codex',
    '--scope', 'project', '--target', f.target, '--json', '--apply');
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(JSON.parse(removed.stdout).installed, false);
}));

test('stale plans and interrupted publication preserve competing and unrelated state', async () => {
  for (const kind of ['stale', 'interrupted']) await fixture(async (f) => {
    const planned = await planIntegrationInstallation(f.repository, options(f));
    const unrelated = path.join(f.target, 'unrelated');
    await fs.writeFile(unrelated, 'keep');
    if (kind === 'stale') {
      const collision = path.join(f.target, '.agents/skills/graphify/SKILL.md');
      await fs.mkdir(path.dirname(collision), { recursive: true });
      await fs.writeFile(collision, 'arrived late');
      await assert.rejects(applyIntegrationInstallation(planned), /conflicts|preconditions changed/);
      assert.equal(await fs.readFile(collision, 'utf8'), 'arrived late');
    } else {
      await assert.rejects(applyIntegrationInstallation(planned, {
        checkpoint: async (phase) => { if (phase === 'file') throw new Error('fixture interruption'); },
      }), /rolled back/);
    }
    if (kind !== 'stale') await assert.rejects(fs.readFile(path.join(f.target, '.agents/skills/graphify/SKILL.md')), { code: 'ENOENT' });
    await assert.rejects(fs.readFile(path.join(f.target, '.harness/installations/codex/integrations/receipt.json')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(unrelated, 'utf8'), 'keep');
  });
});
