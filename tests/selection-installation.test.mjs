import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { planInstallation, applyInstallation } from '../scripts/selection-installation.mjs';
import { renderSkill, parseSkill } from '../scripts/skill-lib.mjs';
import { snapshot } from './helpers/filesystem-snapshot.mjs';

const root = path.resolve(import.meta.dirname, '..');
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
async function fixture(body) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'selected skills '));
  const repository = path.join(temporary, 'source');
  const target = path.join(temporary, 'home');
  try {
    await fs.mkdir(repository);
    for (const directory of ['scripts', 'catalog', 'skills', 'global', 'project', 'components']) {
      await fs.cp(path.join(root, directory), path.join(repository, directory), { recursive: true });
    }
    await fs.mkdir(target);
    const options = (ids = ['research'], extra = {}) => ({ ids, platform: 'codex', scope: 'machine', target, ...extra });
    const plan = (ids, extra) => planInstallation(repository, options(ids, extra));
    const apply = async (ids, extra, hooks) => applyInstallation(await plan(ids, extra), hooks);
    const discovery = (id, platform = 'codex') => path.join(target, platform === 'codex' ? '.agents' : '.claude', 'skills', id);
    const receiptFile = (platform = 'codex') => path.join(target, '.ai-harness/installations', platform, 'receipt.json');
    const receipt = async (platform) => JSON.parse(await fs.readFile(receiptFile(platform), 'utf8'));
    await body({ temporary, repository, target, options, plan, apply, discovery, receiptFile, receipt });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

test('selective lifecycle on each platform preserves unrelated state, repeats without writes and survives regeneration', async () => {
  for (const platform of ['codex', 'claude']) await fixture(async (f) => {
    await fs.mkdir(f.discovery('unrelated', platform), { recursive: true });
    const sentinel = path.join(f.discovery('unrelated', platform), 'SKILL.md');
    await fs.writeFile(sentinel, 'User owned');
    await fs.writeFile(path.join(f.target, 'settings.json'), 'User settings');
    const before = await snapshot(f.target);
    const preview = await f.plan(['research'], { platform });
    assert.equal(preview.applicable, true);
    assert.deepEqual(await snapshot(f.target), before);
    await applyInstallation(preview);
    const first = await snapshot(f.target);
    assert.equal((await f.apply(['research'], { platform })).noOp, true);
    assert.deepEqual(await snapshot(f.target), first);
    const installed = await fs.realpath(f.discovery('research', platform));
    assert.ok(installed.startsWith(await fs.realpath(f.target)));
    assert.ok(!installed.includes(f.repository));
    const source = path.join(f.repository, 'skills/engineering/research');
    const parsed = parseSkill(await fs.readFile(path.join(source, 'SKILL.md'), 'utf8'), source);
    const rendered = path.join(f.temporary, 'expected');
    await renderSkill({ ...parsed, directory: source }, rendered, platform, false);
    assert.equal(await fs.readFile(path.join(installed, 'SKILL.md'), 'utf8'), await fs.readFile(path.join(rendered, 'SKILL.md'), 'utf8'));
    if (platform === 'codex') assert.equal(await fs.readFile(path.join(installed, 'agents/openai.yaml'), 'utf8'), await fs.readFile(path.join(rendered, 'agents/openai.yaml'), 'utf8'));
    await f.apply(['tdd'], { platform });
    const other = await fs.readFile(path.join(f.discovery('tdd', platform), 'SKILL.md'), 'utf8');
    const generated = spawnSync(process.execPath, [path.join(f.repository, 'scripts/generate-skills.mjs')], { encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr);
    await fs.rm(path.join(f.repository, '.generated'), { recursive: true });
    await f.apply(['research'], { platform, operation: 'remove' });
    await assert.rejects(fs.lstat(f.discovery('research', platform)), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(f.discovery('tdd', platform), 'SKILL.md'), 'utf8'), other);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'User owned');
    assert.equal(await fs.readFile(path.join(f.target, 'settings.json'), 'utf8'), 'User settings');
    assert.equal((await f.plan([], { platform, operation: 'audit' })).applicable, true);
    assert.equal((await f.apply(['research'], { platform, operation: 'remove' })).noOp, true);
  });
});

test('update publishes a new revision and preserves the other platform and selection', async () => fixture(async (f) => {
  await f.apply(['research', 'tdd']);
  await f.apply(['research'], { platform: 'claude' });
  const original = await fs.realpath(f.discovery('research'));
  const tdd = await fs.realpath(f.discovery('tdd'));
  const claude = await fs.realpath(f.discovery('research', 'claude'));
  const source = path.join(f.repository, 'skills/engineering/research/SKILL.md');
  await fs.appendFile(source, '\nAdditional fixture guidance.\n');
  const preview = await f.plan(['research']);
  assert.deepEqual(preview.changes.map((entry) => entry.action), ['update']);
  await applyInstallation(preview);
  assert.notEqual(await fs.realpath(f.discovery('research')), original);
  assert.equal(await fs.realpath(f.discovery('tdd')), tdd);
  assert.equal(await fs.realpath(f.discovery('research', 'claude')), claude);
  assert.match(await fs.readFile(path.join(f.discovery('research'), 'SKILL.md'), 'utf8'), /Additional fixture guidance/);
  assert.equal((await f.plan([], { operation: 'audit' })).applicable, true);
}));

test('shared dependencies remain until the final consumer is removed', async () => fixture(async (f) => {
  const file = path.join(f.repository, 'catalog/modules.json');
  const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
  catalog.capabilities.find((entry) => entry.id === 'research').requires = ['security-checklist'];
  catalog.capabilities.find((entry) => entry.id === 'grilling').requires = ['security-checklist'];
  await fs.writeFile(file, JSON.stringify(catalog));
  await f.apply(['research']);
  await f.apply(['grilling']);
  assert.deepEqual((await f.receipt()).entries.find((entry) => entry.id === 'security-checklist').consumers, ['grilling', 'research']);
  await f.apply(['research'], { operation: 'remove' });
  assert.match(await fs.readFile(path.join(f.discovery('security-checklist'), 'SKILL.md'), 'utf8'), /Security checklist/);
  await f.apply(['grilling'], { operation: 'remove' });
  await assert.rejects(fs.lstat(f.discovery('security-checklist')), { code: 'ENOENT' });
  assert.deepEqual((await f.receipt()).entries, []);
}));

test('unowned copies, legacy links, case collisions and edited owned files are preserved', async () => {
  for (const kind of ['directory', 'legacy-link', 'case', 'edited', 'extra-file', 'missing-link', 'changed-link']) await fixture(async (f) => {
    if (['edited', 'extra-file', 'missing-link', 'changed-link'].includes(kind)) {
      await f.apply();
      if (kind === 'edited') await fs.appendFile(path.join(f.discovery('research'), 'SKILL.md'), '\nUser edit');
      if (kind === 'extra-file') await fs.writeFile(path.join(f.discovery('research'), 'notes.md'), 'User notes');
      if (['missing-link', 'changed-link'].includes(kind)) await fs.unlink(f.discovery('research'));
      if (kind === 'changed-link') await fs.symlink(f.repository, f.discovery('research'), linkType);
    } else {
      await fs.mkdir(path.dirname(f.discovery('research')), { recursive: true });
      if (kind === 'legacy-link') await fs.symlink(path.join(f.repository, 'skills/engineering/research'), f.discovery('research'), linkType);
      else await fs.mkdir(f.discovery(kind === 'case' ? 'Research' : 'research'));
    }
    const before = await snapshot(f.target);
    const plan = await f.plan();
    assert.equal(plan.applicable, false, kind);
    await assert.rejects(applyInstallation(plan));
    if (['edited', 'extra-file', 'missing-link', 'changed-link'].includes(kind)) {
      assert.equal((await f.plan([], { operation: 'audit' })).applicable, false);
      assert.equal((await f.plan(['research'], { operation: 'remove' })).applicable, false);
    }
    assert.deepEqual(await snapshot(f.target), before);
  });
});

test('malformed, forged and linked receipts cannot claim unrelated content or escape the target', async () => {
  for (const kind of ['json', 'traversal', 'target', 'hash', 'consumers', 'extra-field', 'linked', 'hardlinked', 'forged-copy']) await fixture(async (f) => {
    await f.apply();
    const outside = path.join(f.temporary, 'sentinel');
    await fs.writeFile(outside, 'Preserve outside');
    const receipt = await f.receipt();
    if (kind === 'traversal') receipt.entries[0].id = '../../../sentinel';
    if (kind === 'target') receipt.target = f.temporary;
    if (kind === 'hash') receipt.entries[0].hash = '../../sentinel';
    if (kind === 'consumers') receipt.entries[0].consumers = [];
    if (kind === 'extra-field') receipt.entries[0].path = outside;
    if (kind === 'forged-copy') {
      await fs.unlink(f.discovery('research'));
      await fs.mkdir(f.discovery('research'));
      await fs.writeFile(path.join(f.discovery('research'), 'SKILL.md'), 'Unowned copy');
    }
    await fs.writeFile(f.receiptFile(), kind === 'json' ? '{broken' : JSON.stringify(receipt));
    if (kind === 'linked' || kind === 'hardlinked') {
      await fs.unlink(f.receiptFile());
      if (kind === 'linked') await fs.symlink(outside, f.receiptFile());
      else await fs.link(outside, f.receiptFile());
    }
    const before = await snapshot(f.target);
    if (kind === 'forged-copy') await assert.rejects(f.apply(['research'], { operation: 'remove' }));
    else await assert.rejects(f.plan(['research'], { operation: 'remove' }));
    assert.deepEqual(await snapshot(f.target), before);
    assert.equal(await fs.readFile(outside, 'utf8'), 'Preserve outside');
  });
});

test('linked target, discovery, payload roots and resources fail without writes', async () => {
  for (const kind of ['target', 'discovery', 'store', 'payload', 'resource']) await fixture(async (f) => {
    const outside = path.join(f.temporary, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'sentinel'), 'Unrelated');
    if (kind === 'target') {
      await fs.rmdir(f.target);
      await fs.symlink(outside, f.target, linkType);
    } else if (kind === 'resource' || kind === 'payload') {
      await f.apply();
      const payload = await fs.realpath(f.discovery('research'));
      if (kind === 'resource') {
        await fs.unlink(path.join(payload, 'SKILL.md'));
        await fs.symlink(path.join(outside, 'sentinel'), path.join(payload, 'SKILL.md'));
      } else {
        await fs.rename(payload, path.join(f.temporary, 'old-payload'));
        await fs.symlink(outside, payload, linkType);
      }
    } else {
      const link = path.join(f.target, kind === 'store' ? '.ai-harness' : '.agents');
      await fs.symlink(outside, link, linkType);
    }
    const before = await snapshot(f.temporary);
    await assert.rejects(f.apply(['research'], { operation: kind === 'resource' || kind === 'payload' ? 'remove' : 'apply' }));
    assert.deepEqual(await snapshot(f.temporary), before);
  });
});

test('plans reject stale state, serialized authority and honor immutable application data', async () => fixture(async (f) => {
  const plan = await f.plan();
  await assert.rejects(applyInstallation(JSON.parse(JSON.stringify(plan))), /in-process/);
  plan.target = f.repository;
  plan.changes[0].discovery = path.join(f.repository, 'sentinel');
  plan.selected.push('implement');
  plan.entries[0].hash = 'forged';
  plan.entries[0].consumers.push('implement');
  await applyInstallation(plan);
  assert.deepEqual((await f.receipt()).selected, ['research']);
  assert.equal((await f.plan([], { operation: 'audit' })).applicable, true);
  await assert.rejects(fs.lstat(path.join(f.repository, 'sentinel')), { code: 'ENOENT' });
  const next = await f.plan(['tdd']);
  await fs.mkdir(f.discovery('tdd'));
  await assert.rejects(applyInstallation(next), /conflicts|preconditions changed/);
  const sourcePlan = await f.plan(['grilling']);
  await fs.appendFile(path.join(f.repository, 'skills/productivity/grilling/SKILL.md'), '\nChanged');
  await assert.rejects(applyInstallation(sourcePlan), /preconditions changed/);
}));

test('publication failures restore previous discoveries and receipt; the target lock serializes both platforms', async () => {
  for (const point of ['locked', 'staged', 'discovery', 'receipt']) await fixture(async (f) => {
    await f.apply(['research']);
    const previousReceipt = await fs.readFile(f.receiptFile(), 'utf8');
    const previousLink = await fs.realpath(f.discovery('research'));
    await fs.appendFile(path.join(f.repository, 'skills/engineering/research/SKILL.md'), '\nFixture update');
    await assert.rejects(f.apply(['research', 'tdd'], {}, { checkpoint: async (name) => {
      if (name !== point) return;
      const competing = await f.plan(['research'], { platform: 'claude' });
      assert.equal(competing.applicable, false);
      await assert.rejects(applyInstallation(competing), /locked/);
      throw new Error('Injected publication failure');
    } }), /Injected publication failure.*rolled back/);
    assert.equal(await fs.readFile(f.receiptFile(), 'utf8'), previousReceipt);
    assert.equal(await fs.realpath(f.discovery('research')), previousLink);
    await assert.rejects(fs.lstat(f.discovery('tdd')), { code: 'ENOENT' });
    assert.equal((await f.plan([], { operation: 'audit' })).applicable, true);
    await f.apply(['research', 'tdd']);
  });
});

test('edits arriving after staging are preserved', async () => fixture(async (f) => {
  await f.apply();
  const prior = await fs.readFile(f.receiptFile(), 'utf8');
  await assert.rejects(f.apply(['tdd'], {}, { checkpoint: async (point) => {
    if (point === 'staged') await fs.appendFile(path.join(f.discovery('research'), 'SKILL.md'), '\nConcurrent user edit');
  } }), /changed before publication/);
  assert.equal(await fs.readFile(f.receiptFile(), 'utf8'), prior);
  await assert.rejects(fs.lstat(f.discovery('tdd')), { code: 'ENOENT' });
}));

test('CLI defaults to a read-only preview, uses explicit scope/target and needs no external tools', async () => fixture(async (f) => {
  const emptyPath = path.join(f.temporary, 'no-tools');
  await fs.mkdir(emptyPath);
  const run = (...args) => spawnSync(process.execPath, [path.join(f.repository, 'scripts/setup.mjs'), ...args], {
    cwd: f.temporary, encoding: 'utf8', env: { ...process.env, HOME: f.target, USERPROFILE: f.target, PATH: emptyPath },
  });
  const common = ['--platform', 'codex', '--scope', 'machine', '--target', f.target, '--json'];
  const before = await snapshot(f.target);
  for (const operation of ['plan', 'apply', 'remove']) {
    const result = run(operation, '--select', 'research', ...common);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await snapshot(f.target), before);
  }
  for (const args of [['apply', '--select', 'implement', ...common], ['apply', '--select', 'research', '--apply'],
    ['apply', '--module', 'skills', ...common], ['apply', '--select', 'research', ...common, '--scope', 'project'],
    ['audit', '--select', 'research', ...common], ['audit', ...common, '--apply']]) {
    assert.notEqual(run(...args).status, 0);
  }
  assert.deepEqual(await snapshot(f.target), before);
  const applied = run('apply', '--select', 'research', ...common, '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).applied, true);
  assert.equal(run('audit', ...common).status, 0);
  assert.equal(run('remove', '--select', 'research', ...common, '--apply').status, 0);
}));

test('fresh missing targets, user-only metadata, resources and resource-only updates work without source runtime links', async () => fixture(async (f) => {
  await fs.rmdir(f.target);
  const preview = await f.plan(['handoff', 'tdd']);
  await assert.rejects(fs.lstat(f.target), { code: 'ENOENT' });
  await applyInstallation(preview);
  assert.match(await fs.readFile(path.join(f.discovery('handoff'), 'agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);
  const installed = await fs.realpath(f.discovery('tdd'));
  const resource = path.join(f.repository, 'skills/engineering/tdd/mocking.md');
  assert.equal(await fs.readFile(path.join(installed, 'mocking.md'), 'utf8'), await fs.readFile(resource, 'utf8'));
  await fs.appendFile(resource, '\nFixture resource revision\n');
  await f.apply(['tdd']);
  assert.notEqual(await fs.realpath(f.discovery('tdd')), installed);
  await fs.rename(f.repository, path.join(f.temporary, 'moved-source'));
  assert.match(await fs.readFile(path.join(f.discovery('tdd'), 'mocking.md'), 'utf8'), /Fixture resource revision/);
}));

test('ambiguous rollback preserves a competing replacement and retains a recovery journal and lock', async () => fixture(async (f) => {
  await f.apply();
  await fs.appendFile(path.join(f.repository, 'skills/engineering/research/SKILL.md'), '\nFixture update');
  await assert.rejects(f.apply(['research'], {}, { checkpoint: async (point) => {
    if (point !== 'discovery') return;
    await fs.unlink(f.discovery('research'));
    await fs.mkdir(f.discovery('research'));
    await fs.writeFile(path.join(f.discovery('research'), 'notes.md'), 'Concurrent user content');
    throw new Error('Injected failure');
  } }), /recovery required.*retained staging and lock/);
  assert.equal(await fs.readFile(path.join(f.discovery('research'), 'notes.md'), 'utf8'), 'Concurrent user content');
  const store = path.dirname(f.receiptFile());
  const stages = (await fs.readdir(store)).filter((name) => name.startsWith('.stage-'));
  assert.equal(stages.length, 1);
  assert.equal(JSON.parse(await fs.readFile(path.join(store, stages[0], 'transaction.json'), 'utf8')).version, 1);
  assert.equal((await f.plan([], { operation: 'audit' })).applicable, false);
  await assert.rejects(f.apply(['tdd']), /locked/);
}));

test('abrupt interruption leaves a visible lock and journal instead of treating a partial install as healthy', async () => fixture(async (f) => {
  const script = `import {planInstallation,applyInstallation} from ${JSON.stringify(new URL('../scripts/selection-installation.mjs', import.meta.url).href)};
    const plan = await planInstallation(${JSON.stringify(f.repository)}, ${JSON.stringify(f.options())});
    await applyInstallation(plan, {checkpoint: async (point) => {if(point === 'discovery') process.exit(73);}});`;
  const interrupted = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(interrupted.status, 73, interrupted.stderr);
  const audit = await f.plan([], { operation: 'audit' });
  assert.equal(audit.applicable, false);
  assert.match(audit.conflicts.join(' '), /locked/);
  const store = path.dirname(f.receiptFile());
  const stages = (await fs.readdir(store)).filter((name) => name.startsWith('.stage-'));
  assert.equal(stages.length, 1);
  const journal = JSON.parse(await fs.readFile(path.join(store, stages[0], 'transaction.json'), 'utf8'));
  assert.equal(journal.previousReceipt, null);
  assert.deepEqual(journal.nextReceipt.selected, ['research']);
  await assert.rejects(f.apply(), /locked|collision/);
}));

test('a home containing the source checkout is supported but source-overlapping installation paths are denied', async () => fixture(async (f) => {
  await assert.rejects(f.plan(['research'], { target: f.repository }), /outside the source checkout/);
  await f.apply(['research'], { target: f.temporary });
  assert.match(await fs.readFile(path.join(f.temporary, '.agents/skills/research/SKILL.md'), 'utf8'), /name: research/);
  assert.equal((await f.plan([], { operation: 'audit', target: f.temporary })).applicable, true);
  const insideDiscovery = path.join(f.target, '.agents/skills/source');
  await fs.mkdir(path.dirname(insideDiscovery), { recursive: true });
  await fs.rename(f.repository, insideDiscovery);
  await assert.rejects(planInstallation(insideDiscovery, f.options()), /overlap/);
}));

test('initial installation and removal failures restore discovery and receipt ownership', async () => fixture(async (f) => {
  const hooks = { checkpoint: async (point) => { if (point === 'receipt') throw new Error('Receipt failure'); } };
  await assert.rejects(f.apply(['research'], {}, hooks), /rolled back/);
  await assert.rejects(fs.lstat(f.discovery('research')), { code: 'ENOENT' });
  await assert.rejects(fs.lstat(f.receiptFile()), { code: 'ENOENT' });
  await f.apply(['research', 'tdd']);
  const previous = await fs.readFile(f.receiptFile(), 'utf8');
  const discovery = await fs.realpath(f.discovery('research'));
  await assert.rejects(f.apply(['research'], { operation: 'remove' }, hooks), /rolled back/);
  assert.equal(await fs.realpath(f.discovery('research')), discovery);
  assert.equal(await fs.readFile(f.receiptFile(), 'utf8'), previous);
  assert.equal((await f.plan([], { operation: 'audit' })).applicable, true);
}));

test('a discovery replaced at the rename boundary is restored instead of deleted with staging', async () => fixture(async (f) => {
  await f.apply();
  const previous = await fs.readFile(f.receiptFile(), 'utf8');
  const rename = fs.rename;
  let injected = false;
  fs.rename = async (from, to) => {
    if (!injected && path.resolve(from) === path.resolve(await fs.realpath(path.dirname(f.discovery('research'))), 'research')) {
      injected = true;
      await fs.unlink(from);
      await fs.mkdir(from);
      await fs.writeFile(path.join(from, 'notes.md'), 'Racing user content');
    }
    return rename(from, to);
  };
  try {
    await assert.rejects(f.apply(['research'], { operation: 'remove' }), /replaced while moving/);
  } finally { fs.rename = rename; }
  assert.equal(injected, true);
  assert.equal(await fs.readFile(path.join(f.discovery('research'), 'notes.md'), 'utf8'), 'Racing user content');
  assert.equal(await fs.readFile(f.receiptFile(), 'utf8'), previous);
}));
