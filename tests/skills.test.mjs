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
  assert.equal(skills.length, 19);
  for (const name of userOnly) assert.ok(names.has(name), `missing user-only skill ${name}`);
  assert.ok(userOnly.has('teach'));
  assert.ok(!userOnly.has('research'));
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
