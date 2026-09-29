import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { claudeSecretDenials, containsSensitivePath, isSecretBearingCommitPath } from '../components/secret-policy.mjs';
import { claudeLaunchArgs, loadClaudeToolConfig } from '../scripts/claude-dev.mjs';
import { hasHarnessHook, reconcileHarnessDenials, replaceHarnessHook } from '../scripts/config-merge.mjs';
import { buildVerificationSteps } from '../scripts/project-verification.mjs';
import { inspectManagedSkillLink, readLinkTarget } from '../scripts/skill-lib.mjs';

test('replacing the exact harness hook preserves sibling hooks and is idempotent', () => {
  const sibling = { type: 'command', command: 'node keep-this-hook.mjs' };
  const metadata = { matcher: 'Read', description: 'reserved by another tool' };
  const groups = [{ matcher: 'Bash', hooks: [
    { type: 'command', command: 'node new/guard-git.mjs' },
    sibling,
  ] }, metadata];
  const replacement = { matcher: 'Bash', hooks: [{ type: 'command', command: 'node new/guard-git.mjs' }] };

  const result = replaceHarnessHook(groups, replacement);
  assert.deepEqual(result, [
    { matcher: 'Bash', hooks: [sibling] },
    metadata,
    replacement,
  ]);
  assert.deepEqual(replaceHarnessHook(result, replacement), result);
  assert.ok(hasHarnessHook(result, replacement));
});

test('hook ownership includes the exact command, Windows command, metadata and group context', () => {
  const replacement = { matcher: 'Bash|Read', hooks: [{ type: 'command', command: 'node "/harness/guard-git.mjs"', commandWindows: 'node harness-guard', timeout: 10 }] };
  const unrelated = [
    { ...replacement, hooks: [{ ...replacement.hooks[0], command: 'node "/company/guard-git.mjs"' }] },
    { ...replacement, matcher: 'Read' },
    { ...replacement, hooks: [{ ...replacement.hooks[0], commandWindows: 'node company-guard' }] },
    { ...replacement, hooks: [{ ...replacement.hooks[0], timeout: 20 }] },
    { ...replacement, description: 'User customization' },
  ];
  assert.deepEqual(replaceHarnessHook(unrelated, replacement), [...unrelated, replacement]);
  for (const group of unrelated) assert.equal(hasHarnessHook([group], replacement), false);
});

test('broken harness links still reveal their intended target', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-link-test-'));
  const target = path.join(temporary, 'generated', 'retired-skill');
  const link = path.join(temporary, 'installed-skill');
  try {
    await fs.mkdir(target, { recursive: true });
    await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    await fs.rm(target, { recursive: true, force: true });
    assert.equal(path.resolve(await readLinkTarget(link)), path.resolve(target));
    assert.equal(await inspectManagedSkillLink(link, target), 'broken');
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test('harness denial reconciliation removes only obsolete owned rules', () => {
  assert.deepEqual(
    reconcileHarnessDenials(
      ['Read(.env)', 'Bash(git push:*)', 'Bash(company-policy:*)'],
      ['Read(.env)', 'Monitor'],
      ['Bash(git push:*)'],
    ),
    ['Read(.env)', 'Bash(company-policy:*)', 'Monitor'],
  );
});

test('project verification includes local security gates', () => {
  const steps = buildVerificationSteps({
    hasDotnet: false,
    hasNode: true,
    isGithub: true,
    packageJson: { scripts: { test: 'node --test' } },
    relativeFiles: ['package.json', 'package-lock.json'],
  });
  assert.ok(steps.some((step) => step.command === 'gitleaks'));
  assert.ok(steps.some((step) => step.command === 'zizmor'));
});

test('secret paths have one canonical policy for settings, runtime and commits', async () => {
  assert.ok(claudeSecretDenials('machine').includes('Read(~/.ssh/**)'));
  assert.ok(claudeSecretDenials('project').includes('Read(./.env)'));
  for (const file of ['.netrc', '.git-credentials', '.pypirc']) {
    assert.ok(claudeSecretDenials('machine').includes(`Read(**/${file})`));
    assert.equal(containsSensitivePath(file), true);
    assert.equal(isSecretBearingCommitPath(file), true);
  }
  assert.equal(containsSensitivePath('src/private.pem'), true);
  assert.equal(containsSensitivePath('.env.example'), false);
  assert.equal(isSecretBearingCommitPath('config/.env.local'), true);
  assert.equal(isSecretBearingCommitPath('config/.env.template'), false);
  const settings = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, '..', 'global/claude-settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions.deny, []);
});

test('Claude launcher uses a focused native tool allowlist and guards both shells', async () => {
  const config = await loadClaudeToolConfig();
  for (const tool of ['Agent', 'AskUserQuestion', 'Bash', 'Edit', 'Glob', 'Grep', 'LSP', 'Read', 'Skill', 'WebFetch', 'WebSearch', 'Write']) {
    assert.ok(config.tools.includes(tool), tool);
  }
  for (const tool of ['Artifact', 'CronCreate', 'Monitor', 'NotebookEdit', 'TaskOutput', 'Workflow']) {
    assert.equal(config.tools.includes(tool), false, tool);
  }
  assert.deepEqual(claudeLaunchArgs(['Read', 'Write'], ['--model', 'sonnet']), ['--tools', 'Read,Write', '--model', 'sonnet']);
  assert.throws(() => claudeLaunchArgs(['Read'], ['--tools', 'default']), /claude-tools\.json/);
  const settings = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, '..', 'global/claude-settings.json'), 'utf8'));
  assert.equal(settings.hooks.PreToolUse[0].matcher, 'Bash|PowerShell|Read');
});
