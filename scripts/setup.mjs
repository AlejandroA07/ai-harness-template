import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './catalog-loader.mjs';
import { planSelection } from './module-catalog.mjs';

const usage = `Usage:
  node scripts/setup.mjs list [--json]
  node scripts/setup.mjs plan --select <id> [--select <id> ...] --platform <claude|codex|both> --scope <machine|project> [--json]
  node scripts/setup.mjs plan --module <skills|workflows> --platform <claude|codex|both> --scope <machine|project> [--json]

M1 supports read-only list and selection planning. Apply, audit and remove are not available here yet.
Existing full-profile machine setup, bootstrap and audit commands are unchanged.`;

function parseArgs(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  const [operation, ...options] = args;
  if (!['list', 'plan'].includes(operation)) throw new Error('Only list and plan are supported in M1');
  const result = { operation, json: false, ids: [], modules: [] };
  const seen = new Set();
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (option === '--json') {
      if (result.json) throw new Error('Duplicate --json');
      result.json = true;
      continue;
    }
    if (operation !== 'plan' || !['--select', '--module', '--platform', '--scope'].includes(option)) throw new Error(`Unsupported option: ${option}`);
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
  if (operation === 'plan' && (!result.platform || !result.scope)) throw new Error('Plan requires explicit --platform and --scope');
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
          if (!members.length) console.log('  Source ownership recorded; no selectable M1 capability definitions.');
        }
      }
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
