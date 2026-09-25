import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { deniedClaudeBuiltInTools } from '../components/claude-tool-policy.mjs';
import { applyFullProfileControls, planFullProfileControls } from '../scripts/full-profile-controls.mjs';
import { applyFullProfileInstallation, planFullProfileInstallation } from '../scripts/full-profile-installation.mjs';
import { discoverSkills, generateSkillTree } from '../scripts/skill-lib.mjs';

const repository = path.resolve(import.meta.dirname, '..');
const setup = path.join(repository, 'scripts', 'setup.mjs');

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function fakeToolEnvironment(root) {
  const bin = path.join(root, 'fake-tools');
  await fs.mkdir(bin, { recursive: true });
  for (const name of ['gh', 'claude', 'codex', 'gitleaks', 'zizmor']) {
    if (process.platform === 'win32') {
      const entry = path.join(bin, 'node_modules', name, 'cli.js');
      await fs.mkdir(path.dirname(entry), { recursive: true });
      await fs.writeFile(entry, 'process.exit(0);\n');
      await fs.writeFile(path.join(bin, `${name}.cmd`), `"%dp0%\\node_modules\\${name}\\cli.js" %*\n`);
    } else {
      const command = path.join(bin, name);
      await fs.writeFile(command, `#!${process.execPath}\nprocess.exit(0);\n`, { mode: 0o700 });
    }
  }
  return { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
}

async function legacyFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-full-profile-'));
  const target = path.join(root, 'home');
  const legacyRoot = path.join(root, 'old checkout');
  await fs.mkdir(target);
  const env = await fakeToolEnvironment(root);
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
  return { root, target, legacyRoot, skills, env };
}

function run(args, env = process.env) {
  return spawnSync(process.execPath, [setup, ...args], { cwd: repository, encoding: 'utf8', env });
}

function runWithHome(script, target, args = []) {
  return spawnSync(process.execPath, [path.join(repository, script), ...args], {
    cwd: repository, encoding: 'utf8', env: { ...process.env, HOME: target, USERPROFILE: target },
  });
}

test('full managed profile migrates both legacy platforms off a moved checkout and audits cleanly', async () => {
  const fixture = await legacyFixture();
  try {
    const args = ['--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target,
      '--legacy-root', fixture.legacyRoot, '--json'];
    const preview = run(['plan', ...args], fixture.env);
    assert.equal(preview.status, 0, preview.stderr || preview.stdout);
    const planned = JSON.parse(preview.stdout);
    assert.equal(planned.applicable, true);
    assert.equal(planned.profile, 'full-managed');
    assert.equal(planned.controls.tools.filter((tool) => tool.required).every((tool) => tool.available), true);
    assert.equal(planned.components.filter((entry) => entry.kind === 'skills')
      .every((entry) => entry.migrated.length === fixture.skills.length), true);
    assert.equal(planned.components.filter((entry) => entry.kind === 'global-configuration')
      .every((entry) => entry.migrated.guidance && entry.migrated.hook), true);

    const apply = run(['apply', ...args, '--apply'], fixture.env);
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
    const profileReceiptPath = path.join(fixture.target, '.ai-harness', 'installations', 'full-managed', 'receipt.json');
    const profileReceipt = JSON.parse(await fs.readFile(profileReceiptPath, 'utf8'));
    assert.equal(profileReceipt.profile, 'full-managed');
    assert.equal(profileReceipt.selected.length, fixture.skills.length);
    assert.equal(profileReceipt.components.length, 4);
    assert.deepEqual(profileReceipt.controls.repositoryHooks, { applicable: false });
    await fs.access(path.join(fixture.target, '.agents', 'skills', '.system'));
    assert.equal(await fs.readFile(path.join(fixture.target, '.agents', 'skills', 'notes.txt'), 'utf8'), 'unmanaged note\n');
    const claudeSettings = JSON.parse(await fs.readFile(path.join(fixture.target, '.claude', 'settings.json'), 'utf8'));
    const codexHooks = JSON.parse(await fs.readFile(path.join(fixture.target, '.codex', 'hooks.json'), 'utf8'));
    assert.deepEqual(claudeSettings.companySetting, { retained: true });
    assert.deepEqual(codexHooks.companySetting, { retained: true });
    assert.equal(JSON.stringify(claudeSettings).includes(fixture.legacyRoot), false);
    assert.equal(JSON.stringify(codexHooks).includes(fixture.legacyRoot), false);

    const audit = run(['audit', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target, '--json'], fixture.env);
    assert.equal(audit.status, 0, audit.stderr || audit.stdout);
    assert.equal(JSON.parse(audit.stdout).applicable, true);
    const repeat = run(['apply', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target, '--json', '--apply'], fixture.env);
    assert.equal(repeat.status, 0, repeat.stderr || repeat.stdout);
    assert.equal(JSON.parse(repeat.stdout).noOp, true);
    const legacySync = runWithHome('scripts/sync-skills.mjs', fixture.target, ['--apply']);
    assert.notEqual(legacySync.status, 0);
    assert.match(`${legacySync.stdout}\n${legacySync.stderr}`, /receipt-backed lifecycle/);
    assert.equal(run(['audit', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target], fixture.env).status, 0);

    profileReceipt.selected.pop();
    await writeJson(profileReceiptPath, profileReceipt);
    const tampered = run(['audit', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target], fixture.env);
    assert.notEqual(tampered.status, 0);
    assert.match(`${tampered.stdout}\n${tampered.stderr}`, /ownership evidence does not match/);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('full-profile application holds the target lock across every component', async () => {
  const fixture = await legacyFixture();
  let competingAttempted = false;
  let toolChecks = 0;
  const runTool = () => {
    toolChecks++;
    return { status: 0, stdout: 'test\n' };
  };
  try {
    const plan = await planFullProfileInstallation(repository, { operation: 'apply', platform: 'both',
      scope: 'machine', target: fixture.target, legacyRoot: fixture.legacyRoot, runTool });
    const result = await applyFullProfileInstallation(plan, { checkpoint: async (phase, component) => {
      if (phase !== 'component' || component !== 'claude skills' || competingAttempted) return;
      competingAttempted = true;
      const competing = run(['apply', '--select', 'tdd', '--platform', 'claude', '--scope', 'machine',
        '--target', fixture.target, '--apply', '--json'], fixture.env);
      assert.notEqual(competing.status, 0);
      assert.match(`${competing.stdout}\n${competing.stderr}`, /Target is locked/);
    } });
    assert.equal(competingAttempted, true);
    assert.equal(toolChecks > 36, true);
    assert.equal(result.installed, true);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('full-profile migration rejects ambiguous ownership and noncanonical discovery before writes', async () => {
  for (const kind of ['changed-link', 'edited-payload', 'linked-legacy-root', 'extra-skill', 'custom-agent']) {
    const fixture = await legacyFixture();
    try {
      if (kind === 'changed-link') {
        const link = path.join(fixture.target, '.agents', 'skills', fixture.skills[0].name);
        await fs.unlink(link);
        await fs.symlink(path.join(fixture.root, 'unrelated'), link, process.platform === 'win32' ? 'junction' : 'dir');
      } else if (kind === 'edited-payload') {
        await fs.appendFile(path.join(fixture.legacyRoot, '.generated', 'skills', 'codex',
          fixture.skills[0].name, 'SKILL.md'), '\nLocal legacy edit\n');
      } else if (kind === 'linked-legacy-root') {
        const realLegacyRoot = path.join(fixture.root, 'real legacy checkout');
        await fs.rename(fixture.legacyRoot, realLegacyRoot);
        await fs.symlink(realLegacyRoot, fixture.legacyRoot, process.platform === 'win32' ? 'junction' : 'dir');
      } else if (kind === 'extra-skill') await fs.mkdir(path.join(fixture.target, '.claude', 'skills', 'company-skill'));
      else {
        await fs.mkdir(path.join(fixture.target, '.claude', 'agents'), { recursive: true });
        await fs.writeFile(path.join(fixture.target, '.claude', 'agents', 'company.md'), '# Company agent\n');
      }
      const result = run(['plan', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target,
        '--legacy-root', fixture.legacyRoot, '--json'], fixture.env);
      assert.notEqual(result.status, 0, kind);
      assert.equal(JSON.parse(result.stdout).applicable, false, kind);
      await assert.rejects(fs.access(path.join(fixture.target, '.ai-harness')), { code: 'ENOENT' });
    } finally {
      await fs.rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test('full-profile audit rejects a partial selective installation without full-profile ownership', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-partial-profile-'));
  const target = path.join(root, 'home');
  await fs.mkdir(target);
  const env = await fakeToolEnvironment(root);
  try {
    for (const platform of ['claude', 'codex']) {
      const skill = run(['apply', '--select', 'tdd', '--platform', platform, '--scope', 'machine',
        '--target', target, '--apply', '--json']);
      assert.equal(skill.status, 0, skill.stderr || skill.stdout);
      const global = run(['apply', '--module', 'global-configuration', '--platform', platform, '--scope', 'machine',
        '--target', target, '--apply', '--json']);
      assert.equal(global.status, 0, global.stderr || global.stdout);
    }

    const audit = run(['audit', '--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', target, '--json'], env);
    assert.notEqual(audit.status, 0, audit.stderr || audit.stdout);
    const result = JSON.parse(audit.stdout);
    assert.equal(result.applicable, false);
    assert.equal(result.installed, false);
    assert.match(result.conflicts.join('\n'), /full-profile receipt|exact inventory/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('full-profile removal removes owned components and preserves unrelated target content', async () => {
  const fixture = await legacyFixture();
  const unrelated = path.join(fixture.target, '.agents', 'skills', 'notes.txt');
  try {
    const common = ['--profile', 'full', '--platform', 'both', '--scope', 'machine', '--target', fixture.target, '--json'];
    const apply = run(['apply', ...common, '--legacy-root', fixture.legacyRoot, '--apply'], fixture.env);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);

    const preview = run(['remove', ...common], fixture.env);
    assert.equal(preview.status, 0, preview.stderr || preview.stdout);
    assert.equal(JSON.parse(preview.stdout).changes.length > 0, true);
    await fs.access(path.join(fixture.target, '.ai-harness', 'installations', 'full-managed', 'receipt.json'));

    const remove = run(['remove', ...common, '--apply'], fixture.env);
    assert.equal(remove.status, 0, remove.stderr || remove.stdout);
    const result = JSON.parse(remove.stdout);
    assert.equal(result.installed, false);
    assert.equal(result.applied, true);
    await assert.rejects(fs.access(path.join(fixture.target, '.ai-harness', 'installations', 'full-managed', 'receipt.json')), { code: 'ENOENT' });
    for (const platform of ['claude', 'codex']) {
      const discovery = path.join(fixture.target, platform === 'codex' ? '.agents' : '.claude', 'skills');
      for (const skill of fixture.skills) await assert.rejects(fs.lstat(path.join(discovery, skill.name)), { code: 'ENOENT' });
    }
    assert.equal(await fs.readFile(unrelated, 'utf8'), 'unmanaged note\n');
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('full-profile removal uses retained ownership after the source catalog changes', async () => {
  const fixture = await legacyFixture();
  const changedRepository = path.join(fixture.root, 'changed repository');
  await fs.mkdir(changedRepository);
  try {
    const apply = run(['apply', '--profile', 'full', '--platform', 'both', '--scope', 'machine',
      '--target', fixture.target, '--legacy-root', fixture.legacyRoot, '--apply', '--json'], fixture.env);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);

    const removalPlan = await planFullProfileInstallation(changedRepository, { operation: 'remove',
      platform: 'both', scope: 'machine', target: fixture.target });
    assert.equal(removalPlan.applicable, true, removalPlan.conflicts.join('\n'));
    const removal = await applyFullProfileInstallation(removalPlan);
    assert.equal(removal.installed, false);
    await assert.rejects(fs.access(path.join(fixture.target, '.ai-harness', 'installations',
      'full-managed', 'receipt.json')), { code: 'ENOENT' });
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('full-profile machine controls preflight tools and restore owned Git and Windows state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-machine-controls-'));
  const target = path.join(root, 'home');
  const repositoryRoot = path.join(root, 'repository');
  await fs.mkdir(target);
  await fs.mkdir(repositoryRoot);
  assert.equal(spawnSync('git', ['init', '--quiet'], { cwd: repositoryRoot }).status, 0);
  assert.equal(spawnSync('git', ['config', '--local', 'core.hooksPath', 'company-hooks'], { cwd: repositoryRoot }).status, 0);
  const external = { memory: null };
  const runTool = (command, args, options = {}) => {
    if (command === 'git') return spawnSync(command, args, { encoding: 'utf8', ...options });
    if (args.includes('--version') || (command === 'gitleaks' && args[0] === 'version')) return { status: 0, stdout: 'test\n' };
    if (command === 'reg.exe' && args[0] === 'query') return external.memory === null
      ? { status: 1, stdout: '' }
      : { status: 0, stdout: `    CLAUDE_CODE_DISABLE_AUTO_MEMORY    REG_SZ    ${external.memory}\r\n` };
    if (command === 'reg.exe' && args[0] === 'delete') { external.memory = null; return { status: 0, stdout: '' }; }
    if (command === 'setx') { external.memory = args[1]; return { status: 0, stdout: '' }; }
    return { status: 0, stdout: 'test\n' };
  };
  try {
    const applyPlan = await planFullProfileControls(repositoryRoot, { operation: 'apply', target,
      home: target, systemPlatform: 'win32', runTool });
    assert.equal(applyPlan.applicable, true);
    assert.deepEqual(applyPlan.changes.map(({ id }) => id), ['repository-hooks', 'windows-memory-lock']);
    assert.deepEqual(applyPlan.ownership.repositoryHooks.prior, { present: true, value: 'company-hooks' });
    assert.deepEqual(applyPlan.ownership.windowsMemoryLock.prior, { present: false });
    await applyFullProfileControls(applyPlan);
    assert.equal(spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout.trim(), '.githooks');
    assert.equal(external.memory, '1');

    const audit = await planFullProfileControls(repositoryRoot, { operation: 'audit', target,
      previous: applyPlan.ownership, home: target, systemPlatform: 'win32', runTool });
    assert.equal(audit.applicable, true);
    assert.deepEqual(audit.changes, []);

    const removePlan = await planFullProfileControls(repositoryRoot, { operation: 'remove', target,
      previous: applyPlan.ownership, home: target, systemPlatform: 'win32', runTool });
    await applyFullProfileControls(removePlan);
    assert.equal(spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout.trim(), 'company-hooks');
    assert.equal(external.memory, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('full-profile machine controls fail closed on missing tools and stale external state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-machine-control-denied-'));
  const target = path.join(root, 'home');
  await fs.mkdir(target);
  const external = { hooks: null };
  const missingRunner = (command, args) => {
    if (command === 'git' && args.includes('--get')) return { status: 1, stdout: '' };
    return { status: command === process.execPath ? 0 : 1, stdout: '' };
  };
  const statefulRunner = (command, args) => {
    if (args.includes('--version') || (command === 'gitleaks' && args[0] === 'version')) return { status: 0, stdout: 'test\n' };
    if (command === 'git' && args.includes('--get')) return external.hooks === null
      ? { status: 1, stdout: '' } : { status: 0, stdout: `${external.hooks}\n` };
    if (command === 'git' && args[0] === 'config') { external.hooks = args.at(-1); return { status: 0, stdout: '' }; }
    return { status: 0, stdout: 'test\n' };
  };
  try {
    const missing = await planFullProfileControls(root, { operation: 'apply', target,
      home: path.join(root, 'other-home'), runTool: missingRunner });
    assert.equal(missing.applicable, false);
    assert.match(missing.conflicts.join('\n'), /Required tool is unavailable: git/);

    const stale = await planFullProfileControls(root, { operation: 'apply', target,
      home: target, systemPlatform: 'linux', runTool: statefulRunner });
    external.hooks = 'raced-hooks';
    await assert.rejects(applyFullProfileControls(stale), /Machine-control conflicts|preconditions changed/);
    assert.equal(external.hooks, 'raced-hooks');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
