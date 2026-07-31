import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deniedClaudeBuiltInTools } from '../components/claude-tool-policy.mjs';
import { replaceHarnessHook } from '../scripts/config-merge.mjs';
import { buildVerificationSteps } from '../scripts/project-verification.mjs';
import { readLinkTarget } from '../scripts/skill-lib.mjs';

test('replacing the harness hook preserves sibling hooks', () => {
  const sibling = { type: 'command', command: 'node keep-this-hook.mjs' };
  const metadata = { matcher: 'Read', description: 'reserved by another tool' };
  const groups = [{ matcher: 'Bash', hooks: [
    { type: 'command', command: 'node old/guard-git.mjs' },
    sibling,
  ] }, metadata];
  const replacement = { matcher: 'Bash', hooks: [{ type: 'command', command: 'node new/guard-git.mjs' }] };

  const result = replaceHarnessHook(groups, replacement);
  assert.deepEqual(result, [
    { matcher: 'Bash', hooks: [sibling] },
    metadata,
    replacement,
  ]);
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
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
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

test('Claude tool policy removes only approved optional tools and guards both shells', async () => {
  assert.deepEqual(deniedClaudeBuiltInTools, [
    'Artifact',
    'CronCreate',
    'CronDelete',
    'CronList',
    'EnterWorktree',
    'ExitWorktree',
    'Monitor',
    'NotebookEdit',
    'PushNotification',
    'RemoteTrigger',
    'ScheduleWakeup',
    'SendUserFile',
    'ShareOnboardingGuide',
    'TaskOutput',
    'Workflow',
  ]);
  for (const relative of ['global/claude-settings.json', 'project/.claude/settings.json']) {
    const settings = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, '..', relative), 'utf8'));
    assert.equal(settings.hooks.PreToolUse[0].matcher, 'Bash|PowerShell|Read');
  }
  assert.equal(deniedClaudeBuiltInTools.includes('Bash'), false);
  assert.equal(deniedClaudeBuiltInTools.includes('PowerShell'), false);
});
