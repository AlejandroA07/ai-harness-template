import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { hashDirectory } from '../scripts/skill-lib.mjs';

const script = path.resolve(import.meta.dirname, '../scripts/generate-project-skills.mjs');
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-adapters-'));
  const project = path.join(root, 'project with spaces');
  const source = path.join(project, '.harness', 'skills', 'sample');
  await fs.mkdir(source, { recursive: true });
  await fs.writeFile(path.join(source, 'SKILL.md'), '---\nname: sample\ndescription: Sample capability for project adapter tests.\n---\n\nOriginal body.\n');
  await fs.writeFile(path.join(source, 'reference.md'), 'Resource content.\n');
  await fs.writeFile(path.join(project, '.harness', 'skills', 'invocation-policy.json'), '{"userOnly":["sample"]}\n');
  const manifest = path.join(project, '.harness', 'generated-skills.json');
  const adapter = (platform) => path.join(project, platform === 'claude' ? '.claude' : '.agents', 'skills', 'sample');
  const run = (...args) => spawnSync(process.execPath, [script, '--project', project, ...args], { encoding: 'utf8' });
  return { root, project, source, manifest, adapter, run };
}
function success(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }
async function cleanup(f) { await fs.rm(f.root, { recursive: true, force: true }); }

test('project adapters retain bodies, resources and invocation policy across create, check, update and removal', async () => {
  const f = await fixture();
  try {
    success(f.run());
    success(f.run('--check'));
    const before = await hashDirectory(f.project);
    success(f.run());
    assert.equal(await hashDirectory(f.project), before);
    const manifest = JSON.parse(await fs.readFile(f.manifest, 'utf8'));
    assert.equal(manifest.version, 1);
    for (const platform of ['claude', 'codex']) {
      assert.equal(manifest.hashes[platform].sample, await hashDirectory(f.adapter(platform)));
      assert.equal(await fs.readFile(path.join(f.adapter(platform), 'reference.md'), 'utf8'), 'Resource content.\n');
      assert.match(await fs.readFile(path.join(f.adapter(platform), 'SKILL.md'), 'utf8'), /Original body/);
    }
    assert.match(await fs.readFile(path.join(f.adapter('claude'), 'SKILL.md'), 'utf8'), /disable-model-invocation: true/);
    assert.match(await fs.readFile(path.join(f.adapter('codex'), 'agents', 'openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);
    await fs.appendFile(path.join(f.source, 'SKILL.md'), '\nUpdated body.\n');
    assert.notEqual(f.run('--check').status, 0);
    success(f.run());
    success(f.run('--check'));
    const unrelated = path.join(path.dirname(f.adapter('codex')), 'unrelated');
    await fs.mkdir(unrelated);
    await fs.writeFile(path.join(unrelated, 'keep'), 'Keep me');
    await fs.rm(f.source, { recursive: true });
    await fs.writeFile(path.join(path.dirname(f.source), 'invocation-policy.json'), '{"userOnly":[]}');
    success(f.run());
    for (const platform of ['claude', 'codex']) await assert.rejects(fs.access(f.adapter(platform)), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(unrelated, 'keep'), 'utf8'), 'Keep me');
    success(f.run('--check'));
  } finally { await cleanup(f); }
});

test('malformed manifests cannot select removal paths or mutate either platform', async () => {
  const f = await fixture();
  try {
    success(f.run());
    await fs.writeFile(path.join(f.project, 'sentinel'), 'Keep me');
    const cases = [null, [], {}, { generated: 'sample' }, { generated: [null] },
      ...['../../outside', '../..', '.', '..', '/absolute', 'C:\\outside', 'a/b', 'a\\b', 'Sample'].map((name) => ({ generated: [name] })),
      { generated: ['sample', 'sample'] }, { generated: ['sample'], version: 2 },
      { generated: ['sample'], version: 1, hashes: { claude: { sample: 'bad' }, codex: {} } },
      { generated: [], platform: 'unknown' }];
    for (const value of cases) {
      await fs.writeFile(f.manifest, JSON.stringify(value));
      const before = await hashDirectory(f.project);
      for (const args of [[], ['--check']]) assert.notEqual(f.run(...args).status, 0, JSON.stringify(value));
      assert.equal(await hashDirectory(f.project), before);
    }
  } finally { await cleanup(f); }
});

test('edited and unowned adapters fail preflight without partial writes', async () => {
  for (const state of ['edited-update', 'edited-removal', 'edited-empty-directory', 'unowned', 'forged-legacy']) {
    const f = await fixture();
    try {
      if (state.startsWith('edited')) success(f.run());
      else await fs.mkdir(f.adapter('codex'), { recursive: true });
      if (state === 'edited-empty-directory') await fs.mkdir(path.join(f.adapter('codex'), 'user-directory'));
      else await fs.writeFile(path.join(f.adapter('codex'), 'keep'), 'User content');
      if (state === 'forged-legacy') await fs.writeFile(f.manifest, '{"generated":["sample"]}');
      if (state === 'edited-removal') {
        await fs.rm(f.source, { recursive: true });
        await fs.writeFile(path.join(path.dirname(f.source), 'invocation-policy.json'), '{"userOnly":[]}');
      }
      const before = await hashDirectory(f.project);
      assert.notEqual(f.run().status, 0, state);
      assert.equal(await hashDirectory(f.project), before, state);
    } finally { await cleanup(f); }
  }
});

test('legacy manifests adopt only content identical to current rendering and preserve ambiguous removals', async () => {
  const f = await fixture();
  try {
    success(f.run());
    await fs.writeFile(f.manifest, '{"generated":["sample"]}');
    success(f.run('--check'));
    success(f.run());
    assert.equal(JSON.parse(await fs.readFile(f.manifest)).version, 1);
    await fs.writeFile(f.manifest, '{"generated":["sample"]}');
    await fs.rm(f.source, { recursive: true });
    await fs.writeFile(path.join(path.dirname(f.source), 'invocation-policy.json'), '{"userOnly":[]}');
    const before = await hashDirectory(f.project);
    assert.notEqual(f.run().status, 0);
    assert.equal(await hashDirectory(f.project), before);
  } finally { await cleanup(f); }
});

test('linked project, discovery, source, adapter and manifest paths preserve external sentinels', async () => {
  for (const relative of ['', '.harness', '.harness/skills', '.agents', '.agents/skills', '.claude/skills', '.agents/skills/sample']) {
    const f = await fixture();
    try {
      const target = path.join(f.project, relative);
      const outside = path.join(f.root, 'outside');
      await fs.mkdir(outside);
      await fs.writeFile(path.join(outside, 'sentinel'), 'Keep me');
      await fs.rm(target, { recursive: true, force: true });
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.symlink(outside, target, linkType);
      const before = await hashDirectory(outside);
      assert.notEqual(f.run().status, 0, relative);
      assert.equal(await hashDirectory(outside), before);
      assert.equal((await fs.lstat(target)).isSymbolicLink(), true);
    } finally { await cleanup(f); }
  }
  const f = await fixture();
  try {
    const outside = path.join(f.root, 'manifest-sentinel');
    await fs.writeFile(outside, '{"generated":[]}');
    await fs.symlink(outside, f.manifest);
    assert.notEqual(f.run().status, 0);
    assert.equal(await fs.readFile(outside, 'utf8'), '{"generated":[]}');
  } finally { await cleanup(f); }
});
