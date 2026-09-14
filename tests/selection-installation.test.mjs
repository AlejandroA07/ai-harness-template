import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { planInstallation, applyInstallation } from '../scripts/selection-installation.mjs';
import { planProjectInstallation, applyProjectInstallation } from '../scripts/project-installation.mjs';
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
    const receiptFile = (platform = 'codex', scope = 'machine') => path.join(target,
      scope === 'project' ? '.harness' : '.ai-harness', 'installations', platform, 'receipt.json');
    const receipt = async (platform, scope) => JSON.parse(await fs.readFile(receiptFile(platform, scope), 'utf8'));
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

test('project-scoped skills coexist with project configuration on both platforms and never write machine state', async () => {
  for (const platform of ['codex', 'claude']) await fixture(async (f) => {
    const machine = path.join(f.temporary, 'machine');
    await fs.mkdir(machine);
    await fs.mkdir(path.join(f.target, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(f.target, 'scripts/verify.mjs'), "console.log('Project verifier ran');\n");
    await fs.mkdir(path.join(f.target, '.harness/skills/team/local-sample'), { recursive: true });
    await fs.writeFile(path.join(f.target, '.harness/skills/team/local-sample/SKILL.md'),
      '---\nname: local-sample\ndescription: Project-owned sample\n---\n\nKeep this local skill.\n');
    const projectConfiguration = { operation: 'apply', platform, scope: 'project', target: f.target };
    await applyProjectInstallation(await planProjectInstallation(f.repository, projectConfiguration));
    const machineBefore = await snapshot(machine);
    const localBefore = await fs.readFile(path.join(f.discovery('local-sample', platform), 'SKILL.md'), 'utf8');

    const preview = await f.plan(['research'], { platform, scope: 'project' });
    assert.equal(preview.applicable, true, preview.conflicts.join('; '));
    assert.equal(preview.scope, 'project');
    assert.equal(path.relative(preview.target, preview.receiptPath), `.harness/installations/${platform}/receipt.json`);
    await applyInstallation(preview);
    const installed = await fs.realpath(f.discovery('research', platform));
    assert.ok(installed.startsWith(path.join(await fs.realpath(f.target), `.harness/installations/${platform}/payloads`)));
    assert.deepEqual((await f.receipt(platform, 'project')).selected, ['research']);
    assert.equal(await fs.readFile(path.join(f.discovery('local-sample', platform), 'SKILL.md'), 'utf8'), localBefore);
    assert.equal((await planProjectInstallation(f.repository, { ...projectConfiguration, operation: 'audit' })).applicable, true);
    assert.equal((await applyProjectInstallation(await planProjectInstallation(f.repository, projectConfiguration))).noOp, true);

    await fs.appendFile(path.join(f.repository, 'skills/engineering/research/SKILL.md'), '\nProject-scope update.\n');
    assert.equal((await f.apply(['research'], { platform, scope: 'project' })).noOp, false);
    assert.match(await fs.readFile(path.join(f.discovery('research', platform), 'SKILL.md'), 'utf8'), /Project-scope update/);
    assert.equal((await f.plan([], { platform, scope: 'project', operation: 'audit' })).applicable, true);

    await applyProjectInstallation(await planProjectInstallation(f.repository, { ...projectConfiguration, operation: 'remove' }));
    await assert.rejects(fs.readFile(path.join(f.discovery('local-sample', platform), 'SKILL.md')), { code: 'ENOENT' });
    assert.match(await fs.readFile(path.join(f.discovery('research', platform), 'SKILL.md'), 'utf8'), /Project-scope update/);
    await f.apply(['research'], { platform, scope: 'project', operation: 'remove' });
    await assert.rejects(fs.lstat(f.discovery('research', platform)), { code: 'ENOENT' });
    assert.deepEqual(await snapshot(machine), machineBefore);
  });
});

test('project-scoped selection preserves an M4 adapter with the same capability name', async () => fixture(async (f) => {
  await fs.mkdir(path.join(f.target, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(f.target, 'scripts/verify.mjs'), "console.log('Project verifier ran');\n");
  await fs.mkdir(path.join(f.target, '.harness/skills/team/research'), { recursive: true });
  await fs.writeFile(path.join(f.target, '.harness/skills/team/research/SKILL.md'),
    '---\nname: research\ndescription: Borrowed project implementation\n---\n\nKeep this project adapter.\n');
  await applyProjectInstallation(await planProjectInstallation(f.repository,
    { operation: 'apply', platform: 'codex', scope: 'project', target: f.target }));
  const before = await snapshot(f.target);
  const plan = await f.plan(['research'], { scope: 'project' });
  assert.equal(plan.applicable, false);
  assert.match(plan.conflicts.join(' '), /unowned discovery collision/);
  await assert.rejects(applyInstallation(plan));
  assert.deepEqual(await snapshot(f.target), before);
}));

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

test('shared dependencies remain until the final consumer is removed at each scope', async () => {
  for (const scope of ['machine', 'project']) await fixture(async (f) => {
    const file = path.join(f.repository, 'catalog/modules.json');
    const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
    catalog.capabilities.find((entry) => entry.id === 'research').requires = ['security-checklist'];
    catalog.capabilities.find((entry) => entry.id === 'grilling').requires = ['security-checklist'];
    await fs.writeFile(file, JSON.stringify(catalog));
    await f.apply(['research'], { scope });
    await f.apply(['grilling'], { scope });
    assert.deepEqual((await f.receipt('codex', scope)).entries.find((entry) => entry.id === 'security-checklist').consumers, ['grilling', 'research']);
    await f.apply(['research'], { scope, operation: 'remove' });
    assert.match(await fs.readFile(path.join(f.discovery('security-checklist'), 'SKILL.md'), 'utf8'), /Security checklist/);
    await f.apply(['grilling'], { scope, operation: 'remove' });
    await assert.rejects(fs.lstat(f.discovery('security-checklist')), { code: 'ENOENT' });
    assert.deepEqual((await f.receipt('codex', scope)).entries, []);
  });
});

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

test('malformed, forged and linked receipts cannot claim unrelated content or escape either scope', async () => {
  for (const scope of ['machine', 'project']) {
    for (const kind of ['json', 'traversal', 'target', 'hash', 'consumers', 'extra-field', 'linked', 'hardlinked', 'forged-copy']) await fixture(async (f) => {
      await f.apply(['research'], { scope });
      const outside = path.join(f.temporary, 'sentinel');
      await fs.writeFile(outside, 'Preserve outside');
      const receipt = await f.receipt('codex', scope);
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
      const receiptFile = f.receiptFile('codex', scope);
      await fs.writeFile(receiptFile, kind === 'json' ? '{broken' : JSON.stringify(receipt));
      if (kind === 'linked' || kind === 'hardlinked') {
        await fs.unlink(receiptFile);
        if (kind === 'linked') await fs.symlink(outside, receiptFile);
        else await fs.link(outside, receiptFile);
      }
      const before = await snapshot(f.target);
      if (kind === 'forged-copy') await assert.rejects(f.apply(['research'], { scope, operation: 'remove' }));
      else await assert.rejects(f.plan(['research'], { scope, operation: 'remove' }));
      assert.deepEqual(await snapshot(f.target), before);
      assert.equal(await fs.readFile(outside, 'utf8'), 'Preserve outside');
    });
  }
});

test('linked target, discovery, payload roots and resources fail without writes at either scope', async () => {
  for (const scope of ['machine', 'project']) {
    for (const kind of ['target', 'discovery', 'store', 'payload', 'resource']) await fixture(async (f) => {
      const outside = path.join(f.temporary, 'outside');
      await fs.mkdir(outside);
      await fs.writeFile(path.join(outside, 'sentinel'), 'Unrelated');
      if (kind === 'target') {
        await fs.rmdir(f.target);
        await fs.symlink(outside, f.target, linkType);
      } else if (kind === 'resource' || kind === 'payload') {
        await f.apply(['research'], { scope });
        const payload = await fs.realpath(f.discovery('research'));
        if (kind === 'resource') {
          await fs.unlink(path.join(payload, 'SKILL.md'));
          await fs.symlink(path.join(outside, 'sentinel'), path.join(payload, 'SKILL.md'));
        } else {
          await fs.rename(payload, path.join(f.temporary, 'old-payload'));
          await fs.symlink(outside, payload, linkType);
        }
      } else {
        const link = path.join(f.target, kind === 'store' ? (scope === 'project' ? '.harness' : '.ai-harness') : '.agents');
        await fs.symlink(outside, link, linkType);
      }
      const before = await snapshot(f.temporary);
      await assert.rejects(f.apply(['research'], { scope, operation: kind === 'resource' || kind === 'payload' ? 'remove' : 'apply' }));
      assert.deepEqual(await snapshot(f.temporary), before);
      assert.equal(await fs.readFile(path.join(outside, 'sentinel'), 'utf8'), 'Unrelated');
    });
  }
  await fixture(async (f) => {
    const outside = path.join(f.temporary, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'sentinel'), 'Unrelated');
    await fs.symlink(outside, path.join(f.target, '.claude'), linkType);
    const before = await snapshot(f.temporary);
    await assert.rejects(f.apply(['research'], { platform: 'claude', scope: 'project' }));
    assert.deepEqual(await snapshot(f.temporary), before);
  });
});

test('plans reject stale state and serialized authority at either scope', async () => {
  for (const scope of ['machine', 'project']) await fixture(async (f) => {
    const plan = await f.plan(['research'], { scope });
    await assert.rejects(applyInstallation(JSON.parse(JSON.stringify(plan))), /in-process/);
    plan.target = f.repository;
    plan.changes[0].discovery = path.join(f.repository, 'sentinel');
    plan.selected.push('implement');
    plan.entries[0].hash = 'forged';
    plan.entries[0].consumers.push('implement');
    await applyInstallation(plan);
    assert.deepEqual((await f.receipt('codex', scope)).selected, ['research']);
    assert.equal((await f.plan([], { scope, operation: 'audit' })).applicable, true);
    await assert.rejects(fs.lstat(path.join(f.repository, 'sentinel')), { code: 'ENOENT' });
    const next = await f.plan(['tdd'], { scope });
    await fs.mkdir(f.discovery('tdd'));
    await assert.rejects(applyInstallation(next), /conflicts|preconditions changed/);
    const sourcePlan = await f.plan(['grilling'], { scope });
    await fs.appendFile(path.join(f.repository, 'skills/productivity/grilling/SKILL.md'), '\nChanged');
    await assert.rejects(applyInstallation(sourcePlan), /preconditions changed/);
  });
});

test('publication failures restore previous discoveries and receipt; the target lock serializes both platforms', async () => {
  for (const scope of ['machine', 'project']) {
    for (const point of ['locked', 'staged', 'discovery', 'receipt']) await fixture(async (f) => {
      await f.apply(['research'], { scope });
      const previousReceipt = await fs.readFile(f.receiptFile('codex', scope), 'utf8');
      const previousLink = await fs.realpath(f.discovery('research'));
      await fs.appendFile(path.join(f.repository, 'skills/engineering/research/SKILL.md'), '\nFixture update');
      await assert.rejects(f.apply(['research', 'tdd'], { scope }, { checkpoint: async (name) => {
        if (name !== point) return;
        const competing = await f.plan(['research'], { platform: 'claude', scope });
        assert.equal(competing.applicable, false);
        await assert.rejects(applyInstallation(competing), /locked/);
        throw new Error('Injected publication failure');
      } }), /(?:Injected publication failure|Publication failed).*rolled back/);
      assert.equal(await fs.readFile(f.receiptFile('codex', scope), 'utf8'), previousReceipt);
      assert.equal(await fs.realpath(f.discovery('research')), previousLink);
      await assert.rejects(fs.lstat(f.discovery('tdd')), { code: 'ENOENT' });
      assert.equal((await f.plan([], { scope, operation: 'audit' })).applicable, true);
      await f.apply(['research', 'tdd'], { scope });
    });
  }
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
    ['apply', '--module', 'skills', ...common],
    ['audit', '--select', 'research', ...common], ['audit', ...common, '--apply']]) {
    assert.notEqual(run(...args).status, 0);
  }
  assert.deepEqual(await snapshot(f.target), before);
  const applied = run('apply', '--select', 'research', ...common, '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).applied, true);
  assert.equal(run('audit', ...common).status, 0);
  assert.equal(run('remove', '--select', 'research', ...common, '--apply').status, 0);
  const projectTarget = path.join(f.temporary, 'project');
  await fs.mkdir(projectTarget);
  const project = ['--platform', 'codex', '--scope', 'project', '--target', projectTarget, '--json'];
  assert.equal(run('apply', '--select', 'research', ...project).status, 0);
  assert.equal(run('apply', '--select', 'research', ...project, '--apply').status, 0);
  assert.equal(run('audit', ...project).status, 0);
  assert.equal(run('remove', '--select', 'research', ...project, '--apply').status, 0);
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

test('abrupt interruption leaves a visible lock and journal at either scope', async () => {
  for (const scope of ['machine', 'project']) await fixture(async (f) => {
    const script = `import {planInstallation,applyInstallation} from ${JSON.stringify(new URL('../scripts/selection-installation.mjs', import.meta.url).href)};
      const plan = await planInstallation(${JSON.stringify(f.repository)}, ${JSON.stringify(f.options(['research'], { scope }))});
      await applyInstallation(plan, {checkpoint: async (point) => {if(point === 'discovery') process.exit(73);}});`;
    const interrupted = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    assert.equal(interrupted.status, 73, interrupted.stderr);
    const audit = await f.plan([], { scope, operation: 'audit' });
    assert.equal(audit.applicable, false);
    assert.match(audit.conflicts.join(' '), /locked/);
    const store = path.dirname(f.receiptFile('codex', scope));
    const stages = (await fs.readdir(store)).filter((name) => name.startsWith('.stage-'));
    assert.equal(stages.length, 1);
    const journal = JSON.parse(await fs.readFile(path.join(store, stages[0], 'transaction.json'), 'utf8'));
    assert.equal(journal.previousReceipt, null);
    assert.deepEqual(journal.nextReceipt.selected, ['research']);
    await assert.rejects(f.apply(['research'], { scope }), /locked|collision/);
  });
});

test('a home containing the source checkout is supported but source-overlapping installation paths are denied', async () => fixture(async (f) => {
  await assert.rejects(f.plan(['research'], { target: f.repository }), /outside the source checkout/);
  await assert.rejects(f.plan(['research'], { scope: 'project', target: f.temporary }), /must not overlap/);
  await f.apply(['research'], { target: f.temporary });
  assert.match(await fs.readFile(path.join(f.temporary, '.agents/skills/research/SKILL.md'), 'utf8'), /name: research/);
  assert.equal((await f.plan([], { operation: 'audit', target: f.temporary })).applicable, true);
  const insideDiscovery = path.join(f.target, '.agents/skills/source');
  await fs.mkdir(path.dirname(insideDiscovery), { recursive: true });
  await fs.rename(f.repository, insideDiscovery);
  await assert.rejects(planInstallation(insideDiscovery, f.options()), /overlap/);
}));

test('initial installation and removal failures restore discovery and receipt ownership at either scope', async () => {
  for (const scope of ['machine', 'project']) await fixture(async (f) => {
    const hooks = { checkpoint: async (point) => { if (point === 'receipt') throw new Error('Receipt failure'); } };
    await assert.rejects(f.apply(['research'], { scope }, hooks), /rolled back/);
    await assert.rejects(fs.lstat(f.discovery('research')), { code: 'ENOENT' });
    await assert.rejects(fs.lstat(f.receiptFile('codex', scope)), { code: 'ENOENT' });
    await f.apply(['research', 'tdd'], { scope });
    const previous = await fs.readFile(f.receiptFile('codex', scope), 'utf8');
    const discovery = await fs.realpath(f.discovery('research'));
    await assert.rejects(f.apply(['research'], { scope, operation: 'remove' }, hooks), /rolled back/);
    assert.equal(await fs.realpath(f.discovery('research')), discovery);
    assert.equal(await fs.readFile(f.receiptFile('codex', scope), 'utf8'), previous);
    assert.equal((await f.plan([], { scope, operation: 'audit' })).applicable, true);
  });
});

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


test('historical ownership rejects semantic consumer edits', async () => fixture(async (f) => {
  const file = path.join(f.repository, 'catalog/modules.json');
  const catalog = JSON.parse(await fs.readFile(file));
  for (const id of ['research', 'grilling']) catalog.capabilities.find((entry) => entry.id === id).requires = ['security-checklist'];
  await fs.writeFile(file, JSON.stringify(catalog));
  await f.apply(['research', 'grilling']);
  const receipt = await f.receipt();
  receipt.entries.find((entry) => entry.id === 'security-checklist').consumers = ['research'];
  await fs.writeFile(f.receiptFile(), JSON.stringify(receipt));
  const before = await snapshot(f.target);
  await assert.rejects(f.plan([], { operation: 'audit' }));
  await assert.rejects(f.apply(['research'], { operation: 'remove' }));
  assert.deepEqual(await snapshot(f.target), before);
}));

test('historical skill removal and CLI audit survive retired catalog and invalid drafts', async () => fixture(async (f) => {
  await f.apply(['research']);
  const catalogFile = path.join(f.repository, 'catalog/modules.json');
  const catalog = JSON.parse(await fs.readFile(catalogFile));
  catalog.capabilities.find((entry) => entry.id === 'research').scopes = ['project'];
  await fs.writeFile(catalogFile, JSON.stringify(catalog));
  assert.equal((await f.plan(['research'], { operation: 'remove' })).applicable, true);
  await fs.writeFile(path.join(f.repository, 'catalog/modules.json'), 'Invalid draft');
  assert.equal((await f.plan([], { operation: 'audit' })).applicable, true);
  const cli = spawnSync(process.execPath, [path.join(f.repository, 'scripts/setup.mjs'), 'audit', '--target', f.target, '--scope', 'machine', '--platform', 'codex'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  await f.apply(['research'], { operation: 'remove' });
  await assert.rejects(fs.lstat(f.discovery('research')), { code: 'ENOENT' });
}));


test('replaying a historical skill receipt cannot retire a current shared dependency', async () => fixture(async (f) => {
  const file = path.join(f.repository, 'catalog/modules.json');
  const catalog = JSON.parse(await fs.readFile(file));
  for (const id of ['research', 'grilling']) catalog.capabilities.find((entry) => entry.id === id).requires = ['security-checklist'];
  await fs.writeFile(file, JSON.stringify(catalog));
  await f.apply(['research']);
  const historical = await fs.readFile(f.receiptFile());
  await f.apply(['grilling']);
  await fs.writeFile(f.receiptFile(), historical);
  const before = await snapshot(f.target);
  await assert.rejects(f.plan([], { operation: 'audit' }), /Current ownership/);
  await assert.rejects(f.apply(['research']), /Current ownership/);
  await assert.rejects(f.apply(['research'], { operation: 'remove' }), /Current ownership/);
  assert.deepEqual(await snapshot(f.target), before);
  assert.ok(await fs.readFile(path.join(f.discovery('security-checklist'), 'SKILL.md')));
}));
