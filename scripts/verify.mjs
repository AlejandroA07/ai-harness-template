import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, label) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [path.join(root, 'tests', 'run.mjs')], 'Node tests');
run('git', ['diff', '--check'], 'Whitespace check');
run('gitleaks', ['git', '--redact', '-v'], 'Gitleaks full-history scan');
// Scan the whole tree, not just this repository's own workflows: project/ holds
// the workflows and Dependabot config shipped into every bootstrapped project,
// and CI audits them the same way.
run('zizmor', ['.'], 'GitHub Actions security');

const jsonFiles = [
  'skills/invocation-policy.json', 'global/claude-settings.json',
  'project/.claude/settings.json', 'project/.codex/hooks.json',
];
for (const relative of jsonFiles) JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));

const sourceFiles = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.generated') continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(child);
    else sourceFiles.push(child);
  }
}
await walk(root);
for (const file of sourceFiles.filter((file) => file.endsWith('.mjs'))) run(process.execPath, ['--check', file], `Syntax ${path.relative(root, file)}`);

console.log('\nHarness verification passed.');
