import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCommitBranch, evaluateHook, parseHookInput } from '../components/guard-policy.mjs';

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

test('allows commits only on feature and research branches', () => {
  assert.equal(evaluateCommitBranch('feature/auth-flow'), null);
  assert.equal(evaluateCommitBranch('research/auth-options'), null);
  for (const branch of ['', 'main', 'master', 'fix/auth-flow', 'codex/auth-flow']) {
    assert.ok(evaluateCommitBranch(branch));
  }
});

test('blocks destructive Git commands', () => {
  for (const value of [
    'git reset --hard',
    'git reset --hard;',
    'git reset --hard&& echo unsafe',
    'git reset --hard>reset.log',
    'git clean -fd',
    'git clean -fd; Write-Output unsafe',
    'git branch -D old-work',
    'git branch -D old-work>deleted.log',
    'git checkout .',
    'git checkout .;',
    'git restore .',
    'git restore . | Write-Output',
    'git clean --force',
    'git checkout --force .',
    'git restore --worktree .',
    'git branch --delete --force old-work',
    'git checkout -f',
    'git checkout HEAD -- .',
    'git reset --keep HEAD~1',
    'git reset --merge',
    'git rm -rf .',
    'git stash clear',
    'git worktree remove --force ../wt',
    'git -C ../repo clean --force',
  ]) assert.ok(command(value));
});

test('allows non-destructive Git forms needed for normal work', () => {
  for (const value of [
    'git clean -n',
    'git branch -d merged-work',
    'git checkout feature/example',
    'git restore src/example.mjs',
    'git rm src/obsolete.mjs',
    'git worktree remove ../clean-worktree',
  ]) assert.equal(command(value), null);
});

test('blocks secret reads but permits env templates', () => {
  assert.ok(command('Get-Content .env.local'));
  assert.ok(evaluateHook({ hook_event_name: 'PreToolUse', tool_input: { file_path: 'src/private.pem' } }));
  assert.ok(command('Get-Content src/private.pem;'));
  assert.ok(command('cat ./keys/signing.key | openssl rsa -check'));
  assert.ok(command('Get-Content src/private.pem>copied.txt'));
  for (const value of [
    'cat ~/.claude/.credentials.json',
    'cat ~/.config/gh/hosts.yml',
    'gh auth token',
    'cat ~/.npmrc',
    'cat ~/.kube/config',
    'cat ~/.docker/config.json',
    'cat ~/.gnupg/secring.gpg',
    'cat serviceAccount.json',
    'cat application_default_credentials.json',
    'printenv',
    'env',
    'Get-ChildItem Env:',
    'Get-Item Env:*',
  ]) assert.ok(command(value));
  assert.equal(command('Get-Content .env.example'), null);
  assert.equal(command('env NODE_ENV=test node app.mjs'), null);
  assert.equal(command('Get-Item Env:NODE_ENV'), null);
});

test('malformed and empty hook input fail closed', () => {
  for (const input of ['not-json', '', '{}', 'null', '{"tool_input":"git status"}', '{"arguments":[]}']) assert.ok(parseHookInput(input).reason);
  assert.deepEqual(parseHookInput('{"tool_input":{"command":"git status"}}'), {
    input: { tool_input: { command: 'git status' } },
  });
});
