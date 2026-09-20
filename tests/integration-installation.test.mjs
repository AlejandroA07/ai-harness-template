import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { applyIntegrationInstallation, planIntegrationAction, planIntegrationInstallation, renderMcpConfiguration, verifyIntegrationArtifact } from '../scripts/integration-installation.mjs';
import { payloadHash } from '../scripts/installation-core.mjs';
import { extractZip, materializeIntegrationRuntime } from '../scripts/integration-runtime.mjs';
import { snapshot } from './helpers/filesystem-snapshot.mjs';

const root = path.resolve(import.meta.dirname, '..');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name);
    const contents = Buffer.from(value);
    const checksum = crc32(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(contents.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, contents);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(contents.length, 20);
    entry.writeUInt32LE(contents.length, 24);
    entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(0o100644 * 0x10000, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, filename);
    offset += local.length + filename.length + contents.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function fakeRuntime(integration, command = '/fixture/runtime', profile = null) {
  const files = integration.id === 'graphify'
    ? { 'site-packages/graphify/__init__.py': Buffer.from('__version__ = "0.9.58"\n'),
      'site-packages/graphify/__main__.py': Buffer.from('print("fixture")\n') }
    : { [integration.runtime.entrypoint]: Buffer.from('console.log("fixture")\n') };
  return { files, metadata: { kind: integration.runtime.kind === 'python-wheel' ? 'python-target' : 'node-tree',
    command, profile: profile ?? (integration.id === 'graphify' ? 'base' : 'runtime'),
    entrypoint: integration.runtime.module ?? integration.runtime.entrypoint,
    hash: payloadHash(files), fileCount: Object.keys(files).length } };
}

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
      archify: storedZip({
        'archify/bin/archify.mjs': 'console.log(JSON.stringify(process.argv.slice(2)))\n',
        'archify/package.json': '{"name":"archify","version":"2.16.0"}\n',
      }),
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

test('runtime extraction and materialization fail closed on unsafe archives and implicit network access', async () => fixture(async (f) => {
  assert.throws(() => extractZip(storedZip({ '../escape': 'bad' })), /Unsafe integration archive path/);
  const corrupt = storedZip({ 'archify/bin/archify.mjs': 'ok' });
  corrupt[30 + Buffer.byteLength('archify/bin/archify.mjs')] ^= 1;
  assert.throws(() => extractZip(corrupt, { root: 'archify' }), /Invalid integration ZIP content/);
  const ambiguous = storedZip({ 'archify/bin/archify.mjs': 'ok' });
  const central = ambiguous.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  ambiguous[central + 46 + Buffer.byteLength('archify/bin/')] = 'z'.charCodeAt(0);
  assert.throws(() => extractZip(ambiguous, { root: 'archify' }), /local entry name mismatch/);
  const graphify = f.catalog.integrations.find((entry) => entry.id === 'graphify');
  await assert.rejects(materializeIntegrationRuntime({ repository: f.repository, integration: graphify,
    artifact: Buffer.from('fixture graphify wheel'), enabled: [], staging: path.join(f.temporary, 'runtime'),
    python: '/usr/bin/python3', allowNetwork: false }), /explicit --allow-network/);
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
    plannedInvocable: false,
    running: false,
    hooksActivated: false,
    runtime: null,
  });
  assert.throws(() => planIntegrationAction(preview, { id: 'graphify', capability: 'query', operands: ['auth flow'] }), /not materialized/);
  assert.throws(() => planIntegrationAction(preview, { id: 'graphify', capability: 'watch' }), /not enabled/);
  assert.equal(preview.activation.includes('never starts a process'), true);
  const materialized = await planIntegrationInstallation(f.repository, options(f, {
    materialize: true, allowNetwork: true, python: '/fixture/python',
  }));
  assert.equal(materialized.integrations[0].plannedInvocable, true);
  await applyIntegrationInstallation(materialized, {
    materializer: async ({ integration }) => fakeRuntime(integration, '/fixture/python'),
  });
  assert.equal(await fs.readFile(path.join(f.target, 'unrelated.txt'), 'utf8'), 'preserve');
  assert.match(await fs.readFile(path.join(f.target, '.agents/skills/graphify/SKILL.md'), 'utf8'), /name: graphify/);
  assert.match(await fs.readFile(path.join(f.target, '.agents/skills/graphify/agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);

  const audit = await planIntegrationInstallation(f.repository, options(f, { operation: 'audit', ids: [], artifacts: {} }));
  assert.equal(audit.applicable, true, audit.conflicts.join('; '));
  assert.equal(audit.changes.length, 0);
  assert.equal(audit.integrations[0].invocable, true);
  const query = planIntegrationAction(audit, { id: 'graphify', capability: 'query', operands: ['auth flow'] });
  assert.deepEqual(query.args, ['-B', '-m', 'graphify', 'query', 'auth flow']);
  assert.deepEqual(planIntegrationAction(audit, { id: 'graphify', capability: 'query', operands: ['$(touch never)'] }).args,
    ['-B', '-m', 'graphify', 'query', '$(touch never)']);

  const insufficient = await planIntegrationInstallation(f.repository, options(f, {
    enabled: ['graphify:watch'], artifacts: {},
  }));
  assert.equal(insufficient.applicable, false);
  assert.match(insufficient.conflicts.join('; '), /require --materialize/);
  await fs.mkdir(path.join(f.target, '.git/hooks'), { recursive: true });
  const activation = await planIntegrationInstallation(f.repository, options(f, {
    enabled: ['graphify:watch', 'graphify:query-logging', 'graphify:mcp', 'graphify:hooks'], artifacts: {},
    materialize: true, allowNetwork: true, python: '/fixture/python',
  }));
  await applyIntegrationInstallation(activation, {
    materializer: async ({ integration }) => fakeRuntime(integration, '/fixture/python', 'all'),
  });
  const activated = await planIntegrationInstallation(f.repository, options(f, { operation: 'audit', ids: [], artifacts: {} }));
  assert.equal(activated.applicable, true, activated.conflicts.join('; '));
  assert.equal(planIntegrationAction(activated, { id: 'graphify', capability: 'watch' }).running, false);
  assert.deepEqual(planIntegrationAction(activated, { id: 'graphify', capability: 'watch' }).args,
    ['-B', '-m', 'graphify', 'watch', await fs.realpath(f.target)]);
  assert.deepEqual(planIntegrationAction(activated, { id: 'graphify', capability: 'mcp' }).args,
    ['-B', '-m', 'graphify.serve']);
  assert.equal(planIntegrationAction(activated, { id: 'graphify', capability: 'hooks' }).command, null);
  const hook = path.join(f.target, '.git/hooks/post-commit');
  assert.match(await fs.readFile(hook, 'utf8'), /GRAPHIFY_QUERY_LOG_DISABLE=1/);
  assert.equal((await fs.stat(hook)).mode & 0o777, 0o700);
  const logging = planIntegrationAction(activated, { id: 'graphify', capability: 'query-logging',
    operands: [path.join(f.target, '.scratch/queries.jsonl')] });
  assert.deepEqual(logging.environment, { GRAPHIFY_QUERY_LOG: path.join(f.target, '.scratch/queries.jsonl') });
  assert.equal(logging.command, null);
  assert.throws(() => planIntegrationAction(activated, { id: 'graphify', capability: 'query-logging', operands: ['relative'] }), /absolute/);

  const removal = await planIntegrationInstallation(f.repository, options(f, {
    operation: 'remove', enabled: [], artifacts: {},
  }));
  assert.equal(removal.applicable, true, removal.conflicts.join('; '));
  await applyIntegrationInstallation(removal);
  await assert.rejects(fs.readFile(path.join(f.target, '.agents/skills/graphify/SKILL.md')), { code: 'ENOENT' });
  await assert.rejects(fs.readFile(path.join(f.target, '.harness/installations/codex/integrations/receipt.json')), { code: 'ENOENT' });
  await assert.rejects(fs.readFile(hook), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(f.target, 'unrelated.txt'), 'utf8'), 'preserve');
}));

test('Graphify hook activation refuses to overwrite an unowned project hook', async () => fixture(async (f) => {
  const installation = await planIntegrationInstallation(f.repository, options(f, {
    materialize: true, allowNetwork: true, python: '/fixture/python',
  }));
  await applyIntegrationInstallation(installation, {
    materializer: async ({ integration }) => fakeRuntime(integration, '/fixture/python'),
  });
  const hook = path.join(f.target, '.git/hooks/post-commit');
  await fs.mkdir(path.dirname(hook), { recursive: true });
  await fs.writeFile(hook, '#!/bin/sh\necho existing\n');
  const activation = await planIntegrationInstallation(f.repository, options(f, {
    enabled: ['graphify:hooks'], artifacts: {},
  }));
  assert.equal(activation.applicable, false);
  assert.match(activation.conflicts.join('; '), /unowned Git hook collision/);
  assert.equal(await fs.readFile(hook, 'utf8'), '#!/bin/sh\necho existing\n');
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
      artifacts: { context7: f.artifacts.context7 }, materialize: true, allowNetwork: true,
    });
    assert.equal(preview.applicable, true, preview.conflicts.join('; '));
    assert.equal(preview.integrations[0].configured, false);
    assert.equal(preview.integrations[0].plannedInvocable, true);
    assert.equal(preview.integrations[0].running, false);
    await applyIntegrationInstallation(preview, {
      materializer: async ({ integration }) => fakeRuntime(integration, process.execPath),
    });
    const installed = await fs.readFile(config, 'utf8');
    assert.match(installed, /context7/);
    assert.doesNotMatch(installed, /npx/);
    assert.match(installed, /node_modules/);
    assert.match(installed, platform === 'claude' ? /local-tool/ : /model = "retained"/);

    await fs.writeFile(config, installed.replace('dist/index.js', 'dist/changed.js'));
    const audit = await planIntegrationInstallation(f.repository, {
      operation: 'audit', ids: [], enabled: [], artifacts: {}, platform, scope: 'project', target: f.target,
    });
    assert.equal(audit.applicable, false);
    assert.match(audit.conflicts.join('; '), /owned MCP configuration was edited/);
    await assert.rejects(applyIntegrationInstallation(audit));
  });
});

test('runtime ownership rejects edited materialized files before audit or removal', async () => fixture(async (f) => {
  const plan = await planIntegrationInstallation(f.repository, options(f, {
    materialize: true, allowNetwork: true, python: '/fixture/python',
  }));
  await applyIntegrationInstallation(plan, {
    materializer: async ({ integration }) => fakeRuntime(integration, '/fixture/python'),
  });
  const runtimeFile = path.join(f.target, '.harness/installations/codex/integrations/runtime/graphify/site-packages/graphify/__main__.py');
  await fs.writeFile(runtimeFile, 'edited');
  const audit = await planIntegrationInstallation(f.repository, options(f, { operation: 'audit', ids: [], artifacts: {} }));
  assert.equal(audit.applicable, false);
  assert.match(audit.conflicts.join('; '), /owned runtime is missing or edited/);
  const removal = await planIntegrationInstallation(f.repository, options(f, { operation: 'remove', artifacts: {} }));
  assert.equal(removal.applicable, false);
}));

test('MCP configuration invokes only the owned materialized runtime', async () => fixture(async (f) => {
  const context7 = f.catalog.integrations.find((entry) => entry.id === 'context7');
  const source = await fs.readFile(path.join(f.repository, 'components/mcp/claude-context7.json'));
  const runtimeRoot = path.join(f.target, '.harness/installations/claude/integrations/runtime/context7');
  const runtime = { kind: 'node-tree', command: process.execPath, profile: 'runtime',
    entrypoint: context7.runtime.entrypoint, hash: 'a'.repeat(64), fileCount: 1 };
  assert.deepEqual(renderMcpConfiguration('claude', { ...context7, adapterKind: 'mcp' }, source, runtimeRoot, runtime), {
    command: process.execPath, args: [path.join(runtimeRoot, context7.runtime.entrypoint)],
  });
  const codex = renderMcpConfiguration('codex', { ...context7, adapterKind: 'mcp' }, source, runtimeRoot, runtime);
  assert.match(codex, /command = "/);
  assert.match(codex, /node_modules/);
  assert.doesNotMatch(codex, /npx|\$\(/);
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
  assert.equal(preview.integrations[0].invocable, true);
  const doctor = planIntegrationAction(preview, { id: 'archify', capability: 'doctor' });
  assert.equal(doctor.command, process.execPath);
  assert.match(doctor.args[0], /runtime[\\/]archify[\\/]bin[\\/]archify\.mjs$/);
  assert.deepEqual(doctor.args.slice(1), ['doctor']);
  await applyIntegrationInstallation(preview);
  const invoked = spawnSync(doctor.command, doctor.args, { cwd: doctor.cwd, encoding: 'utf8' });
  assert.equal(invoked.status, 0, invoked.stderr);
  assert.deepEqual(JSON.parse(invoked.stdout), ['doctor']);
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
