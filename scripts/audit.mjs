import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeSecretDenials } from '../components/secret-policy.mjs';
import { discoverSkills, inspectManagedSkillLink, readInvocationPolicy } from './skill-lib.mjs';
import { hasHarnessHook } from './config-merge.mjs';
import { loadClaudeToolConfig } from './claude-dev.mjs';
import { retiredHarnessClaudeDenials } from './retired-claude-denials.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length !== 2) {
  console.error('Usage: node scripts/audit.mjs');
  process.exit(2);
}
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
    'scripts/machine-setup.mjs', 'scripts/bootstrap.mjs', 'scripts/verify.mjs', 'scripts/verification-runner.mjs',
    'components/guard-git.mjs', 'global/claude-tools.json', 'scripts/claude-dev.mjs', 'skills/invocation-policy.json',
    'skills/upstream-sources.json', 'scripts/upstream-skills.mjs',
  ];
  for (const relative of required) {
    if (await exists(path.join(root, relative))) pass(`template has ${relative}`);
    else fail(`template missing ${relative}`);
  }
  try {
    const config = await loadClaudeToolConfig(path.join(root, 'global', 'claude-tools.json'));
    config.tools.includes('Read') && config.tools.includes('Write') && config.tools.includes('Bash')
      ? pass(`Claude developer launcher exposes ${config.tools.length} configured tools`)
      : fail('Claude developer launcher is missing required coding tools');
  } catch (error) { fail(`Claude developer tool configuration is invalid: ${error.message}`); }

  const retired = ['projects', 'global/skills/wrap-branch', 'global/skills/grill', 'project/.claude/goals', 'project/.mcp.json'];
  for (const relative of retired) {
    if (await exists(path.join(root, relative))) fail(`retired path remains active: ${relative}`);
    else pass(`retired path absent: ${relative}`);
  }

  const skills = await discoverSkills(path.join(root, 'skills'));
  const policy = await readInvocationPolicy(path.join(root, 'skills'));
  const ownership = JSON.parse(await fs.readFile(path.join(root, 'skills', 'upstream-sources.json'), 'utf8'));
  const names = new Set(skills.map((skill) => skill.name));
  if (skills.length === 22) pass('canonical skill inventory has 22 skills');
  else fail(`canonical skill inventory has ${skills.length}, expected 22`);
  if (Object.keys(ownership.skills).length === skills.length) pass('upstream ownership covers every canonical skill');
  else fail('upstream ownership count does not match canonical skill inventory');
  for (const name of names) if (!ownership.skills[name]) fail(`skill has no upstream ownership mode: ${name}`);
  for (const name of policy) if (!names.has(name)) fail(`invocation policy references missing skill: ${name}`);

  const forbidden = /(?:setup-matt-pocock-skills|resolving-merge-conflicts|\btriage\b|\bwizard\b)/i;
  for (const skill of skills) {
    const text = await fs.readFile(path.join(skill.directory, 'SKILL.md'), 'utf8');
    if (forbidden.test(text)) fail(`retired workflow reference in ${skill.name}`);
  }
}

async function checkMachine() {
  const home = os.homedir();
  const claudeTemplate = JSON.parse((await fs.readFile(path.join(root, 'global', 'claude-settings.json'), 'utf8'))
    .replaceAll('{{HARNESS_ROOT}}', root.replaceAll('\\', '/')));
  const codexTemplate = JSON.parse((await fs.readFile(path.join(root, 'global', 'codex-hooks', 'hooks.json.template'), 'utf8'))
    .replaceAll('{{HARNESS_ROOT}}', root.replaceAll('\\', '/'))
    .replaceAll('{{HARNESS_ROOT_WINDOWS}}', root.replaceAll('\\', '\\\\')));
  const customAgents = await findMarkdownFiles(path.join(home, '.claude', 'agents'));
  customAgents.length === 0
    ? pass('Claude custom-agent discovery directory is empty')
    : fail(`Claude custom-agent discovery contains ${customAgents.length} file(s); use built-in agents and harness skills instead`);
  const claudeSettingsPath = path.join(home, '.claude', 'settings.json');
  try {
    const settings = JSON.parse(await fs.readFile(claudeSettingsPath, 'utf8'));
    settings.includeCoAuthoredBy === false ? pass('Claude attribution disabled') : fail('Claude attribution setting is not disabled');
    hasHarnessHook(settings.hooks?.PreToolUse, claudeTemplate.hooks.PreToolUse[0])
      ? pass('Claude machine guard configured with shell and read coverage') : fail('Claude machine guard missing or modified');
    const denied = new Set(settings.permissions?.deny ?? []);
    const missingSecretDenials = claudeSecretDenials('machine').filter((entry) => !denied.has(entry));
    missingSecretDenials.length === 0
      ? pass(`Claude secret paths denied: ${claudeSecretDenials('machine').length}`)
      : fail(`Claude secret-path denials are missing: ${missingSecretDenials.join(', ')}`);
    for (const shell of ['Bash', 'PowerShell']) {
      denied.has(shell) ? fail(`Claude required shell is disabled: ${shell}`) : pass(`Claude required shell remains available: ${shell}`);
    }
    for (const obsolete of retiredHarnessClaudeDenials) {
      denied.has(obsolete) ? fail(`Claude settings retain obsolete harness denial: ${obsolete}`) : pass(`Claude obsolete harness denial absent: ${obsolete}`);
    }
  } catch (error) { fail(`cannot audit Claude settings: ${error.message}`); }

  try {
    const hooks = JSON.parse(await fs.readFile(path.join(home, '.codex', 'hooks.json'), 'utf8'));
    hasHarnessHook(hooks.hooks?.PreToolUse, codexTemplate.hooks.PreToolUse[0])
      ? pass('Codex machine guard configured') : fail('Codex machine guard missing or modified');
    warn('Codex hook trust is interactive; confirm it with /hooks after changes');
  } catch (error) { fail(`cannot audit Codex hooks: ${error.message}`); }

  const canonicalSkills = await discoverSkills(path.join(root, 'skills'));
  const canonicalNames = new Set(canonicalSkills.map((skill) => skill.name));
  for (const [platform, directory] of [['Claude', path.join(home, '.claude', 'skills')], ['Codex', path.join(home, '.agents', 'skills')]]) {
    let rootStat;
    try { rootStat = await fs.lstat(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      fail(`${platform} skill root is missing or is not a real directory: ${directory}`);
      continue;
    }
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
      if (!canonicalNames.has(entry.name)) fail(`${platform} skill inventory contains noncanonical entry: ${entry.name}`);
    }
    for (const skill of canonicalSkills) {
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

await checkTemplate();
await checkMachine();

console.log(`\nAudit complete: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exit(1);
