import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHook } from '../components/guard-policy.mjs';

function command(value, currentBranch = 'feature/example') {
  return evaluateHook({ hook_event_name: 'PreToolUse', tool_input: { command: value } }, currentBranch);
}

test('blocks normal and dangerous pushes', () => {
  for (const value of [
    'git push',
    'git push origin feature/example',
    'git push --force origin research/example',
    'git push origin research/example --tags',
    'git push upstream research/example',
  ]) assert.ok(command(value));
});

test('allows only the current research branch shape', () => {
  assert.equal(command('git push origin research/auth-options', 'research/auth-options'), null);
  assert.ok(command('git push origin research/another', 'research/auth-options'));
});

test('blocks destructive Git commands', () => {
  for (const value of [
    'git reset --hard',
    'git clean -fd',
    'git branch -D old-work',
    'git checkout .',
    'git restore .',
  ]) assert.ok(command(value));
});

test('blocks secret reads but permits env templates', () => {
  assert.ok(command('Get-Content .env.local'));
  assert.ok(evaluateHook({ hook_event_name: 'PreToolUse', tool_input: { file_path: 'src/private.pem' } }));
  assert.equal(command('Get-Content .env.example'), null);
});
