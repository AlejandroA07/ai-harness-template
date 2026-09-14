import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { planGlobalInstallation, applyGlobalInstallation } from '../scripts/global-installation.mjs';
import { planInstallation, applyInstallation } from '../scripts/selection-installation.mjs';
import { inspectFeatures, editFeatures } from '../scripts/global-settings.mjs';
import { snapshot } from './helpers/filesystem-snapshot.mjs';

const root = path.resolve(import.meta.dirname, '..');
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
async function fixture(body, suffix = 'home') {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'global setup '));
  const repository = path.join(temporary, 'source');
  const target = path.join(temporary, suffix);
  try {
    await fs.mkdir(repository);
    for (const directory of ['scripts', 'catalog', 'skills', 'global', 'project', 'components']) {
      await fs.cp(path.join(root, directory), path.join(repository, directory), { recursive: true });
    }
    await fs.mkdir(target);
    const file = (platform, kind) => kind === 'receipt' ? path.join(target, '.ai-harness/installations', platform, 'global.json')
      : path.join(target, platform === 'codex' ? '.codex' : '.claude', kind === 'guidance' ? (platform === 'codex' ? 'AGENTS.md' : 'CLAUDE.md')
        : kind === 'config' ? 'config.toml' : platform === 'codex' ? 'hooks.json' : 'settings.json');
    const options = (platform = 'codex', operation = 'apply') => ({ target, platform, scope: 'machine', operation });
    const plan = (platform, operation) => planGlobalInstallation(repository, options(platform, operation));
    const apply = async (platform, operation, hooks) => applyGlobalInstallation(await plan(platform, operation), hooks);
    const json = async (platform, kind) => JSON.parse(await fs.readFile(file(platform, kind), 'utf8'));
    const put = async (platform, kind, value) => {
      await fs.mkdir(path.dirname(file(platform, kind)), { recursive: true });
      await fs.writeFile(file(platform, kind), typeof value === 'string' ? value : JSON.stringify(value));
    };
    await body({ temporary, repository, target, file, options, plan, apply, json, put });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

test('global lifecycle installs one platform, stays read-only by default, repeats without writes and removes owned files', async () => {
  for (const platform of ['codex', 'claude']) await fixture(async (f) => {
    const other = platform === 'codex' ? 'claude' : 'codex';
    await f.put(other, 'settings', { unrelated: 'Keep this platform' });
    const otherBefore = await snapshot(path.dirname(f.file(other, 'settings')));
    const before = await snapshot(f.target);
    const preview = await f.plan(platform);
    assert.equal(preview.applicable, true);
    assert.deepEqual(await snapshot(f.target), before);
    const applied = await applyGlobalInstallation(preview);
    assert.equal(applied.installed, true);
    assert.ok(!applied.runtime.startsWith(f.repository));
    const first = await snapshot(f.target);
    assert.equal((await f.apply(platform)).noOp, true);
    assert.deepEqual(await snapshot(f.target), first);
    const auditBefore = await snapshot(f.target);
    assert.equal((await f.plan(platform, 'audit')).applicable, true);
    assert.deepEqual(await snapshot(f.target), auditBefore);
    await assert.rejects(fs.lstat(path.join(f.target, '.agents')), { code: 'ENOENT' });
    await f.apply(platform, 'remove');
    for (const kind of ['guidance', 'settings', 'receipt', ...(platform === 'codex' ? ['config'] : [])]) {
      await assert.rejects(fs.lstat(f.file(platform, kind)), { code: 'ENOENT' });
    }
    assert.equal((await f.apply(platform, 'remove')).noOp, true);
    assert.deepEqual(await snapshot(path.dirname(f.file(other, 'settings'))), otherBefore);
    await fs.access(applied.runtime);
  });
});

test('global settings preserve unrelated entries and restore prior values and empty containers', async () => fixture(async (f) => {
  const unrelated = { matcher: 'Bash|PowerShell|Read', hooks: [{ type: 'command', command: 'node /company/guard-git.mjs', timeout: 10 }] };
  const original = { autoMemoryEnabled: true, includeCoAuthoredBy: true, permissions: { deny: [], allow: ['Read(safe)'], disableBypassPermissionsMode: 'enable' },
    hooks: { PreToolUse: [unrelated], Stop: [] }, model: 'fixture-model', env: { FIXTURE_SETTING: 'Do not record in receipt' } };
  await f.put('claude', 'settings', original);
  await f.apply('claude');
  const installed = await f.json('claude', 'settings');
  assert.equal(installed.autoMemoryEnabled, false);
  assert.equal(installed.permissions.disableBypassPermissionsMode, 'disable');
  assert.deepEqual(installed.hooks.PreToolUse[0], unrelated);
  assert.ok(installed.permissions.deny.length > 0);
  assert.ok(!JSON.stringify(await f.json('claude', 'receipt')).includes('Do not record in receipt'));
  installed.additional = 'Added after installation';
  installed.hooks.PreToolUse.at(-1).hooks.push({ type: 'command', command: 'user-added-hook' });
  await f.put('claude', 'settings', installed);
  assert.equal((await f.apply('claude')).noOp, true);
  await f.apply('claude', 'remove');
  const removed = await f.json('claude', 'settings');
  assert.equal(removed.autoMemoryEnabled, true);
  assert.equal(removed.includeCoAuthoredBy, true);
  assert.deepEqual(removed.permissions, original.permissions);
  assert.deepEqual(removed.hooks.PreToolUse, [unrelated, { matcher: 'Bash|PowerShell|Read', hooks: [{ type: 'command', command: 'user-added-hook' }] }]);
  assert.equal(removed.additional, 'Added after installation');
}));

test('Codex restores only feature values and preserves unrelated TOML bytes', async () => fixture(async (f) => {
  const config = '# fixture config\nmodel = "fixture"\n[features]\nmemories = true # user preference\nhooks = false\nother = true\n[projects."/work"]\ntrust_level = "trusted"\n';
  await f.put('codex', 'config', config);
  await f.apply();
  assert.deepEqual(inspectFeatures(await fs.readFile(f.file('codex', 'config'), 'utf8')).values, { hooks: true, memories: false });
  await fs.appendFile(f.file('codex', 'config'), '# user addition\n');
  await f.apply('codex', 'remove');
  assert.equal(await fs.readFile(f.file('codex', 'config'), 'utf8'), config + '# user addition\n');
}));

test('runtime upgrades replace the exact hook while retaining other platforms and shared policy', async () => fixture(async (f) => {
  const first = await f.apply('codex');
  const second = await f.apply('claude');
  assert.equal(first.runtime, second.runtime);
  const claudeBefore = await snapshot(path.dirname(f.file('claude', 'settings')));
  await fs.appendFile(path.join(f.repository, 'components/guard-policy.mjs'), '\n// Fixture runtime revision.\n');
  const update = await f.apply('codex');
  assert.notEqual(update.runtime, first.runtime);
  const groups = (await f.json('codex', 'settings')).hooks.PreToolUse;
  assert.equal(groups.length, 1);
  assert.ok(groups[0].hooks[0].command.includes(update.runtime));
  assert.deepEqual(await snapshot(path.dirname(f.file('claude', 'settings'))), claudeBefore);
  await f.apply('codex', 'remove');
  await fs.access(path.join(first.runtime, 'components/guard-git.mjs'));
  assert.equal((await f.plan('claude', 'audit')).applicable, true);
}));

test('installed guard runs independently of the checkout and retains denied paths', async () => fixture(async (f) => {
  const applied = await f.apply('claude');
  const handler = (await f.json('claude', 'settings')).hooks.PreToolUse[0].hooks[0];
  await fs.rename(f.repository, path.join(f.temporary, 'moved-source'));
  assert.equal(handler.args[0], path.join(applied.runtime, 'components/guard-git.mjs'));
  for (const request of [
    { tool_name: 'Bash', tool_input: { command: 'git reset --hard' } },
    { tool_name: 'Read', tool_input: { file_path: '/fixture/.env' } },
    { tool_name: 'Bash', tool_input: { command: ['git', 'push', 'origin', 'feature/fixture'].join(' ') } },
  ]) {
    const result = spawnSync(handler.command, handler.args, { cwd: f.target, input: JSON.stringify(request), encoding: 'utf8', shell: false });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout, 'Expected a denied fixture request');
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
  }
  const allowed = spawnSync(handler.command, handler.args, { cwd: f.target, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' } }), encoding: 'utf8', shell: false });
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(allowed.stdout, '');
}));

test('unsafe settings, legacy content, edited ownership and malformed receipts fail before writes', async () => {
  for (const kind of ['legacy-guidance', 'legacy-hook', 'bad-json', 'bad-schema', 'edited-guidance', 'edited-hook', 'edited-feature', 'edited-runtime', 'receipt-path', 'receipt-target', 'receipt-prior']) await fixture(async (f) => {
    if (kind.startsWith('edited') || kind.startsWith('receipt')) await f.apply();
    if (kind === 'legacy-guidance') await f.put('codex', 'guidance', 'My existing instructions');
    if (kind === 'legacy-hook') await f.put('codex', 'settings', { hooks: { PreToolUse: [{ matcher: 'Bash|Read', hooks: [{ type: 'command', command: `node "${f.repository}/components/guard-git.mjs"` }] }] } });
    if (kind === 'bad-json') await f.put('codex', 'settings', '{invalid');
    if (kind === 'bad-schema') await f.put('codex', 'settings', { hooks: [] });
    if (kind === 'edited-guidance') await fs.appendFile(f.file('codex', 'guidance'), '\nUser edit');
    if (kind === 'edited-hook') {
      const settings = await f.json('codex', 'settings');
      settings.hooks.PreToolUse[0].hooks[0].command = 'User replacement';
      await f.put('codex', 'settings', settings);
    }
    if (kind === 'edited-feature') await f.put('codex', 'config', '[features]\nhooks = true\nmemories = true\n');
    if (kind === 'edited-runtime') {
      const receipt = await f.json('codex', 'receipt');
      await fs.appendFile(path.join(f.target, '.ai-harness/runtime', receipt.runtime, 'components/guard-policy.mjs'), '\nUser edit');
    }
    if (kind.startsWith('receipt')) {
      const receipt = await f.json('codex', 'receipt');
      if (kind === 'receipt-path') receipt.runtime = '../../outside';
      if (kind === 'receipt-target') receipt.target = f.temporary;
      if (kind === 'receipt-prior') receipt.features.memories = 'Unexpected';
      await f.put('codex', 'receipt', receipt);
    }
    const before = await snapshot(f.target);
    await assert.rejects(f.apply(), undefined, kind);
    assert.deepEqual(await snapshot(f.target), before);
    if (kind.startsWith('edited') || kind.startsWith('receipt')) {
      await assert.rejects(f.apply('codex', 'remove'));
      assert.deepEqual(await snapshot(f.target), before);
    }
  });
});

test('global lifecycle rejects linked roots/files and hardlinks without touching their targets', async () => {
  for (const kind of ['root', 'platform', 'store', 'guidance', 'settings', 'receipt', 'hardlink']) await fixture(async (f) => {
    const outside = path.join(f.temporary, 'outside');
    await fs.mkdir(outside);
    const sentinel = path.join(outside, 'sentinel');
    await fs.writeFile(sentinel, '{}');
    if (kind === 'root') { await fs.rmdir(f.target); await fs.symlink(outside, f.target, linkType); }
    else if (kind === 'platform' || kind === 'store') await fs.symlink(outside, path.join(f.target, kind === 'platform' ? '.codex' : '.ai-harness'), linkType);
    else {
      const file = f.file('codex', kind === 'hardlink' ? 'settings' : kind);
      await fs.mkdir(path.dirname(file), { recursive: true });
      if (kind === 'hardlink') await fs.link(sentinel, file);
      else await fs.symlink(sentinel, file);
    }
    const before = await snapshot(f.temporary);
    await assert.rejects(f.apply());
    assert.deepEqual(await snapshot(f.temporary), before);
  });
});

test('global publication rollback covers install, update and removal at each checkpoint', async () => {
  for (const operation of ['install', 'update', 'remove']) for (const phase of ['staged', 'file', 'receipt']) await fixture(async (f) => {
    await f.put('codex', 'settings', { unrelated: 'Preserve' });
    if (operation !== 'install') await f.apply();
    if (operation === 'update') await fs.appendFile(path.join(f.repository, 'components/guard-policy.mjs'), '\n// Fixture update\n');
    const files = ['guidance', 'settings', 'config', 'receipt'];
    const before = await Promise.all(files.map(async (kind) => fs.readFile(f.file('codex', kind), 'utf8').catch((error) => { if (error.code === 'ENOENT') return null; throw error; })));
    await assert.rejects(f.apply('codex', operation === 'remove' ? 'remove' : 'apply', { checkpoint: async (point) => {
      if (point === phase) throw new Error('Injected failure');
    } }), /rolled back/);
    const after = await Promise.all(files.map(async (kind) => fs.readFile(f.file('codex', kind), 'utf8').catch((error) => { if (error.code === 'ENOENT') return null; throw error; })));
    assert.deepEqual(after, before, `${operation}/${phase}`);
    await assert.rejects(fs.lstat(path.join(f.target, '.ai-harness-install.lock')), { code: 'ENOENT' });
  });
});

test('M2 and M3 serialize on one lock and preserve each other’s receipts and selections', async () => fixture(async (f) => {
  const skillOptions = { target: f.target, platform: 'codex', scope: 'machine', ids: ['research'] };
  await applyInstallation(await planInstallation(f.repository, skillOptions));
  const before = await fs.readFile(path.join(f.target, '.ai-harness/installations/codex/receipt.json'), 'utf8');
  await f.apply('codex', 'apply', { checkpoint: async (point) => {
    if (point !== 'staged') return;
    assert.equal((await planInstallation(f.repository, skillOptions)).applicable, false);
    assert.equal((await f.plan('claude')).applicable, false);
  } });
  await f.apply('codex', 'remove');
  assert.equal(await fs.readFile(path.join(f.target, '.ai-harness/installations/codex/receipt.json'), 'utf8'), before);
  assert.equal((await planInstallation(f.repository, { ...skillOptions, ids: [], operation: 'audit' })).applicable, true);
}));

test('global CLI selects only its module and needs no platform tools to preview/apply/audit/remove', async () => fixture(async (f) => {
  const emptyPath = path.join(f.temporary, 'empty-path');
  await fs.mkdir(emptyPath);
  const run = (...args) => spawnSync(process.execPath, [path.join(f.repository, 'scripts/setup.mjs'), ...args], {
    cwd: f.target, encoding: 'utf8', env: { ...process.env, HOME: f.target, USERPROFILE: f.target, PATH: emptyPath },
  });
  const common = ['--module', 'global-configuration', '--target', f.target, '--platform', 'codex', '--scope', 'machine', '--json'];
  const before = await snapshot(f.target);
  for (const op of ['plan', 'apply', 'audit', 'remove']) assert.equal(run(op, ...common).status, 0, op);
  assert.deepEqual(await snapshot(f.target), before);
  assert.notEqual(run('apply', ...common, '--select', 'research', '--apply').status, 0);
  assert.notEqual(run('apply', ...common, '--module', 'skills', '--apply').status, 0);
  const applied = run('apply', ...common, '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).module, 'global-configuration');
  assert.equal(run('audit', ...common).status, 0);
  assert.equal(run('remove', ...common, '--apply').status, 0);
  await assert.rejects(fs.lstat(path.join(f.target, '.claude')), { code: 'ENOENT' });
}));

test('feature editor preserves comments/quoted keys/multiline values and rejects ambiguous ownership', () => {
  const sources = [
    '# comment\n[features]\nmemories = true # comment\nhooks = false\n',
    '["features"]\r\n"memories" = true\r\n\'hooks\' = false\r\n',
    'instructions = """\n[features]\nmemories = false\n"""\n[features]\nhooks = false\nmemories = true\n',
    'array = [\n"feature-like text",\n]\n[features]\nhooks = false\nmemories = true',
  ];
  for (const source of sources) {
    const edited = editFeatures(source, { hooks: true, memories: false });
    assert.deepEqual(inspectFeatures(edited).values, { hooks: true, memories: false });
    assert.equal(editFeatures(edited, { hooks: false, memories: true }), source);
  }
  for (const source of ['features = { memories = true }', 'features.memories = true', '[features]\nmemories = "false"', '[features]\nhooks = true\nhooks = false', '[features]\ncodex_hooks = true', '[features.memories]\nenabled = false', '[features]\nmemories = true\n[features]\nhooks = true']) {
    assert.throws(() => inspectFeatures(source), undefined, source);
  }
  assert.equal(editFeatures(editFeatures('', { hooks: true, memories: false }), { hooks: null, memories: null }, true), '');
});

test('TOML assignment parsing rejects long invalid keys without backtracking', () => {
  const script = `import assert from 'node:assert/strict';
    import { inspectFeatures } from ${JSON.stringify(pathToFileURL(path.join(root, 'scripts/global-settings.mjs')).href)};
    for (const key of ['-'.repeat(100_000), 'a '.repeat(50_000), 'a.'.repeat(50_000)]) {
      assert.throws(() => inspectFeatures(key), /TOML/);
    }
    assert.deepEqual(inspectFeatures('-'.repeat(100_000) + ' = true').values, { hooks: null, memories: null });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 3000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('TOML assignment boundaries respect quoted keys and reject comment-only separators', () => {
  const source = '"key=with=equals" = "value"\n\'literal=key\' = true\n"escaped\\\"=key" = false\n[features]\n"hooks" = false # equals = comment\nmemories = true\n';
  const edited = editFeatures(source, { hooks: true, memories: false });
  assert.equal(editFeatures(edited, { hooks: false, memories: true }), source);
  assert.throws(() => inspectFeatures('invalid # comment = true'), /TOML assignment/);
  assert.throws(() => inspectFeatures('invalid key = true'), /TOML key/);
});

test('global plans reject stale inputs and ignore edits to public plan fields', async () => fixture(async (f) => {
  const plan = await f.plan();
  plan.target = f.repository;
  plan.changes.length = 0;
  await applyGlobalInstallation(plan);
  await assert.rejects(fs.access(path.join(f.repository, '.codex')));
  const stale = await f.plan();
  await f.put('codex', 'settings', { ...(await f.json('codex', 'settings')), additional: true });
  const before = await snapshot(f.target);
  await assert.rejects(applyGlobalInstallation(stale), /preconditions changed/);
  assert.deepEqual(await snapshot(f.target), before);
}));

test('global publication rejects runtime and unchanged-file drift while preserving competing edits', async () => {
  for (const kind of ['runtime', 'unchanged-settings', 'parent']) await fixture(async (f) => {
    const installed = await f.apply();
    await fs.appendFile(path.join(f.repository, 'global/AGENTS.md'), '\nFixture guidance revision\n');
    await assert.rejects(f.apply('codex', 'apply', { checkpoint: async (phase) => {
      if (phase !== (kind === 'parent' ? 'locked' : 'staged')) return;
      if (kind === 'runtime') await fs.appendFile(path.join(installed.runtime, 'components/guard-policy.mjs'), '\nFixture drift\n');
      if (kind === 'unchanged-settings') await fs.appendFile(f.file('codex', 'config'), '# Concurrent edit\n');
      if (kind === 'parent') {
        await fs.rename(path.dirname(f.file('codex', 'guidance')), path.join(f.target, 'preserved-platform'));
        await fs.mkdir(path.dirname(f.file('codex', 'guidance')));
        await f.put('codex', 'guidance', 'Concurrent instructions');
      }
    } }), /rolled back|Parent directory changed/);
    if (kind === 'unchanged-settings') assert.match(await fs.readFile(f.file('codex', 'config'), 'utf8'), /Concurrent edit/);
    if (kind === 'parent') assert.equal(await fs.readFile(f.file('codex', 'guidance'), 'utf8'), 'Concurrent instructions');
    await assert.rejects(fs.access(path.join(f.target, '.ai-harness-install.lock')));
  });
});

test('ambiguous global rollback retains original bytes, a scoped journal and the target lock', async () => fixture(async (f) => {
  await f.put('codex', 'settings', { unrelated: 'Fixture private value' });
  await f.apply();
  const original = await fs.readFile(f.file('codex', 'guidance'));
  await fs.appendFile(path.join(f.repository, 'global/AGENTS.md'), '\nFixture update\n');
  await assert.rejects(f.apply('codex', 'apply', { checkpoint: async (phase, id) => {
    if (phase === 'file' && id === 'guidance') {
      await f.put('codex', 'guidance', 'Concurrent guidance');
      throw new Error('Injected interruption');
    }
  } }), /recovery required/);
  assert.equal(await fs.readFile(f.file('codex', 'guidance'), 'utf8'), 'Concurrent guidance');
  const store = path.dirname(f.file('codex', 'receipt'));
  const stage = path.join(store, (await fs.readdir(store)).find((name) => name.startsWith('.global-stage-')));
  assert.deepEqual(await fs.readFile(path.join(stage, '0.old')), original);
  assert.ok(!(await fs.readFile(path.join(stage, 'transaction.json'), 'utf8')).includes('Fixture private value'));
  await fs.access(path.join(f.target, '.ai-harness-install.lock'));
  assert.equal((await f.plan('codex', 'audit')).applicable, false);
}));

test('abrupt global interruption leaves an auditable journal and blocks later operations', async () => fixture(async (f) => {
  const script = `import { planGlobalInstallation, applyGlobalInstallation } from ${JSON.stringify(pathToFileURL(path.join(root, 'scripts/global-installation.mjs')).href)};
    await applyGlobalInstallation(await planGlobalInstallation(${JSON.stringify(f.repository)}, ${JSON.stringify(f.options())}), {
      checkpoint: async (phase) => { if (phase === 'file') process.exit(71); }
    });`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(child.status, 71, child.stderr);
  const store = path.dirname(f.file('codex', 'receipt'));
  const stage = path.join(store, (await fs.readdir(store)).find((name) => name.startsWith('.global-stage-')));
  const journal = JSON.parse(await fs.readFile(path.join(stage, 'transaction.json'), 'utf8'));
  assert.equal(journal.previousReceipt, null);
  assert.equal(journal.nextReceipt.platform, 'codex');
  assert.equal((await f.plan('codex', 'audit')).applicable, false);
  const before = await snapshot(f.target);
  await assert.rejects(f.apply(), /locked/);
  assert.deepEqual(await snapshot(f.target), before);
}));

test('policy revision updates retire only owned denials and keep removal valid', async () => fixture(async (f) => {
  const templatePath = path.join(f.repository, 'global/claude-settings.json');
  const template = JSON.parse(await fs.readFile(templatePath, 'utf8'));
  template.permissions.deny.push('Read(fixture-owned-old)', 'Read(fixture-unowned-old)');
  await fs.writeFile(templatePath, JSON.stringify(template));
  await f.put('claude', 'settings', { permissions: { deny: ['Read(fixture-unowned-old)'] } });
  await f.apply('claude');
  template.permissions.deny = template.permissions.deny.filter((entry) => !entry.includes('fixture-'));
  template.permissions.deny.push('Read(fixture-new)');
  await fs.writeFile(templatePath, JSON.stringify(template));
  await f.apply('claude');
  const deny = (await f.json('claude', 'settings')).permissions.deny;
  assert.ok(!deny.includes('Read(fixture-owned-old)'));
  assert.ok(deny.includes('Read(fixture-unowned-old)'));
  assert.ok(deny.includes('Read(fixture-new)'));
  assert.equal((await f.plan('claude', 'audit')).applicable, true);
  assert.equal((await f.apply('claude')).noOp, true);
  await f.apply('claude', 'remove');
  assert.deepEqual((await f.json('claude', 'settings')).permissions.deny, ['Read(fixture-unowned-old)']);
}));

test('Codex hook executes literal paths containing shell metacharacters', { skip: process.platform === 'win32' }, async () => fixture(async (f) => {
  await f.apply();
  const handler = (await f.json('codex', 'settings')).hooks.PreToolUse[0].hooks[0];
  const result = spawnSync('/bin/sh', ['-c', handler.command], { cwd: f.target,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git reset --hard' } }), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
  await assert.rejects(fs.access(path.join(f.target, 'unexpected')));
}, "home ' $(touch unexpected) `touch unexpected` $literal"));

test('global lifecycle supports an absent target and rejects source-overlapping locations', async () => fixture(async (f) => {
  await fs.rmdir(f.target);
  const planned = await f.plan();
  await assert.rejects(fs.access(f.target));
  await applyGlobalInstallation(planned);
  await f.apply('codex', 'remove');
  await assert.rejects(planGlobalInstallation(f.repository, { ...f.options(), target: path.join(f.repository, 'nested') }), /outside the source/);
}));


test('global ownership rejects semantic edits to every restoration field', async () => {
  for (const field of ['scalars', 'addedDenials', 'hookOwned', 'createdContainers', 'settingsExisted', 'hookArrayExisted', 'denyArrayExisted', 'configExisted', 'createdFeatureTable', 'features']) await fixture(async (f) => {
    const platform = field === 'features' ? 'codex' : 'claude';
    await f.apply(platform);
    const receipt = await f.json(platform, 'receipt');
    if (field === 'scalars') receipt.scalars.autoMemoryEnabled = { present: true, value: true };
    else if (field === 'addedDenials') receipt.addedDenials = [];
    else if (field === 'createdContainers') receipt.createdContainers = [];
    else if (field === 'features') receipt.features.memories = true;
    else receipt[field] = !receipt[field];
    await f.put(platform, 'receipt', receipt);
    const before = await snapshot(f.target);
    await assert.rejects(f.plan(platform, 'audit'));
    await assert.rejects(f.apply(platform, 'remove'));
    assert.deepEqual(await snapshot(f.target), before);
  });
});

test('global disabled hooks block readiness but allow owned removal', async () => fixture(async (f) => {
  await f.put('claude', 'settings', { disableAllHooks: true });
  const plan = await f.plan('claude');
  assert.equal(plan.applicable, false);
  assert.match(plan.conflicts.join(' '), /disabled/i);
  await f.put('claude', 'settings', {});
  await f.apply('claude');
  const settings = await f.json('claude', 'settings');
  settings.disableAllHooks = true;
  await f.put('claude', 'settings', settings);
  assert.equal((await f.plan('claude', 'audit')).applicable, false);
  await fs.rm(path.join(f.repository, 'global'), { recursive: true });
  await f.apply('claude', 'remove');
  assert.equal((await f.json('claude', 'settings')).disableAllHooks, true);
}));


test('replayed global receipt cannot restore a previous installation’s settings', async () => fixture(async (f) => {
  await f.put('claude', 'settings', { autoMemoryEnabled: true });
  await f.apply('claude');
  const historical = await fs.readFile(f.file('claude', 'receipt'));
  await f.apply('claude', 'remove');
  await f.put('claude', 'settings', { autoMemoryEnabled: false });
  await f.apply('claude');
  await fs.writeFile(f.file('claude', 'receipt'), historical);
  const before = await snapshot(f.target);
  for (const operation of ['audit', 'apply', 'remove']) await assert.rejects(f.plan('claude', operation), /Current ownership/);
  assert.deepEqual(await snapshot(f.target), before);
}));
