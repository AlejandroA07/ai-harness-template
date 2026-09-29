import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { isSecretBearingCommitPath } from './secret-policy.mjs';

function git(args, options = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `git ${args.join(' ')} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
if (process.platform === 'win32') {
  const stagedHooks = ['.githooks/pre-commit', '.githooks/commit-msg'].filter((filePath) => staged.includes(filePath) && existsSync(filePath));
  if (stagedHooks.length > 0) git(['update-index', '--chmod=+x', '--', ...stagedHooks]);
}
const secretPath = staged.find(isSecretBearingCommitPath);
if (secretPath) {
  console.error(`[pre-commit] Secret-bearing path cannot be committed: ${secretPath}`);
  process.exit(1);
}

const gitleaks = spawnSync('gitleaks', ['git', '--pre-commit', '--staged', '--redact', '-v'], { stdio: 'inherit' });
if (gitleaks.error?.code === 'ENOENT') {
  console.error('[pre-commit] gitleaks is required; the hook fails closed when it is unavailable.');
  process.exit(1);
}
if (gitleaks.status !== 0) process.exit(gitleaks.status ?? 1);
