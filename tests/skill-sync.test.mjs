import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

async function copyFixtureFile(root, relative) {
  const source = path.join(repositoryRoot, relative);
  const destination = path.join(root, relative);
  try {
    await fs.access(source);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function createFixture({ machineSetup = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-skill-sync-'));
  const home = path.join(root, 'home');
  const files = [
    'scripts/sync-skills.mjs',
    'scripts/skill-lib.mjs',
    'scripts/skill-installation.mjs',
  ];
  if (machineSetup) {
    files.push(
      'scripts/machine-setup.mjs',
      'scripts/config-merge.mjs',
      'scripts/windows-cli.mjs',
      'components/claude-tool-policy.mjs',
      'global/CLAUDE.md',
      'global/AGENTS.md',
      'global/claude-settings.json',
      'global/codex-hooks/hooks.json.template',
    );
  }
  for (const relative of files) await copyFixtureFile(root, relative);

  const skill = path.join(root, 'skills', 'engineering', 'canonical', 'SKILL.md');
  await fs.mkdir(path.dirname(skill), { recursive: true });
  await fs.writeFile(skill, [
    '---',
    'name: canonical',
    'description: "Canonical fixture skill used to verify installation behavior."',
    '---',
    '',
    '# Canonical',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(root, 'skills', 'invocation-policy.json'), '{"userOnly":[]}\n');
  return { root, home };
}

function runScript(root, home, relative, args = []) {
  return spawnSync(process.execPath, [path.join(root, relative), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

test('skill sync archives displaced skills and installs the exact canonical inventory', async () => {
  const fixture = await createFixture();
  try {
    const codexSkills = path.join(fixture.home, '.agents', 'skills');
    const claudeSkills = path.join(fixture.home, '.claude', 'skills');
    await fs.mkdir(path.join(codexSkills, 'canonical'), { recursive: true });
    await fs.writeFile(path.join(codexSkills, 'canonical', 'keep.txt'), 'manual canonical copy\n');
    await fs.mkdir(path.join(codexSkills, 'retired'), { recursive: true });
    await fs.writeFile(path.join(codexSkills, 'retired', 'keep.txt'), 'retired codex skill\n');
    await fs.mkdir(path.join(claudeSkills, 'retired'), { recursive: true });
    await fs.writeFile(path.join(claudeSkills, 'retired', 'keep.txt'), 'retired claude skill\n');
    await fs.mkdir(path.join(codexSkills, '.system'), { recursive: true });
    await fs.writeFile(path.join(codexSkills, 'notes.txt'), 'not a skill entry\n');

    const result = runScript(fixture.root, fixture.home, 'scripts/sync-skills.mjs', ['--apply']);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const expectedCodex = path.join(fixture.root, '.generated', 'skills', 'codex', 'canonical');
    const expectedClaude = path.join(fixture.root, '.generated', 'skills', 'claude', 'canonical');
    assert.equal(path.resolve(await fs.readlink(path.join(codexSkills, 'canonical'))), path.resolve(expectedCodex));
    assert.equal(path.resolve(await fs.readlink(path.join(claudeSkills, 'canonical'))), path.resolve(expectedClaude));
    await assert.rejects(fs.access(path.join(codexSkills, 'retired')), { code: 'ENOENT' });
    await assert.rejects(fs.access(path.join(claudeSkills, 'retired')), { code: 'ENOENT' });
    await fs.access(path.join(codexSkills, '.system'));
    await fs.access(path.join(codexSkills, 'notes.txt'));

    const archiveBase = path.join(fixture.home, '.ai-harness-skill-archive');
    const sessions = await fs.readdir(archiveBase);
    assert.equal(sessions.length, 1);
    const session = path.join(archiveBase, sessions[0]);
    assert.equal(await fs.readFile(path.join(session, 'codex', 'canonical', 'keep.txt'), 'utf8'), 'manual canonical copy\n');
    assert.equal(await fs.readFile(path.join(session, 'codex', 'retired', 'keep.txt'), 'utf8'), 'retired codex skill\n');
    assert.equal(await fs.readFile(path.join(session, 'claude', 'retired', 'keep.txt'), 'utf8'), 'retired claude skill\n');
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('machine setup rejects an unreconcilable skill entry before machine writes', async () => {
  const fixture = await createFixture({ machineSetup: true });
  try {
    const conflict = path.join(fixture.home, '.agents', 'skills', 'canonical');
    await fs.mkdir(path.dirname(conflict), { recursive: true });
    await fs.writeFile(conflict, 'unexpected file\n');

    const result = runScript(fixture.root, fixture.home, 'scripts/machine-setup.mjs');
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Skill sync stopped on conflicts/);
    await assert.rejects(fs.access(path.join(fixture.home, '.codex', 'AGENTS.md')), { code: 'ENOENT' });
    await assert.rejects(fs.access(path.join(fixture.home, '.claude', 'settings.json')), { code: 'ENOENT' });
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});
