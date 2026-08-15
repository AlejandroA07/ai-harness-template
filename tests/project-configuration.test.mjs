import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectDomainSignals, inspectExistingDomainConfiguration, inspectExistingDomainContract, inspectExistingTrackerConfiguration, renderDomainInstructions, renderTrackerInstructions } from '../scripts/project-configuration.mjs';

test('detects only approved Node, .NET, and Java multi-project signals', () => {
  assert.deepEqual(detectDomainSignals(['pnpm-workspace.yaml'], {}), ['pnpm workspace']);
  assert.deepEqual(detectDomainSignals([], { workspaces: ['apps/*'] }), ['package.json workspaces']);
  assert.match(detectDomainSignals(['src/a/a.csproj', 'src/b/b.csproj'], {}).join(','), /\.NET/);
  assert.match(detectDomainSignals(['pom.xml', 'service/pom.xml'], {}).join(','), /Java/);
  assert.match(detectDomainSignals(['build.gradle.kts', 'service/build.gradle.kts'], {}).join(','), /Java/);
  assert.deepEqual(detectDomainSignals(['settings.gradle.kts', 'build.gradle.kts'], {}), []);
  assert.deepEqual(detectDomainSignals(['pyproject.toml', 'crates/a/Cargo.toml'], {}), []);
});

test('renders one shared GitHub or local tracker contract', () => {
  const github = renderTrackerInstructions({ github: true });
  assert.match(github, /ready-for-agent/);
  assert.match(github, /numeric database .*id/);
  assert.match(github, /sub_issue_id=<database-id>/);
  assert.match(github, /issue_id=<blocker-database-id>/);
  assert.match(github, /--body-file/);
  assert.doesNotMatch(github, /GitLab|Jira|triage/);
  assert.match(renderTrackerInstructions({ github: false }), /\.scratch/);
});

test('domain guidance stays lazy and supports either layout', () => {
  assert.match(renderDomainInstructions(), /create them lazily/);
  assert.match(renderDomainInstructions({ multiContext: true }), /CONTEXT-MAP\.md/);
});

test('existing generated domain contracts preserve the reviewed lazy layout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-contract-'));
  try {
    assert.deepEqual(await inspectExistingDomainContract(root), { state: 'unconfigured' });
    const contract = path.join(root, 'docs', 'agents', 'domain.md');
    await fs.mkdir(path.dirname(contract), { recursive: true });
    await fs.writeFile(contract, renderDomainInstructions({ multiContext: true }));
    assert.deepEqual(await inspectExistingDomainContract(root), { state: 'configured', layout: 'multi' });
    await fs.writeFile(contract, '# Custom domain instructions\n');
    assert.equal((await inspectExistingDomainContract(root)).state, 'conflict');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('domain contract inspection reads the same file object that it validates', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-contract-race-'));
  try {
    const contract = path.join(root, 'docs', 'agents', 'domain.md');
    const replacement = path.join(root, 'replacement.md');
    await fs.mkdir(path.dirname(contract), { recursive: true });
    await fs.writeFile(contract, '# Custom domain instructions\n');
    await fs.writeFile(replacement, renderDomainInstructions());

    const originalLstat = fs.lstat.bind(fs);
    let replaced = false;
    t.mock.method(fs, 'lstat', async (file, ...args) => {
      const stat = await originalLstat(file, ...args);
      if (!replaced && path.resolve(file) === contract) {
        replaced = true;
        await fs.rm(contract);
        await fs.rename(replacement, contract);
      }
      return stat;
    });

    const result = await inspectExistingDomainContract(root);
    assert.equal(result.state, 'conflict');
    assert.match(result.reason, /recognized/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('existing tracker contracts must match deterministic hosting detection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tracker-config-'));
  try {
    assert.deepEqual(await inspectExistingTrackerConfiguration(root, true), { state: 'unconfigured' });
    const tracker = path.join(root, 'docs', 'agents', 'issue-tracker.md');
    await fs.mkdir(path.dirname(tracker), { recursive: true });
    await fs.writeFile(tracker, renderTrackerInstructions({ github: true }));
    assert.deepEqual(await inspectExistingTrackerConfiguration(root, true), { state: 'aligned', tracker: 'github' });
    assert.equal((await inspectExistingTrackerConfiguration(root, false)).state, 'conflict');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('tracker inspection reads the same file object that it validates', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tracker-race-'));
  try {
    const tracker = path.join(root, 'docs', 'agents', 'issue-tracker.md');
    const replacement = path.join(root, 'replacement.md');
    await fs.mkdir(path.dirname(tracker), { recursive: true });
    await fs.writeFile(tracker, '# Custom tracker\n');
    await fs.writeFile(replacement, renderTrackerInstructions({ github: true }));

    const originalLstat = fs.lstat.bind(fs);
    let replaced = false;
    t.mock.method(fs, 'lstat', async (file, ...args) => {
      const stat = await originalLstat(file, ...args);
      if (!replaced && path.resolve(file) === tracker) {
        replaced = true;
        await fs.rm(tracker);
        await fs.rename(replacement, tracker);
      }
      return stat;
    });

    const result = await inspectExistingTrackerConfiguration(root, true);
    assert.equal(result.state, 'conflict');
    assert.match(result.reason, /custom/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('existing contradictory root domain files require review', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-config-'));
  try {
    assert.deepEqual(await inspectExistingDomainConfiguration(root), { state: 'unconfigured' });
    await fs.writeFile(path.join(root, 'CONTEXT.md'), '# Context\n');
    assert.deepEqual(await inspectExistingDomainConfiguration(root), { state: 'single-context' });
    await fs.writeFile(path.join(root, 'CONTEXT-MAP.md'), '# Map\n');
    assert.equal((await inspectExistingDomainConfiguration(root)).state, 'conflict');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('root domain inspection reads the same file object that it validates', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-config-race-'));
  try {
    const context = path.join(root, 'CONTEXT.md');
    const replacement = path.join(root, 'replacement.md');
    await fs.writeFile(context, 'not a valid context file\n');
    await fs.writeFile(replacement, '# Replacement context\n');

    const originalLstat = fs.lstat.bind(fs);
    let replaced = false;
    t.mock.method(fs, 'lstat', async (file, ...args) => {
      const stat = await originalLstat(file, ...args);
      if (!replaced && path.resolve(file) === context) {
        replaced = true;
        await fs.rm(context);
        await fs.rename(replacement, context);
      }
      return stat;
    });

    const result = await inspectExistingDomainConfiguration(root);
    assert.equal(result.state, 'conflict');
    assert.match(result.reason, /heading/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('existing domain maps are validated instead of trusted blindly', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-map-'));
  try {
    await fs.writeFile(path.join(root, 'CONTEXT-MAP.md'), '# Context map\n\n- [Billing](billing/CONTEXT.md)\n');
    assert.equal((await inspectExistingDomainConfiguration(root)).state, 'conflict');
    await fs.mkdir(path.join(root, 'billing'));
    await fs.writeFile(path.join(root, 'billing', 'CONTEXT.md'), '# Billing\n');
    assert.deepEqual(await inspectExistingDomainConfiguration(root), { state: 'multi-context' });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
