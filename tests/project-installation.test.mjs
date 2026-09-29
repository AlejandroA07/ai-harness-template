import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { planProjectInstallation, applyProjectInstallation } from '../scripts/project-installation.mjs';
import { snapshot } from './helpers/filesystem-snapshot.mjs';
import { digest } from '../scripts/installation-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
async function fixture(body) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'project lifecycle '));
  const source = path.join(temporary, 'source');
  const target = path.join(temporary, 'project');
  const home = path.join(temporary, 'home');
  try {
    await fs.mkdir(source); await fs.mkdir(target); await fs.mkdir(home);
    for (const name of ['scripts', 'components', 'project', 'catalog', 'skills', 'global']) await fs.cp(path.join(root, name), path.join(source, name), { recursive: true });
    const put = async (file, bytes) => { await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true }); await fs.writeFile(path.join(target, file), bytes); };
    const read = (file) => fs.readFile(path.join(target, file), 'utf8');
    const options = (platform = 'codex', operation = 'apply', extra = {}) => ({ platform, operation, target, scope: 'project', ...extra });
    const plan = (platform, operation, extra) => planProjectInstallation(source, options(platform, operation, extra));
    const apply = async (platform, operation, extra, hooks) => applyProjectInstallation(await plan(platform, operation, extra), hooks);
    await put('scripts/verify.mjs', "console.log('Project verifier ran');\n");
    await body({ source, target, home, temporary, put, read, plan, apply, options });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
const skill = (name = 'sample') => `---\nname: ${name}\ndescription: A project fixture skill\n---\n\nUse the project fixture.\n`;
const run = (target, script) => spawnSync(process.execPath, [script], { cwd: target, encoding: 'utf8' });

test('project lifecycle leaves agent settings under machine authority', async () => fixture(async (f) => {
  const files = {
    '.claude/settings.json': '{ invalid user-owned Claude settings',
    '.codex/hooks.json': '{ invalid user-owned Codex hooks',
    '.codex/config.toml': '[features]\nhooks = false\n',
  };
  for (const [file, bytes] of Object.entries(files)) await f.put(file, bytes);
  await f.apply('claude');
  await f.apply('codex');
  for (const [file, bytes] of Object.entries(files)) assert.equal(await f.read(file), bytes);
  await f.apply('claude', 'remove');
  await f.apply('codex', 'remove');
  for (const [file, bytes] of Object.entries(files)) assert.equal(await f.read(file), bytes);
}));

test('review regression: forged file and state ownership never authorizes mutation', async () => {
  for (const kind of ['file', 'schema', 'ignore']) await fixture(async (f) => {
    await f.put('AGENTS.md', 'User-owned guidance\n');
    await f.apply('claude'); await f.apply('codex');
    const receipt = JSON.parse(await f.read('.harness/project-installation.json'));
    if (kind === 'file') receipt.owned['AGENTS.md'] = digest(await f.read('AGENTS.md'));
    if (kind === 'schema') { receipt.version = 3; receipt.settings = {}; receipt.codexFeatures = null; }
    if (kind === 'ignore') receipt.ignore.owned = false;
    await f.put('.harness/project-installation.json', JSON.stringify(receipt));
    const before = await snapshot(f.target);
    await assert.rejects(f.apply('codex', 'remove'), undefined, kind);
    assert.deepEqual(await snapshot(f.target), before);
    await assert.rejects(f.apply('claude'), undefined, kind);
    assert.deepEqual(await snapshot(f.target), before);
    assert.notEqual(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  });
});

test('review regression: domain and tracker FIFOs fail without blocking', { skip: process.platform === 'win32' }, async () => {
  for (const file of ['CONTEXT.md', 'CONTEXT-MAP.md', 'docs/agents/domain.md', 'docs/agents/issue-tracker.md']) await fixture(async (f) => {
    await fs.mkdir(path.dirname(path.join(f.target, file)), { recursive: true });
    assert.equal(spawnSync('mkfifo', [path.join(f.target, file)]).status, 0);
    const result = spawnSync(process.execPath, [path.join(f.source, 'scripts/bootstrap.mjs'), f.target], { encoding: 'utf8', timeout: 2000 });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    await assert.rejects(fs.access(path.join(f.target, '.ai-harness-install.lock')));
  });
});

test('project payload evidence is required and legacy receipts fail without writes', async () => {
  for (const kind of ['missing', 'edited', 'legacy']) await fixture(async (f) => {
    await f.apply();
    const receipt = JSON.parse(await f.read('.harness/project-installation.json'));
    const manifest = `.harness/project-payloads/${receipt.payload}/manifest.json`;
    if (kind === 'missing') await fs.unlink(path.join(f.target, manifest));
    if (kind === 'edited') await f.put(manifest, '{}');
    if (kind === 'legacy') {
      receipt.version = 1; delete receipt.payload;
      await f.put('.harness/project-installation.json', JSON.stringify(receipt));
    }
    const before = await snapshot(f.target);
    await assert.rejects(f.apply('codex', 'remove'));
    await assert.rejects(f.apply());
    assert.deepEqual(await snapshot(f.target), before);
    assert.notEqual(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  });
});

test('review regression: removal preserves retained platform bytes despite changed sources', async () => fixture(async (f) => {
  await f.put('.harness/skills/sample/SKILL.md', skill());
  await f.apply('codex'); await f.apply('claude');
  const before = {};
  for (const file of ['AGENTS.md', 'CLAUDE.md', '.claude/skills/sample/SKILL.md', '.harness/project-runtime/project-state.mjs']) before[file] = await f.read(file);
  await fs.appendFile(path.join(f.source, 'project/AGENTS.md.template'), '\nUpstream revision\n');
  await fs.appendFile(path.join(f.source, 'scripts/project-state.mjs'), '\n// Upstream revision\n');
  await f.put('.harness/skills/sample/SKILL.md', skill() + '\nLocal draft revision\n');
  const plan = await f.plan('codex', 'remove');
  assert.ok(!plan.changes.some((change) => Object.hasOwn(before, change.id)));
  await applyProjectInstallation(plan);
  for (const [file, bytes] of Object.entries(before)) assert.equal(await f.read(file), bytes);
  await fs.rm(path.join(f.source, 'project'), { recursive: true });
  await f.put('.harness/skills/sample/SKILL.md', 'Invalid draft');
  await f.apply('claude', 'remove');
  assert.equal(await f.read('.harness/skills/sample/SKILL.md'), 'Invalid draft');
}));

test('review regression: nested .NET entry points are explicit and ambiguous layouts fail planning', async () => fixture(async (f) => {
  await fs.unlink(path.join(f.target, 'scripts/verify.mjs'));
  await f.put('src/app/App.csproj', '<Project />');
  await f.apply();
  const generated = await f.read('scripts/verify.mjs');
  for (const verb of ['restore', 'build', 'format', 'test']) assert.ok(generated.includes(`"${verb}",\n      "./src/app/App.csproj"`), verb);
  await f.apply('codex', 'remove');
  await f.put('src/other/Other.csproj', '<Project />');
  const plan = await f.plan('codex', 'apply', { domainLayout: 'single' });
  assert.equal(plan.applicable, false);
  assert.ok(plan.conflicts.some((message) => message.includes('.NET')));
}));

test('selected project lifecycle preserves an existing verifier, unrelated platform and Git configuration', async () => {
  for (const platform of ['codex', 'claude']) await fixture(async (f) => {
    await f.put('AGENTS.md', 'Existing project rules\n');
    await f.put('.git/config', '[core]\n hooksPath = existing-hooks\n');
    await f.put('.claude/settings.json', '{"unrelated":"claude"}');
    await f.put('.codex/hooks.json', '{"unrelated":"codex"}');
    await f.put('.codex/config.toml', '[features]\nhooks = false\n');
    const home = await snapshot(f.home);
    const git = await f.read('.git/config');
    const verifier = await f.read('scripts/verify.mjs');
    const before = await snapshot(f.target);
    const preview = await f.plan(platform);
    assert.equal(preview.applicable, true, preview.conflicts.join('; '));
    assert.deepEqual(await snapshot(f.target), before);
    await applyProjectInstallation(preview);
    assert.equal(await f.read('scripts/verify.mjs'), verifier);
    assert.equal(await f.read('AGENTS.md'), 'Existing project rules\n');
    assert.equal(await f.read('.git/config'), git);
    const installed = await snapshot(f.target);
    assert.equal((await f.apply(platform)).noOp, true);
    assert.deepEqual(await snapshot(f.target), installed);
    assert.equal((await f.plan(platform, 'audit')).applicable, true);
    await fs.rename(f.source, path.join(f.temporary, 'moved-source'));
    const checked = run(f.target, 'scripts/verify-harness.mjs');
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /Project verifier ran/);
    await fs.rename(path.join(f.temporary, 'moved-source'), f.source);
    await f.apply(platform, 'remove');
    assert.equal(await f.read('scripts/verify.mjs'), verifier);
    assert.equal(await f.read('AGENTS.md'), 'Existing project rules\n');
    await assert.rejects(f.read('.harness/project-installation.json'));
    assert.deepEqual(await snapshot(f.home), home);
  });
});

test('project adapters preserve policy/resources, detect drift in the shipped gate and retain another consumer', async () => fixture(async (f) => {
  await f.put('.harness/skills/team/sample/SKILL.md', skill());
  await f.put('.harness/skills/team/sample/examples.md', 'Fixture resource\n');
  await f.put('.harness/skills/invocation-policy.json', JSON.stringify({ userOnly: ['sample'] }));
  await f.apply(); await f.apply('claude');
  assert.match(await f.read('.claude/skills/sample/SKILL.md'), /disable-model-invocation: true/);
  assert.match(await f.read('.agents/skills/sample/agents/openai.yaml'), /allow_implicit_invocation: false/);
  assert.equal(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  await f.put('.harness/skills/team/sample/examples.md', 'Changed resource\n');
  const stale = run(f.target, 'scripts/verify-harness.mjs');
  assert.notEqual(stale.status, 0);
  assert.doesNotMatch(stale.stdout, /Project verifier ran/);
  assert.equal((await f.plan('codex', 'audit')).applicable, false);
  await f.apply();
  assert.equal(await f.read('.agents/skills/sample/examples.md'), 'Changed resource\n');
  await f.apply('codex', 'remove');
  await assert.rejects(f.read('.agents/skills/sample/SKILL.md'));
  assert.equal(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  assert.match(await f.read('.claude/skills/sample/SKILL.md'), /name: sample/);
  await f.apply('claude', 'remove');
  assert.equal(await f.read('.harness/skills/team/sample/examples.md'), 'Changed resource\n');
}));

test('project ownership denies unsafe paths, edited files and malformed receipts before writes', async () => {
  for (const kind of ['root-link', 'parent-link', 'hardlink', 'edited', 'receipt', 'adapter-extra']) await fixture(async (f) => {
    if (['edited', 'receipt', 'adapter-extra'].includes(kind)) {
      await f.put('.harness/skills/sample/SKILL.md', skill());
      await f.apply();
    }
    const outside = path.join(f.temporary, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'sentinel'), 'Keep');
    if (kind === 'root-link') { await fs.rename(f.target, path.join(f.temporary, 'saved')); await fs.symlink(outside, f.target, process.platform === 'win32' ? 'junction' : 'dir'); }
    if (kind === 'parent-link') await fs.symlink(outside, path.join(f.target, '.harness'), process.platform === 'win32' ? 'junction' : 'dir');
    if (kind === 'hardlink') await fs.link(path.join(outside, 'sentinel'), path.join(f.target, 'AGENTS.md'));
    if (kind === 'edited') await f.put('scripts/verify-harness.mjs', 'User edit');
    if (kind === 'receipt') {
      const receipt = JSON.parse(await f.read('.harness/project-installation.json'));
      receipt.owned['../outside/sentinel'] = 'a'.repeat(64);
      await f.put('.harness/project-installation.json', JSON.stringify(receipt));
    }
    if (kind === 'adapter-extra') await f.put('.agents/skills/sample/user.md', 'Unowned resource');
    const before = await snapshot(f.temporary);
    await assert.rejects(f.apply(), undefined, kind);
    assert.deepEqual(await snapshot(f.temporary), before, kind);
  });
});

test('project publication rolls back install, update and removal and rejects stale plans', async () => {
  for (const operation of ['install', 'update', 'remove']) for (const phase of ['staged', 'file', 'receipt']) await fixture(async (f) => {
    if (operation !== 'install') await f.apply();
    if (operation === 'update') await fs.appendFile(path.join(f.source, 'project/AGENTS.md.template'), '\nFixture update\n');
    const originals = {};
    for (const file of ['AGENTS.md', 'scripts/verify-harness.mjs', '.harness/project-runtime/project-state.mjs', '.harness/project-installation.json']) originals[file] = await f.read(file).catch(() => null);
    await assert.rejects(f.apply('codex', operation === 'remove' ? 'remove' : 'apply', {}, { checkpoint: async (point) => { if (point === phase) throw new Error('Injected failure'); } }), /rolled back/);
    for (const [file, bytes] of Object.entries(originals)) assert.equal(await f.read(file).catch(() => null), bytes);
    await assert.rejects(fs.access(path.join(f.target, '.ai-harness-install.lock')));
  });
  await fixture(async (f) => {
    const stale = await f.plan();
    await f.put('scripts/verify.mjs', 'Changed verifier');
    const before = await snapshot(f.target);
    await assert.rejects(applyProjectInstallation(stale), /preconditions changed/);
    assert.deepEqual(await snapshot(f.target), before);
  });
});

test('project CI is opt-in, has declared tools, preserves existing workflows and blocks unsupported dependencies', async () => fixture(async (f) => {
  await fs.unlink(path.join(f.target, 'scripts/verify.mjs'));
  await f.put('package.json', JSON.stringify({ scripts: { test: 'node --test' } }));
  await f.put('package-lock.json', '{}');
  await f.put('.github/workflows/verify.yml', 'Existing CI\n');
  const preview = await f.plan('codex', 'apply', { ci: 'github' });
  assert.equal(preview.applicable, true, preview.conflicts.join('; '));
  await applyProjectInstallation(preview);
  const workflow = await f.read('.github/workflows/harness-project.yml');
  for (const expected of ['actions/setup-node@', 'actions/setup-python@', 'GITLEAKS_VERSION', 'ZIZMOR_VERSION', 'node scripts/verify-harness.mjs']) assert.ok(workflow.includes(expected));
  assert.equal(await f.read('.github/workflows/verify.yml'), 'Existing CI\n');
  const verifier = await f.read('scripts/verify.mjs');
  assert.match(verifier, /"ci"/);
  assert.match(verifier, /"test"/);
  await f.apply('codex', 'remove');
  assert.equal(await f.read('.github/workflows/verify.yml'), 'Existing CI\n');
  await f.put('pnpm-lock.yaml', 'lockfileVersion: 9');
  assert.equal((await f.plan('codex', 'apply', { ci: 'github' })).applicable, false);
}));

test('project domain and tracker contracts require explicit resolution of contradictory evidence', async () => fixture(async (f) => {
  await f.put('package.json', JSON.stringify({ workspaces: ['apps/*'] }));
  const initial = await f.plan();
  assert.equal(initial.applicable, false);
  assert.ok(initial.conflicts.some((entry) => entry.includes('Domain boundaries')));
  await f.apply('codex', 'apply', { domainLayout: 'multi', tracker: 'github' });
  assert.match(await f.read('docs/agents/domain.md'), /CONTEXT-MAP/);
  assert.match(await f.read('docs/agents/issue-tracker.md'), /# Issue tracker: GitHub/);
  assert.equal((await f.plan('codex', 'apply', { domainLayout: 'single' })).applicable, false);
}));

test('bootstrap is the single public project command and remains read-only by default', async () => fixture(async (f) => {
  const bootstrap = (...args) => spawnSync(process.execPath, [path.join(f.source, 'scripts/bootstrap.mjs'), f.target, ...args], { encoding: 'utf8' });
  const before = await snapshot(f.target);
  assert.equal(bootstrap().status, 0);
  assert.deepEqual(await snapshot(f.target), before);
  assert.notEqual(bootstrap('--apply').status, 0);
  assert.deepEqual(await snapshot(f.target), before);
  const initialized = spawnSync('git', ['init', '-q', f.target], { encoding: 'utf8' });
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.equal(spawnSync('git', ['config', 'core.hooksPath', 'custom-hooks'], { cwd: f.target, encoding: 'utf8' }).status, 0);
  assert.notEqual(bootstrap('--apply').status, 0);
  await assert.rejects(f.read('AGENTS.md'));
  assert.equal(spawnSync('git', ['config', '--unset', 'core.hooksPath'], { cwd: f.target, encoding: 'utf8' }).status, 0);
  const installed = bootstrap('--apply');
  assert.equal(installed.status, 0, installed.stderr);
  const receipt = JSON.parse(await f.read('.harness/project-installation.json'));
  assert.deepEqual(receipt.platforms, ['claude', 'codex']);
  assert.equal(spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: f.target, encoding: 'utf8' }).stdout.trim(), '.githooks');
  if (process.platform !== 'win32') for (const hook of ['pre-commit', 'commit-msg']) {
    assert.notEqual((await fs.stat(path.join(f.target, '.githooks', hook))).mode & 0o111, 0);
  }
  if (process.platform !== 'win32') {
    await fs.chmod(path.join(f.target, '.githooks', 'pre-commit'), 0o600);
    assert.notEqual(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  }
  assert.equal(bootstrap('--apply').status, 0);
  assert.equal(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  assert.notEqual(bootstrap('--unknown').status, 0);
  const retired = spawnSync(process.execPath, [path.join(f.source, 'scripts/setup.mjs'), 'plan', '--module', 'project-configuration',
    '--platform', 'codex', '--scope', 'project', '--target', f.target], { encoding: 'utf8' });
  assert.notEqual(retired.status, 0);
}));

test('abrupt project interruption preserves recovery staging and blocks the next operation', async () => fixture(async (f) => {
  const script = `import { planProjectInstallation, applyProjectInstallation } from ${JSON.stringify(pathToFileURL(path.join(root, 'scripts/project-installation.mjs')).href)};
    await applyProjectInstallation(await planProjectInstallation(${JSON.stringify(f.source)}, ${JSON.stringify(f.options())}), { checkpoint: async (phase) => { if (phase === 'file') process.exit(71); } });`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(child.status, 71, child.stderr);
  const entries = await fs.readdir(path.join(f.target, '.harness'));
  const stage = entries.find((entry) => entry.startsWith('.project-stage-'));
  assert.ok(stage);
  await fs.access(path.join(f.target, '.harness', stage, 'transaction.json'));
  await assert.rejects(f.apply(), /locked/);
}));

test('project ignore ownership restores prior content while Codex config remains untouched', async () => fixture(async (f) => {
  const config = '# Project config\n[features]\nhooks = false\nmemories = true\n';
  await f.put('.codex/config.toml', config);
  await f.put('.gitignore', 'user-cache/');
  await f.apply();
  await fs.appendFile(path.join(f.target, '.gitignore'), 'later-cache/\n');
  await fs.appendFile(path.join(f.target, '.codex/config.toml'), '# Later comment\n');
  await f.apply('codex', 'remove');
  assert.equal(await f.read('.codex/config.toml'), config + '# Later comment\n');
  assert.equal(await f.read('.gitignore'), 'user-cache/\nlater-cache/\n');
}));

test('project adapter removal permits a fresh reinstall and the gate propagates project failures', async () => fixture(async (f) => {
  await f.put('.harness/skills/sample/SKILL.md', skill());
  await f.apply();
  await f.apply('codex', 'remove');
  await f.apply();
  assert.equal(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  await f.put('scripts/verify.mjs', 'process.exit(17);\n');
  assert.equal(run(f.target, 'scripts/verify-harness.mjs').status, 17);
}));

test('project publication rejects skill-source drift and retains ambiguous competing edits', async () => {
  await fixture(async (f) => {
    await f.put('.harness/skills/sample/SKILL.md', skill());
    await assert.rejects(f.apply('codex', 'apply', {}, { checkpoint: async (phase) => {
      if (phase === 'staged') await f.put('.harness/skills/sample/SKILL.md', skill() + 'Concurrent source edit\n');
    } }), /rolled back/);
    assert.match(await f.read('.harness/skills/sample/SKILL.md'), /Concurrent source edit/);
    await assert.rejects(f.read('.harness/project-installation.json'));
  });
  await fixture(async (f) => {
    await assert.rejects(f.apply('codex', 'apply', {}, { checkpoint: async (phase, id) => {
      if (phase === 'file' && id === 'AGENTS.md') await f.put('AGENTS.md', 'Concurrent guidance');
    } }), /recovery required/);
    assert.equal(await f.read('AGENTS.md'), 'Concurrent guidance');
    await fs.access(path.join(f.target, '.ai-harness-install.lock'));
    assert.ok((await fs.readdir(path.join(f.target, '.harness'))).some((file) => file.startsWith('.project-stage-')));
  });
});

test('generated .NET CI requires a pinned SDK and installs its runtime', async () => fixture(async (f) => {
  await fs.unlink(path.join(f.target, 'scripts/verify.mjs'));
  await f.put('app.csproj', '<Project />');
  assert.equal((await f.plan('codex', 'apply', { ci: 'github' })).applicable, false);
  await f.put('global.json', JSON.stringify({ sdk: { version: 'latest' } }));
  assert.equal((await f.plan('codex', 'apply', { ci: 'github' })).applicable, false);
  await f.put('global.json', JSON.stringify({ sdk: { version: '10.0.100' } }));
  await f.apply('codex', 'apply', { ci: 'github' });
  assert.match(await f.read('.github/workflows/harness-project.yml'), /actions\/setup-dotnet@/);
  assert.match(await f.read('scripts/verify.mjs'), /"dotnet"/);
}));

test('selected project runtime excludes machine guard policy', async () => fixture(async (f) => {
  await f.apply();
  for (const file of ['.harness/hooks/guard-git.mjs', '.harness/hooks/guard-policy.mjs', '.harness/project-runtime/global-settings.mjs', '.harness/project-runtime/project-settings.mjs']) {
    await assert.rejects(f.read(file), { code: 'ENOENT' });
  }
  assert.equal(run(f.target, 'scripts/verify-harness.mjs').status, 0);
}));


test('replayed project receipt cannot remove runtime used by a later platform', async () => fixture(async (f) => {
  await f.apply('codex');
  const historical = await f.read('.harness/project-installation.json');
  await f.apply('claude');
  await f.put('.harness/project-installation.json', historical);
  const before = await snapshot(f.target);
  for (const operation of ['audit', 'apply', 'remove']) await assert.rejects(f.plan('codex', operation), /Current ownership/);
  assert.notEqual(run(f.target, 'scripts/verify-harness.mjs').status, 0);
  assert.deepEqual(await snapshot(f.target), before);
}));
