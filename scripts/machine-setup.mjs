import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deniedClaudeBuiltInTools } from '../components/claude-tool-policy.mjs';
import { mergeUnique, replaceHarnessHook } from './config-merge.mjs';

const apply = process.argv.includes('--apply');
const replaceGuidance = process.argv.includes('--replace-guidance');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();

function run(command, args) {
  if (process.platform === 'win32' && command === 'codex') {
    return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', ['codex', ...args].join(' ')], { encoding: 'utf8', cwd: root });
  }
  return spawnSync(command, args, { encoding: 'utf8', cwd: root });
}

const tools = [
  { command: 'node', args: ['--version'], required: true },
  { command: 'git', args: ['--version'], required: true },
  { command: 'gh', args: ['--version'], required: true },
  { command: 'claude', args: ['--version'], required: true },
  { command: 'codex', args: ['--version'], required: true },
  { command: 'gitleaks', args: ['version'], required: true },
  { command: 'zizmor', args: ['--version'], required: true },
  { command: 'dotnet', args: ['--version'], required: false },
  { command: 'docker', args: ['--version'], required: false },
];

let missingRequired = false;
console.log(`Machine setup ${apply ? 'APPLY' : 'DRY RUN'}\n`);
for (const tool of tools) {
  const result = run(tool.command, tool.args);
  const available = !result.error && result.status === 0;
  console.log(`${available ? 'FOUND' : tool.required ? 'MISSING' : 'OPTIONAL'} ${tool.command}${available ? `: ${(result.stdout || result.stderr).split(/\r?\n/)[0]}` : ''}`);
  if (!available && tool.required) missingRequired = true;
}
if (missingRequired) {
  console.error('\nInstall the missing required tools, then rerun. No changes were made.');
  process.exit(1);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot safely merge invalid JSON at ${filePath}: ${error.message}`);
  }
}

const guidance = [
  { source: path.join(root, 'global', 'CLAUDE.md'), target: path.join(home, '.claude', 'CLAUDE.md') },
  { source: path.join(root, 'global', 'AGENTS.md'), target: path.join(home, '.codex', 'AGENTS.md') },
];
const conflicts = [];
for (const item of guidance) {
  const expected = (await fs.readFile(item.source, 'utf8')).replaceAll('{{HARNESS_ROOT}}', root);
  let actual = null;
  try { actual = await fs.readFile(item.target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (actual !== null && actual !== expected && !replaceGuidance) conflicts.push(item.target);
  item.expected = expected;
}
if (conflicts.length) {
  console.error('\nGuidance differs at:');
  for (const conflict of conflicts) console.error(`- ${conflict}`);
  if (apply && !replaceGuidance) {
    console.error('Review it, then rerun with --apply --replace-guidance to make the harness canonical.');
    process.exit(1);
  }
  if (!apply) console.error('Dry run only: applying this plan requires --replace-guidance.');
}

const claudeSettingsPath = path.join(home, '.claude', 'settings.json');
const claudeSettings = await readJson(claudeSettingsPath);
const claudeTemplate = JSON.parse((await fs.readFile(path.join(root, 'global', 'claude-settings.json'), 'utf8')).replaceAll('{{HARNESS_ROOT}}', root.replaceAll('\\', '/')));
claudeSettings.includeCoAuthoredBy = false;
claudeSettings.autoMemoryEnabled = false;
claudeSettings.permissions ??= {};
claudeSettings.permissions.deny = mergeUnique(
  claudeSettings.permissions.deny,
  [...claudeTemplate.permissions.deny, ...deniedClaudeBuiltInTools],
);
claudeSettings.permissions.disableBypassPermissionsMode = 'disable';
claudeSettings.hooks ??= {};
claudeSettings.hooks.PreToolUse = replaceHarnessHook(claudeSettings.hooks.PreToolUse, claudeTemplate.hooks.PreToolUse[0]);

const codexHooksPath = path.join(home, '.codex', 'hooks.json');
const codexHooks = await readJson(codexHooksPath);
const codexTemplateText = (await fs.readFile(path.join(root, 'global', 'codex-hooks', 'hooks.json.template'), 'utf8'))
  .replaceAll('{{HARNESS_ROOT}}', root.replaceAll('\\', '/'))
  .replaceAll('{{HARNESS_ROOT_WINDOWS}}', root.replaceAll('\\', '\\\\'));
const codexTemplate = JSON.parse(codexTemplateText);
codexHooks.description ??= 'User lifecycle hooks.';
codexHooks.hooks ??= {};
codexHooks.hooks.PreToolUse = replaceHarnessHook(codexHooks.hooks.PreToolUse, codexTemplate.hooks.PreToolUse[0]);

const planned = [
  ...guidance.map((item) => item.target),
  claudeSettingsPath,
  codexHooksPath,
  path.join(home, '.claude', 'skills'),
  path.join(home, '.agents', 'skills'),
  `${root} -> git core.hooksPath=.githooks`,
  'Codex memories -> disabled',
  'Claude auto-memory environment lock -> enabled',
];
for (const item of planned) console.log(`${apply ? 'APPLY' : 'WOULD APPLY'} ${item}`);
if (!apply) {
  console.log('\nDry run complete. Rerun with --apply after reviewing the plan.');
  process.exit(0);
}

for (const item of guidance) {
  await fs.mkdir(path.dirname(item.target), { recursive: true });
  await fs.writeFile(item.target, item.expected);
}
await fs.mkdir(path.dirname(claudeSettingsPath), { recursive: true });
await fs.writeFile(claudeSettingsPath, `${JSON.stringify(claudeSettings, null, 2)}\n`);
await fs.mkdir(path.dirname(codexHooksPath), { recursive: true });
await fs.writeFile(codexHooksPath, `${JSON.stringify(codexHooks, null, 2)}\n`);

const disableMemories = run('codex', ['features', 'disable', 'memories']);
if (disableMemories.status !== 0) throw new Error(disableMemories.stderr || 'Failed to disable Codex memories');

if (process.platform === 'win32') {
  const lockMemory = run('setx', ['CLAUDE_CODE_DISABLE_AUTO_MEMORY', '1']);
  if (lockMemory.status !== 0) throw new Error(lockMemory.stderr || 'Failed to set Claude auto-memory environment lock');
} else {
  console.log('NOTE Set CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 in your login environment for a machine-level Claude lock.');
}

const hooksPath = run('git', ['config', 'core.hooksPath', '.githooks']);
if (hooksPath.status !== 0) throw new Error(hooksPath.stderr || 'Failed to enable template Git hooks');

const sync = run(process.execPath, [path.join(root, 'scripts', 'sync-skills.mjs'), '--apply']);
process.stdout.write(sync.stdout ?? '');
process.stderr.write(sync.stderr ?? '');
if (sync.status !== 0) process.exit(sync.status ?? 1);

console.log('\nMachine setup applied. Open Codex and run /hooks once to review and trust the generated user hook definition.');
