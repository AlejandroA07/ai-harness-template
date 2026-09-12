import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './catalog-loader.mjs';
import { planSelection } from './module-catalog.mjs';
import { planInstallation, applyInstallation } from './selection-installation.mjs';
import { planGlobalInstallation, applyGlobalInstallation } from './global-installation.mjs';

const usage = `Usage:
  node scripts/setup.mjs list [--json]
  node scripts/setup.mjs plan --select <id> [--select <id> ...] --platform <claude|codex|both> --scope <machine|project> [--json]
  node scripts/setup.mjs plan --module <skills|workflows> --platform <claude|codex|both> --scope <machine|project> [--json]

  node scripts/setup.mjs <apply|remove> --select <skill> --platform <claude|codex> --scope machine --target <absolute-home-path> [--apply] [--json]
  node scripts/setup.mjs audit --platform <claude|codex> --scope machine --target <absolute-home-path> [--json]
  node scripts/setup.mjs <plan|apply|audit|remove> --module global-configuration --platform <claude|codex> --scope machine --target <absolute-home-path> [--apply] [--json]

Apply and remove preview by default; --apply performs the operation.
Add --target to plan for read-only installation preflight. Machine Skills and Global configuration are supported.
Existing full-profile machine setup, bootstrap and audit commands are unchanged.`;

function parseArgs(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  const [operation, ...options] = args;
  if (!['list', 'plan', 'apply', 'audit', 'remove'].includes(operation)) throw new Error('Unknown setup operation');
  const result = { operation, json: false, ids: [], modules: [] };
  const seen = new Set();
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (option === '--apply' && ['apply', 'remove'].includes(operation)) {
      if (result.apply) throw new Error('Duplicate --apply');
      result.apply = true;
      continue;
    }
    if (option === '--json') {
      if (result.json) throw new Error('Duplicate --json');
      result.json = true;
      continue;
    }
    if (operation === 'list' || !['--select', '--module', '--platform', '--scope', '--target'].includes(option)) throw new Error(`Unsupported option: ${option}`);
    const value = options[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    if (option === '--select') result.ids.push(value);
    else if (option === '--module') result.modules.push(value);
    else {
      if (seen.has(option)) throw new Error(`Duplicate ${option}`);
      seen.add(option);
      result[option.slice(2)] = value;
    }
  }
  if (operation !== 'list' && (!result.platform || !result.scope)) throw new Error('Requires explicit --platform and --scope');
  if (['apply', 'audit', 'remove'].includes(operation) && !result.target) throw new Error('Lifecycle requires explicit --target');
  const global = result.modules.length === 1 && result.modules[0] === 'global-configuration';
  if (global && (result.ids.length || !result.target)) throw new Error('Global configuration requires --target and cannot be mixed with skills');
  if ((result.target || operation !== 'plan') && result.modules.length && !global) throw new Error('Lifecycle supports explicit --select IDs or --module global-configuration');
  result.global = global;
  return result;
}

function printPlan(plan) {
  console.log(`Selection preview: ${plan.platforms.join(', ')} / ${plan.scope} / coexistence`);
  for (const entry of plan.capabilities) {
    console.log(`- ${entry.id} (${entry.reason}; ${entry.activation.mode})`);
    for (const use of entry.conditionalUses) console.log(`  Conditional: ${use.id} — ${use.when} ${use.included ? '(included)' : '(not selected)'}`);
    for (const route of entry.routes) console.log(`  Recommendation: ${route.id} (${route.included ? 'included' : 'not selected'})`);
    for (const prerequisite of entry.prerequisites) console.log(`  At invocation: ${prerequisite}`);
    for (const [index, stage] of (entry.workflow?.stages ?? []).entries()) {
      console.log(`  Stage ${index + 1}: ${stage.label}${stage.when ? ` — ${stage.when}` : ''}`);
      if (stage.approval) console.log(`    Approval: ${stage.approval}`);
      if (stage.artifacts.length) console.log(`    Artifacts: ${stage.artifacts.join(', ')}`);
    }
  }
  for (const entry of plan.discoveryEntries) console.log(`Discovery: ${entry.platform} ${entry.relativePath}`);
  for (const note of plan.notes) console.log(note);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) console.log(usage);
  else {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const catalog = await loadCatalog(root);
    if (options.operation === 'list') {
      if (options.json) console.log(JSON.stringify(catalog, null, 2));
      else {
        console.log('Catalog v1 — declared capabilities; installed state is not inspected.');
        for (const module of catalog.modules) {
          console.log(`${module.label} (${module.id}; ${module.visibility})`);
          const members = catalog.capabilities.filter((entry) => entry.module === module.id);
          for (const entry of members) console.log(`  ${entry.id}: ${entry.description} [${entry.activation}; ${entry.platforms.join('/')}; ${entry.scopes.join('/')}]`);
          if (!members.length) console.log(module.id === 'global-configuration'
            ? '  Lifecycle: --module global-configuration with an explicit machine target and one platform.'
            : '  Source ownership recorded; no selectable capability definitions.');
        }
      }
    } else if (options.target) {
      const planner = options.global ? planGlobalInstallation : planInstallation;
      const applyPlan = options.global ? applyGlobalInstallation : applyInstallation;
      const plan = await planner(root, { operation: options.operation === 'plan' ? 'apply' : options.operation,
        ids: options.ids, platform: options.platform, scope: options.scope, target: options.target });
      const result = options.apply ? await applyPlan(plan) : plan;
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        console.log(`${options.operation}: ${result.platform} / machine / coexistence (${options.apply ? 'applied' : 'read-only'})`);
        for (const change of result.changes) console.log(`${change.action}: ${change.id}`);
        for (const conflict of result.conflicts) console.log(`Conflict: ${conflict}`);
        if (options.global) console.log(result.activation);
        if (!result.changes.length && !result.receiptChanged && result.applicable) console.log(result.installed
          ? 'No changes required; installed state is consistent.' : 'No selected installation is recorded.');
        if (!options.apply && ['apply', 'remove'].includes(options.operation)) console.log('Use --apply to perform this operation.');
      }
      if (!result.applicable) process.exitCode = 1;
    } else {
      const plan = planSelection(catalog, { ids: options.ids, modules: options.modules,
        platforms: options.platform === 'both' ? ['claude', 'codex'] : [options.platform], scope: options.scope });
      if (options.json) console.log(JSON.stringify(plan, null, 2));
      else printPlan(plan);
    }
  }
} catch (error) {
  console.error(`Setup: ${error.message}`);
  process.exitCode = 1;
}
