import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { runVerification } from '../scripts/verification-runner.mjs';

const root = path.resolve(import.meta.dirname, '..');

function output() {
  let value = '';
  return { stream: { write(chunk) { value += String(chunk); } }, read: () => value };
}

test('quiet verification hides successful command output', () => {
  const stdout = output();
  const stderr = output();
  const result = runVerification({
    steps: [{ name: 'Tests' }],
    execute: () => ({ status: 0, stdout: '200 detailed passing test lines\n', stderr: '' }),
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(result.status, 0);
  assert.equal(stdout.read(), 'PASS\n');
  assert.equal(stderr.read(), '');
});

test('successful verification reports concise warnings and skips', () => {
  const stdout = output();
  const result = runVerification({
    steps: [{ name: 'Tests' }, { name: 'Workflow security' }],
    execute: (step) => step.name === 'Tests'
      ? { status: 0, stdout: 'passed 198\nskipped 2\n' }
      : { status: 0, stderr: 'WARN offline audits are unavailable\n' },
    stdout: stdout.stream,
    stderr: output().stream,
  });
  assert.equal(result.status, 0);
  assert.equal(stdout.read(), 'PASS WITH WARNINGS\n- Tests: 2 checks skipped.\n- Workflow security: WARN offline audits are unavailable\n');
});

test('failure output is bounded and preserves the complete private log', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'verification-runner-test-'));
  const stdout = output();
  const stderr = output();
  try {
    const result = runVerification({
      steps: [{ name: 'Syntax' }, { name: 'Tests' }, { name: 'Never reached' }],
      execute: (step) => step.name === 'Syntax'
        ? { status: 0, stdout: 'Successful syntax details\n' }
        : { status: 7, stdout: '✖ blocks force pushes\nAssertionError: expected denied, received allowed\nmore details\n' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      temporaryRoot: temporary,
    });
    assert.equal(result.status, 7);
    assert.equal(stdout.read(), '');
    assert.match(stderr.read(), /^FAIL: Tests\n✖ blocks force pushes\nAssertionError:/);
    assert.match(stderr.read(), /Full log:/);
    const log = await fs.readFile(result.logPath, 'utf8');
    assert.match(log, /Successful syntax details/);
    assert.match(log, /expected denied, received allowed/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test('verbose mode exposes stage output and rejects unknown options', () => {
  const stdout = output();
  const verbose = runVerification({
    steps: [{ name: 'Tests' }],
    execute: () => ({ status: 0, stdout: 'test details\n' }),
    argv: ['--verbose'],
    stdout: stdout.stream,
    stderr: output().stream,
  });
  assert.equal(verbose.status, 0);
  assert.match(stdout.read(), /==> Tests\ntest details\nPASS\n$/);

  const stderr = output();
  const invalid = runVerification({ steps: [], execute() {}, argv: ['--unknown'], stdout: output().stream, stderr: stderr.stream });
  assert.equal(invalid.status, 2);
  assert.equal(stderr.read(), 'Usage: node scripts/verify.mjs [--verbose]\n');
});

test('generated project verifier embeds the same quiet runner', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'generated-verifier-test-'));
  try {
    await fs.mkdir(path.join(temporary, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(temporary, '.harness/runtime'), { recursive: true });
    await fs.copyFile(path.join(root, 'scripts/windows-cli.mjs'), path.join(temporary, '.harness/runtime/windows-cli.mjs'));
    const template = await fs.readFile(path.join(root, 'project/scripts/verify.mjs.template'), 'utf8');
    const runner = await fs.readFile(path.join(root, 'scripts/verification-runner.mjs'), 'utf8');
    const steps = [{ name: 'Fixture', command: process.execPath, args: ['-e', "console.log('hidden details')"] }];
    const generated = template
      .replace('__VERIFICATION_RUNNER_SOURCE__', runner)
      .replace('__VERIFY_STEPS__', JSON.stringify(steps, null, 2));
    await fs.writeFile(path.join(temporary, 'scripts/verify.mjs'), generated);

    const result = spawnSync(process.execPath, ['scripts/verify.mjs'], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'PASS\n');
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
