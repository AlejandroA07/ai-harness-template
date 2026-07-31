import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deniedClaudeBuiltInTools, obsoleteHarnessClaudeDenials } from '../components/claude-tool-policy.mjs';
import { reconcileHarnessDenials, replaceHarnessHook } from './config-merge.mjs';
import { buildVerificationSteps } from './project-verification.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const githubOverride = args.includes('--github');
const targetArg = args.find((arg) => !arg.startsWith('--'));
if (!targetArg) {
  console.error('Usage: node scripts/bootstrap.mjs <project-path> [--github] [--apply]');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.resolve(targetArg);
const excludedDirectories = new Set(['.git', 'node_modules', 'bin', 'obj', '.next', 'dist', 'coverage']);

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

if (!(await exists(project))) throw new Error(`Project path does not exist: ${project}`);

async function findFiles(directory, depth = 0) {
  if (depth > 3) return [];
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) files.push(...await findFiles(path.join(directory, entry.name), depth + 1));
    else if (entry.isFile()) files.push(path.join(directory, entry.name));
  }
  return files;
}

const files = await findFiles(project);
const relativeFiles = files.map((file) => path.relative(project, file).replaceAll('\\', '/'));
const csProjects = relativeFiles.filter((file) => file.endsWith('.csproj'));
const hasDotnet = csProjects.length > 0 || relativeFiles.some((file) => /\.(?:sln|slnx)$/.test(file));
const packageJsonPath = path.join(project, 'package.json');
const hasNode = await exists(packageJsonPath);
let packageJson = {};
if (hasNode) packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
const hasUi = ['react', 'next', 'vue', 'svelte', '@angular/core'].some((name) => dependencies[name]);
const hasGlobalJson = await exists(path.join(project, 'global.json'));
const hasDocker = relativeFiles.some((file) => /(^|\/)Dockerfile(?:\.|$)/i.test(file));
const ghCheck = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd: project, encoding: 'utf8' });
const isGithub = githubOverride || ghCheck.status === 0;

function recommendation(label, state, reason, trigger) {
  console.log(`${state} ${label}: ${reason}`);
  if (trigger) console.log(`  Re-evaluate when: ${trigger}`);
}

console.log(`Bootstrap ${apply ? 'APPLY' : 'DRY RUN'} for ${project}\n`);
recommendation('base harness', 'RECOMMENDED', 'portable guidance, verification interface, hooks, and guards');
recommendation('GitHub CI', isGithub ? 'RECOMMENDED' : 'NOT CURRENTLY', isGithub ? 'GitHub project detected' : 'no GitHub project detected', 'the project is hosted on GitHub');
recommendation('Context7 MCP', 'NOT CURRENTLY', 'only useful when work repeatedly needs current third-party documentation', 'the project depends on fast-moving external APIs or frameworks');
recommendation('Playwright MCP', hasUi ? 'RECOMMENDED' : 'NOT CURRENTLY', hasUi ? 'UI framework detected' : 'no browser UI detected', 'the project gains a browser-driven UI');
recommendation('.NET analyzer tightening', hasDotnet ? 'RECOMMENDED' : 'NOT CURRENTLY', hasDotnet ? 'review built-in analyzers and current Sonar rules; ratchet legacy warnings' : 'no .NET project detected');
recommendation('architecture tests', csProjects.length >= 3 ? 'RECOMMENDED' : 'NOT CURRENTLY', csProjects.length >= 3 ? 'several .NET projects may represent real dependency boundaries' : 'no stable multi-module boundary detected', 'a boundary becomes important and repeatedly violated');
recommendation('mutation testing', 'NOT CURRENTLY', 'reserve it for mature, high-risk test suites', 'critical logic has a stable suite whose fault-detection strength matters');

const componentFiles = ['guard-policy.mjs', 'guard-git.mjs', 'attribution-policy.mjs', 'check-attribution.mjs', 'pre-commit.mjs'];
const planned = [
  'AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.codex/hooks.json',
  '.githooks/pre-commit', '.githooks/commit-msg', 'scripts/verify.mjs',
  '.gitleaks.toml', '.gitignore harness block', 'git core.hooksPath=.githooks',
  ...componentFiles.map((file) => `.harness/hooks/${file}`),
];
if (isGithub) planned.push('.github/workflows/verify.yml', '.github/workflows/harness-security.yml', '.github/dependabot.yml');
if (isGithub && (hasNode || (hasDotnet && hasGlobalJson))) planned.push('.github/workflows/codeql.yml');
if (isGithub && hasDotnet && !hasGlobalJson) console.log('BLOCKED CodeQL for C#: add and review a pinned global.json first.');
for (const item of planned) console.log(`${apply ? 'APPLY' : 'WOULD APPLY'} ${item}`);

if (!apply) {
  console.log('\nDry run complete. The agent must still tailor AGENTS.md, verification, architecture, and conditional recommendations from project evidence.');
  process.exit(0);
}

async function copyIfMissing(source, destination) {
  if (await exists(destination)) return false;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  return true;
}

async function copyAlways(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function readJson(filePath) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error(`Cannot safely merge invalid JSON at ${filePath}: ${error.message}`); }
}

await copyIfMissing(path.join(root, 'project', 'AGENTS.md.template'), path.join(project, 'AGENTS.md'));
await copyIfMissing(path.join(root, 'project', 'CLAUDE.md'), path.join(project, 'CLAUDE.md'));
const projectClaudePath = path.join(project, '.claude', 'settings.json');
const projectClaude = await readJson(projectClaudePath);
const claudeTemplate = await readJson(path.join(root, 'project', '.claude', 'settings.json'));
projectClaude.$schema ??= claudeTemplate.$schema;
projectClaude.includeCoAuthoredBy = false;
projectClaude.autoMemoryEnabled = false;
projectClaude.permissions ??= {};
projectClaude.permissions.deny = reconcileHarnessDenials(
  projectClaude.permissions.deny,
  [...claudeTemplate.permissions.deny, ...deniedClaudeBuiltInTools],
  obsoleteHarnessClaudeDenials,
);
projectClaude.hooks ??= {};
projectClaude.hooks.PreToolUse = replaceHarnessHook(projectClaude.hooks.PreToolUse, claudeTemplate.hooks.PreToolUse[0]);
await fs.mkdir(path.dirname(projectClaudePath), { recursive: true });
await fs.writeFile(projectClaudePath, `${JSON.stringify(projectClaude, null, 2)}\n`);

const projectCodexPath = path.join(project, '.codex', 'hooks.json');
const projectCodex = await readJson(projectCodexPath);
const codexTemplate = await readJson(path.join(root, 'project', '.codex', 'hooks.json'));
projectCodex.description ??= codexTemplate.description;
projectCodex.hooks ??= {};
projectCodex.hooks.PreToolUse = replaceHarnessHook(projectCodex.hooks.PreToolUse, codexTemplate.hooks.PreToolUse[0]);
await fs.mkdir(path.dirname(projectCodexPath), { recursive: true });
await fs.writeFile(projectCodexPath, `${JSON.stringify(projectCodex, null, 2)}\n`);
await copyAlways(path.join(root, 'project', '.githooks', 'pre-commit'), path.join(project, '.githooks', 'pre-commit'));
await copyAlways(path.join(root, 'project', '.githooks', 'commit-msg'), path.join(project, '.githooks', 'commit-msg'));
await copyAlways(path.join(root, 'project', '.gitleaks.toml'), path.join(project, '.gitleaks.toml'));
for (const file of componentFiles) await copyAlways(path.join(root, 'components', file), path.join(project, '.harness', 'hooks', file));

const verifySteps = buildVerificationSteps({ hasDotnet, hasNode, isGithub, packageJson, relativeFiles });
const verifyTemplate = await fs.readFile(path.join(root, 'project', 'scripts', 'verify.mjs.template'), 'utf8');
const verifyText = verifyTemplate.replace('__VERIFY_STEPS__', JSON.stringify(verifySteps, null, 2));
if (!(await exists(path.join(project, 'scripts', 'verify.mjs')))) {
  await fs.mkdir(path.join(project, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(project, 'scripts', 'verify.mjs'), verifyText);
}

const gitignorePath = path.join(project, '.gitignore');
let gitignore = '';
try { gitignore = await fs.readFile(gitignorePath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const marker = '# Local harness state';
if (!gitignore.includes(marker)) {
  const block = `${marker}\n.scratch/\n.claude/settings.local.json\n.harness/tmp/\n\n# Secret-bearing local files\n.env\n.env.*\n!.env.example\n!.env.sample\n!.env.template\n*.pem\n*.key\n*.p12\n*.pfx\n`;
  await fs.writeFile(gitignorePath, `${gitignore}${gitignore && !gitignore.endsWith('\n') ? '\n' : ''}${block}`);
}

const hookConfig = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: project, encoding: 'utf8' });
if (hookConfig.status !== 0) throw new Error(hookConfig.stderr || 'Failed to configure core.hooksPath');

if (await exists(path.join(project, '.harness', 'skills'))) {
  const generated = spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-project-skills.mjs'), '--project', project], { encoding: 'utf8' });
  if (generated.status !== 0) throw new Error(generated.stderr || generated.stdout);
}

if (isGithub) {
  await fs.mkdir(path.join(project, '.github', 'workflows'), { recursive: true });
  await copyAlways(path.join(root, 'project', '.github', 'workflows', 'verify.yml'), path.join(project, '.github', 'workflows', 'verify.yml'));
  await copyAlways(path.join(root, 'project', '.github', 'workflows', 'harness-security.yml'), path.join(project, '.github', 'workflows', 'harness-security.yml'));
  const ecosystem = (name, extra = '') => `  - package-ecosystem: ${name}\n    directory: /\n    schedule:\n      interval: weekly\n${extra}`;
  const ecosystems = [ecosystem('github-actions')];
  if (hasNode) ecosystems.unshift(ecosystem('npm', '    groups:\n      minor-and-patch:\n        update-types: [minor, patch]\n'));
  if (hasDotnet) ecosystems.unshift(ecosystem('nuget', '    groups:\n      minor-and-patch:\n        update-types: [minor, patch]\n'));
  if (hasDocker) ecosystems.push(ecosystem('docker'));
  const dependabotTemplate = await fs.readFile(path.join(root, 'project', '.github', 'dependabot.yml.template'), 'utf8');
  await fs.writeFile(path.join(project, '.github', 'dependabot.yml'), dependabotTemplate.replace('__ECOSYSTEMS__', ecosystems.join('\n')));

  const languages = [];
  if (hasNode) languages.push('javascript-typescript');
  if (hasDotnet && hasGlobalJson) languages.push('csharp');
  if (languages.length) {
    const setupDotnet = languages.includes('csharp')
      ? `- name: Setup .NET\n        uses: actions/setup-dotnet@26b0ec14cb23fa6904739307f278c14f94c95bf1 # v5\n        with:\n          global-json-file: global.json`
      : `- name: No compiled runtime setup\n        run: echo "Interpreted language analysis"`;
    const autobuild = languages.includes('csharp')
      ? `- uses: github/codeql-action/autobuild@bce182f857edf1feab116e9795a3393d21977282 # v4`
      : `- name: No compiled build required\n        run: echo "Interpreted language analysis"`;
    const codeqlTemplate = await fs.readFile(path.join(root, 'project', '.github', 'workflows', 'codeql.yml.template'), 'utf8');
    const codeql = codeqlTemplate
      .replace('__LANGUAGES__', languages.join(','))
      .replace('__SETUP_DOTNET__', setupDotnet)
      .replace('__AUTOBUILD__', autobuild);
    await fs.writeFile(path.join(project, '.github', 'workflows', 'codeql.yml'), codeql);
  }
}

console.log('\nMechanical bootstrap complete. Tailor AGENTS.md and review every Recommended/Not currently item before declaring the project bootstrapped.');
