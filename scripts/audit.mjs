import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverSkills, readInvocationPolicy } from './skill-lib.mjs';

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

async function checkTemplate() {
  const required = [
    'README.md', 'MACHINE-SETUP.md', 'BOOTSTRAP.md', 'TOKEN-COSTS.md',
    'scripts/machine-setup.mjs', 'scripts/bootstrap.mjs', 'scripts/verify.mjs',
    'components/guard-git.mjs', 'skills/invocation-policy.json',
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
  const claudeSettingsPath = path.join(home, '.claude', 'settings.json');
  try {
    const settings = JSON.parse(await fs.readFile(claudeSettingsPath, 'utf8'));
    settings.autoMemoryEnabled === false ? pass('Claude auto-memory disabled') : fail('Claude auto-memory is not disabled');
    settings.includeCoAuthoredBy === false ? pass('Claude attribution disabled') : fail('Claude attribution setting is not disabled');
    const hookText = JSON.stringify(settings.hooks ?? {});
    hookText.includes('guard-git.mjs') ? pass('Claude machine guard configured') : fail('Claude machine guard missing');
  } catch (error) { fail(`cannot audit Claude settings: ${error.message}`); }

  if (process.platform === 'win32') {
    const memoryLock = spawnSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('CLAUDE_CODE_DISABLE_AUTO_MEMORY','User')"], { encoding: 'utf8' });
    memoryLock.status === 0 && memoryLock.stdout.trim() === '1' ? pass('Claude machine auto-memory lock enabled') : fail('Claude machine auto-memory lock missing');
  } else {
    warn('Claude environment-level auto-memory lock is not audited on this OS');
  }

  try {
    const hooks = JSON.parse(await fs.readFile(path.join(home, '.codex', 'hooks.json'), 'utf8'));
    JSON.stringify(hooks).includes('guard-git.mjs') ? pass('Codex machine guard configured') : fail('Codex machine guard missing');
    warn('Codex hook trust is interactive; confirm it with /hooks after changes');
  } catch (error) { fail(`cannot audit Codex hooks: ${error.message}`); }

  const features = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'codex features list'], { encoding: 'utf8' })
    : spawnSync('codex', ['features', 'list'], { encoding: 'utf8' });
  if (features.status === 0 && /^memories\s+.*\sfalse$/m.test(features.stdout)) pass('Codex memories disabled');
  else fail('Codex memories are not verifiably disabled');

  for (const [platform, directory] of [['Claude', path.join(home, '.claude', 'skills')], ['Codex', path.join(home, '.agents', 'skills')]]) {
    for (const skill of await discoverSkills(path.join(root, 'skills'))) {
      const target = path.join(directory, skill.name);
      try {
        const stat = await fs.lstat(target);
        stat.isSymbolicLink() ? pass(`${platform} skill linked: ${skill.name}`) : fail(`${platform} skill is not a managed link: ${skill.name}`);
      } catch { fail(`${platform} skill missing: ${skill.name}`); }
    }
  }
}

async function checkProject(project) {
  for (const relative of ['AGENTS.md', 'CLAUDE.md', 'scripts/verify.mjs', '.githooks/pre-commit', '.githooks/commit-msg', '.harness/hooks/guard-git.mjs']) {
    await exists(path.join(project, relative)) ? pass(`project has ${relative}`) : fail(`project missing ${relative}`);
  }
  const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: project, encoding: 'utf8' });
  hooksPath.status === 0 && hooksPath.stdout.trim() === '.githooks' ? pass('project core.hooksPath is active') : fail('project core.hooksPath is not .githooks');

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
