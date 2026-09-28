import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHook, parseHookInput } from '../components/guard-policy.mjs';

function command(value, currentBranch = 'feature/example') {
  return evaluateHook({ hook_event_name: 'PreToolUse', tool_input: { command: value } }, currentBranch);
}

test('checks push safety without deciding which branch family policy authorizes', () => {
  assert.equal(command('git push origin feature/example', 'feature/example'), null);
  assert.equal(command('git push -u origin feature/example', 'feature/example'), null);
  assert.equal(command('git push --set-upstream origin research/auth-options', 'research/auth-options'), null);
  assert.equal(command('git push origin prototype/auth-options', 'prototype/auth-options'), null);
  assert.equal(command('git push origin release/1.2.0', 'release/1.2.0'), null);
});

test('blocks implicit, mismatched, alternate, compound, and dangerous pushes', () => {
  for (const value of [
    'git push',
    'git push origin another/example',
    'git push --force origin feature/example',
    'git push --force-with-lease origin feature/example',
    'git push origin feature/example --tags',
    'git push upstream feature/example',
    'git push origin feature/example:feature/example',
    'git push origin --delete feature/example',
    'git push --mirror origin',
    'git status && git push origin feature/example',
    "sh -c 'git push origin feature/example'",
  ]) assert.ok(command(value));
  assert.ok(command('git push origin feature/another', 'feature/example'));
  assert.ok(command('git push origin research/another', 'research/auth-options'));
  assert.ok(command('git push origin main', 'main'));
  assert.ok(command('git push origin master', 'master'));
});

test('mentions of push syntax are not treated as invocations', () => {
  for (const value of [
    "rg -n --glob '!.git/**' 'git push' .",
    "echo 'git push --force origin feature/example'",
    "sh -c \"rg -n 'git push' .\"",
  ]) assert.equal(command(value), null);
});

test('blocks destructive Git commands', () => {
  for (const value of [
    'git reset --hard',
    'git reset --hard;',
    'git reset --hard&& echo unsafe',
    'git reset --hard>reset.log',
    'git clean -fd',
    'git clean -fd; Write-Output unsafe',
    'git checkout .',
    'git checkout .;',
    'git restore .',
    'git restore . | Write-Output',
    'git clean --force',
    'git checkout --force .',
    'git restore --worktree .',
    'git checkout -f',
    'git checkout HEAD -- .',
    'git rm -rf .',
    'git stash clear',
    'git worktree remove --force ../wt',
    'git -C ../repo clean --force',
    'git commit --no-verify -m unsafe',
    'git commit -nm unsafe',
    'git -c core.hooksPath=/dev/null commit -m unsafe',
    'git config core.hooksPath /dev/null',
    'git config --unset core.hooksPath',
  ]) assert.ok(command(value));
});

test('allows non-destructive Git forms needed for normal work', () => {
  for (const value of [
    'git clean -n',
    'git branch -d merged-work',
    'git branch -D old-work',
    'git branch --delete --force old-work',
    'git checkout feature/example',
    'git reset --keep HEAD~1',
    'git reset --merge',
    'git restore src/example.mjs',
    'git rm src/obsolete.mjs',
    'git worktree remove ../clean-worktree',
    'git commit -m safe',
    'git config user.name Example',
  ]) assert.equal(command(value), null);
});

test('allows normal GitHub collaboration and the tracker relationship endpoints', () => {
  for (const value of [
    'gh issue view 42 --comments',
    'gh issue create --title Example --body-file body.md',
    'gh issue edit 42 --add-assignee @me',
    'gh pr create --title Example --body-file body.md',
    'gh pr review 42 --approve',
    'gh pr merge 42 --squash',
    'gh release create v1.0.0',
    'gh release edit v1.0.0 --notes Updated',
    'gh release upload v1.0.0 artifact.zip',
    'gh workflow run deploy.yml',
    'gh run cancel 123',
    'gh run rerun 123',
    'gh run view 123',
    'gh api repos/acme/example/issues/42 --jq .id',
    'gh api --method POST repos/acme/example/issues/42/sub_issues -F sub_issue_id=123',
    'gh api -XPOST repos/acme/example/issues/42/dependencies/blocked_by -F issue_id=123',
    'gh -R acme/example issue list',
  ]) assert.equal(command(value), null, value);
});

test('blocks destructive and high-impact GitHub operations', () => {
  for (const value of [
    'gh repo delete acme/example --yes',
    'gh issue delete 42 --yes',
    'gh repo edit acme/example --visibility public',
    'gh repo archive acme/example --yes',
    'gh repo sync acme/example --force',
    'gh release delete v1.0.0 --yes',
    'gh workflow disable deploy.yml',
    'gh secret set API_TOKEN',
    'gh variable set DEPLOY_ENV --body production',
    'gh auth refresh',
    'gh alias set unsafe "repo delete"',
    'gh config set prompt disabled',
    'gh ssh-key add public-key.pub',
    'gh api --method DELETE repos/acme/example/issues/42',
    'gh api -XPATCH repos/acme/example -f visibility=public',
    'gh api repos/acme/example/issues/42 -f title=Changed',
    'gh api graphql -f query=mutation',
  ]) assert.ok(command(value), value);
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
  for (const value of [
    'rg token .env.local',
    "grep --include='.env.local' token .",
    'grep token src/private.pem',
    'echo safe > .env.local',
    'node -e "require(\'fs\').readFileSync(\'.env\')"',
  ]) assert.ok(command(value), value);
  assert.equal(command('Get-Content .env.example'), null);
  assert.equal(command('env NODE_ENV=test node app.mjs'), null);
  assert.equal(command('Get-Item Env:NODE_ENV'), null);
  for (const value of [
    "rg -n '\\.env|private\\.pem' components tests",
    "grep -R '.env.local' components",
    "grep --exclude='.env.local' token .",
    "echo '.env.local'",
    "Write-Output '.env.local'",
  ]) assert.equal(command(value), null, value);
});

test('adversarial quoting cannot stall the guard', () => {
  // The quoted-word branch must stay unambiguous: an escape alternative that also
  // matches the negated class backtracks exponentially on unterminated input, which
  // would let a padded command outlive the hook timeout instead of being judged.
  const padded = `git reset --hard "${'\\!'.repeat(28)}`;
  const start = performance.now();
  const reason = command(padded);
  assert.ok(performance.now() - start < 300);
  assert.ok(reason);
});

test('malformed and empty hook input fail closed', () => {
  for (const input of ['not-json', '', '{}', 'null', '{"tool_input":"git status"}', '{"arguments":[]}']) assert.ok(parseHookInput(input).reason);
  assert.deepEqual(parseHookInput('{"tool_input":{"command":"git status"}}'), {
    input: { tool_input: { command: 'git status' } },
  });
});
