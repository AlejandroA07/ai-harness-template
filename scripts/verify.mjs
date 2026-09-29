import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { runVerification } from './verification-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonFiles = [
  'skills/invocation-policy.json', 'catalog/integrations.json', 'catalog/token-measurements.json', 'global/claude-settings.json',
];

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

const steps = [
  { name: 'Whitespace', command: 'git', args: ['diff', '--check'] },
  ...jsonFiles.map((relative) => ({
    name: `JSON ${relative}`,
    check() { return JSON.parse(readFileSync(path.join(root, relative), 'utf8')); },
  })),
  ...sourceFiles.filter((file) => file.endsWith('.mjs')).map((file) => ({
    name: `Syntax ${path.relative(root, file)}`,
    command: process.execPath,
    args: ['--check', file],
  })),
  { name: 'Node tests', command: process.execPath, args: [path.join(root, 'tests', 'run.mjs')] },
  { name: 'Gitleaks full-history scan', command: 'gitleaks', args: ['git', '--redact', '-v'] },
  // Scan the whole tree, not just this repository's own workflows: project/
  // contains workflows and Dependabot configuration shipped to projects.
  { name: 'GitHub Actions security', command: 'zizmor', args: ['.'] },
];

const result = runVerification({
  steps,
  execute(step, { timeoutMs }) {
    if (step.check) {
      try {
        step.check();
        return { status: 0, stdout: '', stderr: '' };
      } catch (error) {
        return { status: 1, stdout: '', stderr: `${error.name}: ${error.message}\n` };
      }
    }
    return spawnSync(step.command, step.args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      shell: false,
      timeout: timeoutMs,
    });
  },
});
process.exitCode = result.status;
