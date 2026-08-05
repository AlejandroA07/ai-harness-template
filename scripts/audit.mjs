import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deniedClaudeBuiltInTools, obsoleteHarnessClaudeDenials } from '../components/claude-tool-policy.mjs';
import { discoverSkills, inspectManagedSkillLink, readInvocationPolicy } from './skill-lib.mjs';
import { runTool } from './windows-cli.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectIndex = process.argv.indexOf('--project');
const projectRoot = projectIndex === -1 ? null : path.resolve(process.argv[projectIndex + 1] ?? '');
let failures = 0;
let warnings = 0;

function pass(message) { console.log(`PASS ${message}`); }
function fail(message) { failures += 1; console.error(`FAIL ${message}`); }
function warn(message) { warnings += 1; console.warn(`WARN ${message}`); }

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function findMarkdownFiles(directory) {
  if (!(await exists(directory))) return [];
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findMarkdownFiles(child));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(child);
  }
  return files;
}

async function checkTemplate() {
  const required = [
    'README.md', 'MACHINE-SETUP.md', 'BOOTSTRAP.md', 'TOKEN-COSTS.md',
    'scripts/machine-setup.mjs', 'scripts/bootstrap.mjs', 'scripts/verify.mjs',
    'components/guard-git.mjs', 'components/claude-tool-policy.mjs', 'skills/invocation-policy.json',
  ];
  for (const relative of required) {
    if (await exists(path.join(root, relative))) pass(`template has ${relative}`);
    else fail(`template missing ${relative}`);
  }

  const retired = ['projects', 'global/skills/wrap-branch', 'global/skills/grill', 'project/.claude/goals', 'project/.mcp.json'];
  for (const relative of retired) {
    if (await exists(path.join(root, relative))) fail(`retired path remains active: ${relative}`);
    else pass(`retired path absent: ${relative}`);
  }

  const skills = await discoverSkills(path.join(root, 'skills'));
  const policy = await readInvocationPolicy(path.join(root, 'skills'));
  const names = new Set(skills.map((skill) => skill.name));
  if (skills.length === 19) pass('canonical skill inventory has 19 skills');
  else fail(`canonical skill inventory has ${skills.length}, expected 19`);
  for (const name of policy) if (!names.has(name)) fail(`invocation policy references missing skill: ${name}`);

  const forbidden = /(?:ready-for-agent|writing-great-skills|resolving-merge-conflicts)/i;
  for (const skill of skills) {
    const text = await fs.readFile(path.join(skill.directory, 'SKILL.md'), 'utf8');
    if (forbidden.test(text)) fail(`retired workflow reference in ${skill.name}`);
  }
}

async function checkMachine() {
  const home = os.homedir();
  const customAgents = await findMarkdownFiles(path.join(home, '.claude', 'agents'));
  customAgents.length === 0
    ? pass('Claude custom-agent discovery directory is empty')
    : fail(`Claude custom-agent discovery contains ${customAgents.length} file(s); use built-in agents and harness skills instead`);
  const claudeSettingsPath = path.join(home, '.claude', 'settings.json');
  try {
    const settings = JSON.parse(await fs.readFile(claudeSettingsPath, 'utf8'));
    settings.autoMemoryEnabled === false ? pass('Claude auto-memory disabled') : fail('Claude auto-memory is not disabled');
    settings.includeCoAuthoredBy === false ? pass('Claude attribution disabled') : fail('Claude attribution setting is not disabled');
    const hookText = JSON.stringify(settings.hooks ?? {});
    hookText.includes('guard-git.mjs') ? pass('Claude machine guard configured') : fail('Claude machine guard missing');
    hookText.includes('PowerShell') ? pass('Claude machine guard covers PowerShell') : fail('Claude machine guard does not cover PowerShell');
    const denied = new Set(settings.permissions?.deny ?? []);
    const missingToolDenials = deniedClaudeBuiltInTools.filter((tool) => !denied.has(tool));
    missingToolDenials.length === 0
      ? pass(`Claude optional built-in tools disabled: ${deniedClaudeBuiltInTools.length}`)
      : fail(`Claude optional built-in tools remain enabled: ${missingToolDenials.join(', ')}`);
    for (const shell of ['Bash', 'PowerShell']) {
      denied.has(shell) ? fail(`Claude required shell is disabled: ${shell}`) : pass(`Claude required shell remains available: ${shell}`);
    }
    for (const obsolete of obsoleteHarnessClaudeDenials) {
      denied.has(obsolete) ? fail(`Claude settings retain obsolete harness denial: ${obsolete}`) : pass(`Claude obsolete harness denial absent: ${obsolete}`);
    }
  } catch (error) { fail(`cannot audit Claude settings: ${error.message}`); }

  if (process.platform === 'win32') {
    const memoryLock = spawnSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('CLAUDE_CODE_DISABLE_AUTO_MEMORY','User')"], { encoding: 'utf8' });
    if (memoryLock.error) fail(`cannot verify Claude machine auto-memory lock: ${memoryLock.error.message}`);
    else if (memoryLock.status !== 0) fail(`cannot verify Claude machine auto-memory lock: ${memoryLock.stderr.trim() || `exit ${memoryLock.status}`}`);
    else if (memoryLock.stdout.trim() === '1') pass('Claude machine auto-memory lock enabled');
    else fail('Claude machine auto-memory lock missing');
  } else {
    warn('Claude environment-level auto-memory lock is not audited on this OS');
  }

  try {
    const hooks = JSON.parse(await fs.readFile(path.join(home, '.codex', 'hooks.json'), 'utf8'));
    JSON.stringify(hooks).includes('guard-git.mjs') ? pass('Codex machine guard configured') : fail('Codex machine guard missing');
    warn('Codex hook trust is interactive; confirm it with /hooks after changes');
  } catch (error) { fail(`cannot audit Codex hooks: ${error.message}`); }

  const features = runTool('codex', ['features', 'list']);
  if (features.error) fail(`cannot verify Codex memories: ${features.error.message}`);
  else if (features.status !== 0) fail(`cannot verify Codex memories: ${features.stderr.trim() || `exit ${features.status}`}`);
  else if (/^memories\s+.*\sfalse$/m.test(features.stdout)) pass('Codex memories disabled');
  else fail('Codex memories are enabled or absent from the feature inventory');

  for (const [platform, directory] of [['Claude', path.join(home, '.claude', 'skills')], ['Codex', path.join(home, '.agents', 'skills')]]) {
    for (const skill of await discoverSkills(path.join(root, 'skills'))) {
      const target = path.join(directory, skill.name);
      const expected = path.join(root, '.generated', 'skills', platform.toLowerCase(), skill.name);
      try {
        const status = await inspectManagedSkillLink(target, expected);
        if (status === 'missing') fail(`${platform} skill missing: ${skill.name}`);
        else if (status === 'not-link') fail(`${platform} skill is not a managed link: ${skill.name}`);
        else if (status === 'unexpected') fail(`${platform} skill points to an unexpected target: ${skill.name}`);
        else if (status === 'broken') fail(`${platform} skill link is broken or incomplete: ${skill.name}`);
        else pass(`${platform} skill linked and resolved: ${skill.name}`);
      } catch (error) { fail(`${platform} skill link cannot be resolved: ${skill.name} (${error.message})`); }
    }
  }
}

async function checkProject(project) {
  for (const relative of ['AGENTS.md', 'CLAUDE.md', 'scripts/verify.mjs', '.githooks/pre-commit', '.githooks/commit-msg', '.harness/hooks/guard-git.mjs', '.harness/runtime/windows-cli.mjs']) {
    await exists(path.join(project, relative)) ? pass(`project has ${relative}`) : fail(`project missing ${relative}`);
  }
  const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: project, encoding: 'utf8' });
  hooksPath.status === 0 && hooksPath.stdout.trim() === '.githooks' ? pass('project core.hooksPath is active') : fail('project core.hooksPath is not .githooks');

  try {
    const settings = JSON.parse(await fs.readFile(path.join(project, '.claude', 'settings.json'), 'utf8'));
    const denied = new Set(settings.permissions?.deny ?? []);
    const missingToolDenials = deniedClaudeBuiltInTools.filter((tool) => !denied.has(tool));
    missingToolDenials.length === 0
      ? pass(`project disables ${deniedClaudeBuiltInTools.length} optional Claude tools`)
      : fail(`project leaves optional Claude tools enabled: ${missingToolDenials.join(', ')}`);
    JSON.stringify(settings.hooks ?? {}).includes('PowerShell')
      ? pass('project Claude guard covers PowerShell')
      : fail('project Claude guard does not cover PowerShell');
    for (const obsolete of obsoleteHarnessClaudeDenials) {
      denied.has(obsolete) ? fail(`project retains obsolete harness denial: ${obsolete}`) : pass(`project obsolete harness denial absent: ${obsolete}`);
    }
  } catch (error) { fail(`cannot audit project Claude settings: ${error.message}`); }

  if (await exists(path.join(project, '.harness', 'skills'))) {
    const check = spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-project-skills.mjs'), '--project', project, '--check'], { encoding: 'utf8' });
    check.status === 0 ? pass('project skill adapters are current') : fail(check.stderr || check.stdout || 'project skill adapters are stale');
  }
}

await checkTemplate();
if (projectRoot) await checkProject(projectRoot);
else await checkMachine();

console.log(`\nAudit complete: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exit(1);
