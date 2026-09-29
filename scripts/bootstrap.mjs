import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planProjectInstallation, applyProjectInstallation } from './project-installation.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const githubOverride = args.includes('--github');
const domainArguments = args.filter((arg) => arg.startsWith('--domain-layout='));
const targets = args.filter((arg) => !arg.startsWith('--'));
const unknown = args.filter((arg) => arg.startsWith('--')
  && arg !== '--apply' && arg !== '--github' && !arg.startsWith('--domain-layout='));
if (targets.length !== 1 || unknown.length || domainArguments.length > 1) {
  console.error('Usage: node scripts/bootstrap.mjs <project-path> [--github] [--domain-layout=single|multi] [--apply]');
  process.exit(2);
}
const domainLayout = domainArguments[0]?.split('=')[1];
if (domainLayout && !['single', 'multi'].includes(domainLayout)) {
  console.error('Domain layout must be --domain-layout=single or --domain-layout=multi');
  process.exit(2);
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = path.resolve(targets[0]);
  try { await fs.access(target); } catch { throw new Error(`Project path does not exist: ${target}`); }
  const origin = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: target, encoding: 'utf8' });
  const github = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd: target, encoding: 'utf8' });
  const isGithub = githubOverride || github.status === 0 || (origin.status === 0 && /(?:github\.com|github\.enterprise)/i.test(origin.stdout));
  const gitRepository = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: target, encoding: 'utf8' });
  const hookConfiguration = gitRepository.status === 0
    ? spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: target, encoding: 'utf8' }) : null;
  const existingHookPath = hookConfiguration?.status === 0 ? hookConfiguration.stdout.trim() : '';
  const hookConflict = existingHookPath && existingHookPath !== '.githooks'
    ? `Existing core.hooksPath is ${existingHookPath}; review it before replacing repository hook activation.` : null;
  let hasVerifier = true;
  try { await fs.access(path.join(target, 'scripts', 'verify.mjs')); }
  catch (error) { if (error.code === 'ENOENT') hasVerifier = false; else throw error; }

  const options = (platform) => ({
    operation: 'apply',
    platform,
    scope: 'project',
    target,
    tracker: isGithub ? 'github' : 'local',
    ...(domainLayout ? { domainLayout } : {}),
    ...(isGithub && !hasVerifier ? { ci: 'github' } : {}),
  });

  function print(plans) {
    const changes = new Map();
    for (const plan of plans) for (const change of plan.changes) changes.set(change.id, change.action);
    console.log(`Bootstrap ${apply ? 'APPLY' : 'DRY RUN'} for ${target}`);
    for (const [file, action] of [...changes].sort(([left], [right]) => left.localeCompare(right))) console.log(`${action.toUpperCase()} ${file}`);
    for (const conflict of new Set(plans.flatMap((plan) => plan.conflicts))) console.log(`BLOCKED ${conflict}`);
    if (hookConflict) console.log(`BLOCKED ${hookConflict}`);
    for (const note of new Set(plans.flatMap((plan) => plan.notes))) console.log(`NOTE ${note}`);
    if (isGithub && hasVerifier && plans.every((plan) => plan.options.ci === 'none')) {
      console.log('NOTE Existing verification was preserved; configure CI from its declared dependencies instead of guessing them.');
    }
  }

  if (!apply) {
    const plans = await Promise.all(['codex', 'claude'].map((platform) => planProjectInstallation(root, options(platform))));
    print(plans);
    if (plans.some((plan) => !plan.applicable) || hookConflict) process.exitCode = 1;
    else console.log('Dry run complete. Use --apply to install the planned project harness.');
    return;
  }

  if (gitRepository.status !== 0) throw new Error('Bootstrap apply requires an existing Git repository');
  if (hookConflict) throw new Error(hookConflict);
  const initial = await Promise.all(['codex', 'claude'].map((platform) => planProjectInstallation(root, options(platform))));
  if (initial.some((plan) => !plan.applicable)) {
    print(initial);
    throw new Error(`Project conflicts: ${[...new Set(initial.flatMap((plan) => plan.conflicts))].join('; ')}`);
  }
  const results = [];
  for (const platform of ['codex', 'claude']) {
    const plan = await planProjectInstallation(root, options(platform));
    if (!plan.applicable) { print([plan]); throw new Error(`Project conflicts: ${plan.conflicts.join('; ')}`); }
    results.push(await applyProjectInstallation(plan));
  }
  const hooks = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: target, encoding: 'utf8' });
  if (hooks.status !== 0) throw new Error(hooks.stderr || hooks.stdout || 'Failed to activate repository Git hooks');
  print(results);
  console.log('Bootstrap complete. Tailor AGENTS.md and keep scripts/verify.mjs current for this project.');
}

try { await main(); }
catch (error) {
  console.error(`Bootstrap: ${error.message}`);
  process.exitCode = 1;
}
