import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assessReceiptMigration } from '../scripts/assess-receipt-migration.mjs';
import { planGlobalInstallation, applyGlobalInstallation } from '../scripts/global-installation.mjs';
import { planInstallation, applyInstallation } from '../scripts/selection-installation.mjs';
import { planProjectInstallation, applyProjectInstallation } from '../scripts/project-installation.mjs';
import { snapshot } from './helpers/filesystem-snapshot.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('ownership evidence collisions are rejected by read-only preflight', async () => {
  for (const planner of [planInstallation, planGlobalInstallation]) {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-collision-'));
    try {
      const options = { target, platform: 'codex', scope: 'machine', ids: ['research'] };
      const plan = await planner(root, options);
      assert.equal(plan.evidence.action, 'create');
      await fs.mkdir(path.dirname(plan.evidence.path), { recursive: true });
      await fs.writeFile(plan.evidence.path, '{}');
      const before = await snapshot(target);
      await assert.rejects(planner(root, options));
      assert.deepEqual(await snapshot(target), before);
    } finally { await fs.rm(target, { recursive: true, force: true }); }
  }
});

test('receipt assessment preserves current, legacy, tampered and unsupported state for every module', async () => {
  for (const module of ['skills', 'global-configuration', 'project-configuration']) {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'receipt-review-'));
    try {
      const options = { target, platform: 'codex', module };
      assert.equal((await assessReceiptMigration(root, options)).status, 'absent');
      const project = module === 'project-configuration';
      if (project) {
        await fs.mkdir(path.join(target, 'scripts'));
        await fs.writeFile(path.join(target, 'scripts/verify.mjs'), '');
      }
      const plan = project ? planProjectInstallation : module === 'skills' ? planInstallation : planGlobalInstallation;
      const apply = project ? applyProjectInstallation : module === 'skills' ? applyInstallation : applyGlobalInstallation;
      await apply(await plan(root, { target, platform: 'codex', scope: project ? 'project' : 'machine', ...(module === 'skills' ? { ids: ['research'] } : {}) }));
      const relative = project ? '.harness/project-installation.json' : `.ai-harness/installations/codex/${module === 'skills' ? 'receipt.json' : 'global.json'}`;
      const file = path.join(target, relative);
      const original = JSON.parse(await fs.readFile(file));
      const current = await snapshot(target);
      assert.equal((await assessReceiptMigration(root, options)).status, 'current');
      assert.deepEqual(await snapshot(target), current);
      for (const version of (project ? [1, 2, 99] : [1, 99])) {
        const changed = { ...original, version };
        if (version === 1) { delete changed.evidence; delete changed.payload; }
        await fs.writeFile(file, JSON.stringify(changed));
        const before = await snapshot(target);
        assert.equal((await assessReceiptMigration(root, options)).status, version < original.version ? 'review-required' : 'conflict');
        await assert.rejects(plan(root, { target, platform: 'codex', scope: project ? 'project' : 'machine', operation: 'remove', ...(module === 'skills' ? { ids: ['research'] } : {}) }));
        assert.deepEqual(await snapshot(target), before);
      }
      await fs.writeFile(file, JSON.stringify(original));
      const evidence = project ? `.harness/project-payloads/${original.payload}/manifest.json`
        : `.ai-harness/installations/codex/evidence/${original.evidence}.json`;
      await fs.writeFile(path.join(target, evidence), '{}');
      const damaged = await snapshot(target);
      assert.equal((await assessReceiptMigration(root, options)).status, 'conflict');
      assert.deepEqual(await snapshot(target), damaged);
      await fs.unlink(path.join(target, evidence));
      assert.equal((await assessReceiptMigration(root, options)).status, 'conflict');
    } finally { await fs.rm(target, { recursive: true, force: true }); }
  }
});

test('reviewed recovery from a known pre-install baseline preserves backups and later unrelated settings', async () => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), 'receipt-rehearsal-'));
  try {
    const directory = path.join(target, '.claude');
    const settingsFile = path.join(directory, 'settings.json');
    await fs.mkdir(directory);
    const trustedBaseline = { autoMemoryEnabled: true, userPreference: 'keep' };
    await fs.writeFile(settingsFile, JSON.stringify(trustedBaseline));
    const options = { target, platform: 'claude', scope: 'machine' };
    const apply = async (operation = 'apply') => applyGlobalInstallation(await planGlobalInstallation(root, { ...options, operation }));
    await apply();
    const receiptFile = path.join(target, '.ai-harness/installations/claude/global.json');
    const legacy = JSON.parse(await fs.readFile(receiptFile));
    legacy.version = 1; delete legacy.evidence;
    await fs.writeFile(receiptFile, JSON.stringify(legacy));
    const live = JSON.parse(await fs.readFile(settingsFile)); live.laterUserSetting = true;
    await fs.writeFile(settingsFile, JSON.stringify(live));
    const backup = path.join(target, 'private-recovery');
    await fs.mkdir(backup, { mode: 0o700 });
    await fs.rename(settingsFile, path.join(backup, 'settings.json'));
    // Re-enter after an interrupted, partially executed reconciliation.
    const interrupted = await snapshot(target);
    assert.equal((await assessReceiptMigration(root, { ...options, module: 'global-configuration' })).status, 'review-required');
    await assert.rejects(apply());
    assert.deepEqual(await snapshot(target), interrupted);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(backup, 'settings.json'))), live);
    // These fixed files and baseline represent the owner's reviewed reconciliation.
    // Never derive this authorization from the legacy receipt's ownership claims.
    for (const [file, name] of [[receiptFile, 'receipt.json'], [path.join(directory, 'CLAUDE.md'), 'guidance.md'], [path.join(target, '.ai-harness/installations/claude/global-current.json'), 'current.json']]) {
      await fs.rename(file, path.join(backup, name));
    }
    const retained = { ...trustedBaseline, laterUserSetting: true };
    await fs.writeFile(settingsFile, JSON.stringify(retained));
    const saved = await snapshot(backup);
    await apply();
    assert.equal((await assessReceiptMigration(root, { ...options, module: 'global-configuration' })).status, 'current');
    assert.equal((await apply()).noOp, true);
    await apply('remove');
    assert.deepEqual(JSON.parse(await fs.readFile(settingsFile)), retained);
    assert.deepEqual(await snapshot(backup), saved);
  } finally { await fs.rm(target, { recursive: true, force: true }); }
});
