import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverSkills, generateSkillTree, readInvocationPolicy } from '../scripts/skill-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'skills');

test('canonical skill inventory and invocation policy are consistent', async () => {
  const skills = await discoverSkills(source);
  const names = new Set(skills.map((skill) => skill.name));
  const userOnly = await readInvocationPolicy(source);
  assert.equal(skills.length, 22);
  for (const name of userOnly) assert.ok(names.has(name), `missing user-only skill ${name}`);
  assert.ok(userOnly.has('teach'));
  assert.ok(userOnly.has('to-questionnaire'));
  assert.ok(userOnly.has('wait-what'));
  assert.ok(!userOnly.has('research'));
  assert.ok(!userOnly.has('writing-for-agents'));
});

test('Claude and Codex adapters encode user-only policy differently', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-generation-'));
  try {
    await generateSkillTree(source, output);
    const claudeTeach = await fs.readFile(path.join(output, 'claude', 'teach', 'SKILL.md'), 'utf8');
    const codexTeach = await fs.readFile(path.join(output, 'codex', 'teach', 'agents', 'openai.yaml'), 'utf8');
    const codexResearch = await fs.readFile(path.join(output, 'codex', 'research', 'agents', 'openai.yaml'), 'utf8');
    assert.match(claudeTeach, /disable-model-invocation: true/);
    assert.match(codexTeach, /allow_implicit_invocation: false/);
    assert.match(codexResearch, /allow_implicit_invocation: true/);
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
});

test('failed rendering preserves the entire previous generated tree and live links', async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'staged-generation-'));
  try {
    const source = path.join(fixture, 'source');
    const output = path.join(fixture, 'generated');
    await fs.mkdir(path.join(source, 'first'), { recursive: true });
    await fs.mkdir(path.join(source, 'second'));
    for (const name of ['first', 'second']) await fs.writeFile(path.join(source, name, 'SKILL.md'), `---\nname: ${name}\ndescription: A sample skill for staging tests.\n---\nBody\n`);
    await generateSkillTree(source, output);
    const { hashDirectory } = await import('../scripts/skill-lib.mjs');
    const before = await hashDirectory(output);
    const link = path.join(fixture, 'installed');
    await fs.symlink(path.join(output, 'codex', 'first'), link, process.platform === 'win32' ? 'junction' : 'dir');
    await fs.appendFile(path.join(source, 'first', 'SKILL.md'), 'New body');
    await fs.symlink(path.join(fixture, 'missing'), path.join(source, 'second', 'linked-resource'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(generateSkillTree(source, output), /Unsafe adapter resource/);
    assert.equal(await hashDirectory(output), before);
    assert.doesNotMatch(await fs.readFile(path.join(link, 'SKILL.md'), 'utf8'), /New body/);
    assert.ok(!(await fs.readdir(fixture)).some((name) => name.startsWith('.skill-generation-')));
  } finally { await fs.rm(fixture, { recursive: true, force: true }); }
});

test('generation rejects a linked output root without touching its destination', async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'linked-generation-'));
  try {
    const outside = path.join(fixture, 'outside');
    const output = path.join(fixture, 'output');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'sentinel'), 'Keep me');
    await fs.symlink(outside, output, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(generateSkillTree(source, output), /real directory/);
    assert.equal(await fs.readFile(path.join(outside, 'sentinel'), 'utf8'), 'Keep me');
    assert.equal((await fs.lstat(output)).isSymbolicLink(), true);
  } finally { await fs.rm(fixture, { recursive: true, force: true }); }
});

test('failed publication restores previous generated payloads', async (t) => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'generation-rollback-'));
  const output = path.join(fixture, 'generated');
  try {
    await fs.mkdir(output);
    await fs.writeFile(path.join(output, 'sentinel'), 'Previous payload');
    const rename = fs.rename;
    t.mock.method(fs, 'rename', async (from, to) => {
      if (path.basename(from) === 'payload' && to === output) throw new Error('Injected publication failure');
      return rename(from, to);
    });
    await assert.rejects(generateSkillTree(source, output), /Injected publication failure/);
    assert.equal(await fs.readFile(path.join(output, 'sentinel'), 'utf8'), 'Previous payload');
    assert.deepEqual(await fs.readdir(fixture), ['generated']);
  } finally { await fs.rm(fixture, { recursive: true, force: true }); }
});
