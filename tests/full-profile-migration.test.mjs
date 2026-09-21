import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { deniedClaudeBuiltInTools } from '../components/claude-tool-policy.mjs';
import { discoverSkills, generateSkillTree } from '../scripts/skill-lib.mjs';

const repository = path.resolve(import.meta.dirname, '..');
const setup = path.join(repository, 'scripts', 'setup.mjs');

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function legacyFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-full-profile-'));
  const target = path.join(root, 'home');
  const legacyRoot = path.join(root, 'old checkout');
  await fs.mkdir(target);
  await generateSkillTree(path.join(repository, 'skills'), path.join(legacyRoot, '.generated', 'skills'));
  const skills = await discoverSkills(path.join(repository, 'skills'));
  for (const platform of ['claude', 'codex']) {
    const discovery = path.join(target, platform === 'codex' ? '.agents' : '.claude', 'skills');
    await fs.mkdir(discovery, { recursive: true });
    for (const skill of skills) {
      await fs.symlink(path.join(legacyRoot, '.generated', 'skills', platform, skill.name), path.join(discovery, skill.name),
        process.platform === 'win32' ? 'junction' : 'dir');
    }
  }
  await fs.mkdir(path.join(target, '.agents', 'skills', '.system'));
  await fs.writeFile(path.join(target, '.agents', 'skills', 'notes.txt'), 'unmanaged note\n');

  const claudeGuidance = (await fs.readFile(path.join(repository, 'global', 'CLAUDE.md'), 'utf8')).replaceAll('{{HARNESS_ROOT}}', legacyRoot);
  const codexGuidance = (await fs.readFile(path.join(repository, 'global', 'AGENTS.md'), 'utf8')).replaceAll('{{HARNESS_ROOT}}', legacyRoot);
  await fs.mkdir(path.join(target, '.codex'), { recursive: true });
  await fs.writeFile(path.join(target, '.claude', 'CLAUDE.md'), claudeGuidance);
  await fs.writeFile(path.join(target, '.codex', 'AGENTS.md'), codexGuidance);

  const claude = JSON.parse((await fs.readFile(path.join(repository, 'global', 'claude-settings.json'), 'utf8'))
    .replaceAll('{{HARNESS_ROOT}}', legacyRoot.replaceAll('\\', '/')));
  claude.permissions.deny.push(...deniedClaudeBuiltInTools, 'Read(**/company-private)');
  claude.companySetting = { retained: true };
  claude.hooks.PreToolUse.push({ matcher: 'Read', hooks: [{ type: 'command', command: 'company-check' }] });
  await writeJson(path.join(target, '.claude', 'settings.json'), claude);

  const codex = JSON.parse((await fs.readFile(path.join(repository, 'global', 'codex-hooks', 'hooks.json.template'), 'utf8'))
    .replaceAll('{{HARNESS_ROOT}}', legacyRoot.replaceAll('\\', '/'))
    .replaceAll('{{HARNESS_ROOT_WINDOWS}}', legacyRoot.replaceAll('\\', '\\\\')));
  codex.companySetting = { retained: true };
  codex.hooks.PreToolUse.push({ matcher: 'Read', hooks: [{ type: 'command', command: 'company-check' }] });
  await writeJson(path.join(target, '.codex', 'hooks.json'), codex);
  return { root, target, legacyRoot, skills };
}

function run(args) {
  return spawnSync(process.execPath, [setup, ...args], { cwd: repository, encoding: 'utf8' });
}

test('full managed profile migrates both legacy platforms off a moved checkout and audits cleanly', async () => {
  const fixture = await legacyFixture();
  try {
    const args = ['--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target,
      '--legacy-root', fixture.legacyRoot, '--json'];
    const preview = run(['plan', ...args]);
    assert.equal(preview.status, 0, preview.stderr || preview.stdout);
    const planned = JSON.parse(preview.stdout);
    assert.equal(planned.applicable, true);
    assert.equal(planned.components.filter((entry) => entry.kind === 'skills')
      .every((entry) => entry.migrated.length === fixture.skills.length), true);
    assert.equal(planned.components.filter((entry) => entry.kind === 'global-configuration')
      .every((entry) => entry.migrated.guidance && entry.migrated.hook), true);

    const apply = run(['apply', ...args, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    await fs.rm(fixture.legacyRoot, { recursive: true, force: true });
    const canonicalTarget = await fs.realpath(fixture.target);

    for (const platform of ['claude', 'codex']) {
      const discovery = path.join(fixture.target, platform === 'codex' ? '.agents' : '.claude', 'skills');
      for (const skill of fixture.skills) {
        const resolved = await fs.realpath(path.join(discovery, skill.name));
        assert.equal(resolved.startsWith(path.join(canonicalTarget, '.ai-harness', 'installations', platform, 'payloads')), true);
      }
      await fs.access(path.join(fixture.target, '.ai-harness', 'installations', platform, 'receipt.json'));
      await fs.access(path.join(fixture.target, '.ai-harness', 'installations', platform, 'global.json'));
    }
    await fs.access(path.join(fixture.target, '.agents', 'skills', '.system'));
    assert.equal(await fs.readFile(path.join(fixture.target, '.agents', 'skills', 'notes.txt'), 'utf8'), 'unmanaged note\n');
    const claudeSettings = JSON.parse(await fs.readFile(path.join(fixture.target, '.claude', 'settings.json'), 'utf8'));
    const codexHooks = JSON.parse(await fs.readFile(path.join(fixture.target, '.codex', 'hooks.json'), 'utf8'));
    assert.deepEqual(claudeSettings.companySetting, { retained: true });
    assert.deepEqual(codexHooks.companySetting, { retained: true });
    assert.equal(JSON.stringify(claudeSettings).includes(fixture.legacyRoot), false);
    assert.equal(JSON.stringify(codexHooks).includes(fixture.legacyRoot), false);

    const audit = run(['audit', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target, '--json']);
    assert.equal(audit.status, 0, audit.stderr || audit.stdout);
    assert.equal(JSON.parse(audit.stdout).applicable, true);
    const repeat = run(['apply', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target, '--json', '--apply']);
    assert.equal(repeat.status, 0, repeat.stderr || repeat.stdout);
    assert.equal(JSON.parse(repeat.stdout).noOp, true);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('full-profile migration rejects ambiguous ownership and noncanonical discovery before writes', async () => {
  for (const kind of ['changed-link', 'extra-skill', 'custom-agent']) {
    const fixture = await legacyFixture();
    try {
      if (kind === 'changed-link') {
        const link = path.join(fixture.target, '.agents', 'skills', fixture.skills[0].name);
        await fs.unlink(link);
        await fs.symlink(path.join(fixture.root, 'unrelated'), link, process.platform === 'win32' ? 'junction' : 'dir');
      } else if (kind === 'extra-skill') await fs.mkdir(path.join(fixture.target, '.claude', 'skills', 'company-skill'));
      else {
        await fs.mkdir(path.join(fixture.target, '.claude', 'agents'), { recursive: true });
        await fs.writeFile(path.join(fixture.target, '.claude', 'agents', 'company.md'), '# Company agent\n');
      }
      const result = run(['plan', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target,
        '--legacy-root', fixture.legacyRoot, '--json']);
      assert.notEqual(result.status, 0, kind);
      assert.equal(JSON.parse(result.stdout).applicable, false, kind);
      await assert.rejects(fs.access(path.join(fixture.target, '.ai-harness')), { code: 'ENOENT' });
    } finally {
      await fs.rm(fixture.root, { recursive: true, force: true });
    }
  }
});
