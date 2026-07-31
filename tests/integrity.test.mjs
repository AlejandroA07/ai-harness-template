import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('CI provisions the tools used by the full verification gate', async () => {
  const workflow = await read('.github/workflows/verify.yml');
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /GITLEAKS_VERSION:\s*"8\.30\.1"/);
  assert.match(workflow, /gitleaks_\$\{GITLEAKS_VERSION\}_linux_x64/);
  assert.match(workflow, /ZIZMOR_VERSION:\s*"1\.28\.0"/);
  assert.match(workflow, /zizmor==\$ZIZMOR_VERSION/);
});

test('the harness repository carries CodeQL and Dependabot', async () => {
  await fs.access(path.join(root, '.github', 'workflows', 'codeql.yml'));
  await fs.access(path.join(root, '.github', 'dependabot.yml'));
});

test('active template text is portable and has no retired source attribution', async () => {
  const readme = await read('README.md');
  const audit = await read('scripts/audit.mjs');
  const retiredNames = [`ask-${'ma'}${'tt'}`, `setup-${'ma'}${'tt'}`];
  assert.doesNotMatch(readme, /[A-Z]:\\Users\\/i);
  for (const name of retiredNames) assert.equal(audit.toLowerCase().includes(name), false);
});

test('code-review has no missing issue-tracker reference', async () => {
  const skill = await read('skills/engineering/code-review/SKILL.md');
  assert.doesNotMatch(skill, /docs\/agents\/issue-tracker\.md/);
});

test('GitHub hosting requires a working remote or explicit override', async () => {
  const bootstrap = await read('scripts/bootstrap.mjs');
  assert.doesNotMatch(bootstrap, /hasGithubDirectory/);
  assert.match(bootstrap, /githubOverride\s*\|\|\s*ghCheck\.status\s*===\s*0/);
});

test('generated verification resolves package-manager shims on Windows', async () => {
  const template = await read('project/scripts/verify.mjs.template');
  assert.match(template, /process\.platform\s*===\s*'win32'/);
  assert.match(template, /`\$\{step\.command\}\.cmd`/);
  assert.match(template, /process\.env\.ComSpec/);
  assert.match(template, /\['\/d', '\/s', '\/c'/);
});

test('Windows bootstrap commits normalize Git hook executable modes', async () => {
  const preCommit = await read('components/pre-commit.mjs');
  assert.match(preCommit, /update-index/);
  assert.match(preCommit, /--chmod=\+x/);
});

test('machine audit rejects custom Claude agents', async () => {
  const audit = await read('scripts/audit.mjs');
  assert.match(audit, /\.claude', 'agents'/);
  assert.match(audit, /custom-agent discovery contains/);
});
