import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './catalog-loader.mjs';
import { planSelection } from './module-catalog.mjs';
import { planInstallation, applyInstallation } from './selection-installation.mjs';
import { planGlobalInstallation, applyGlobalInstallation } from './global-installation.mjs';
import { loadIntegrationCatalog, planIntegrations } from './integration-catalog.mjs';
import { planIntegrationInstallation, applyIntegrationInstallation } from './integration-installation.mjs';
import { planFullProfileInstallation, applyFullProfileInstallation } from './full-profile-installation.mjs';

const usage = `Usage:
  node scripts/setup.mjs list [--json]
  node scripts/setup.mjs plan --select <id> [--select <id> ...] --platform <claude|codex|both> --scope <machine|project> [--json]
  node scripts/setup.mjs plan --module <skills|workflows> --platform <claude|codex|both> --scope <machine|project> [--json]
  node scripts/setup.mjs plan --module tool-integrations [--select <id> ...] --platform <claude|codex> --scope <machine|project> [--enable <id>:<capability> ...] [--json]
  node scripts/setup.mjs <plan|apply|audit|remove> --profile full --platform both --scope machine --target <absolute-home-path> [--legacy-root <absolute-old-checkout>] [--apply] [--json]

  node scripts/setup.mjs <apply|remove> --select <capability> --platform <claude|codex> --scope <machine|project> --target <absolute-target-path> [--apply] [--json]
  node scripts/setup.mjs audit --platform <claude|codex> --scope <machine|project> --target <absolute-target-path> [--json]
  node scripts/setup.mjs <plan|apply|remove> --module tool-integrations --select <id> --platform <claude|codex> --scope <machine|project> --target <absolute-target-path> [--enable <id>:<capability>] [--artifact <id>=<absolute-file>] [--materialize] [--allow-network] [--python <absolute-python>] [--apply] [--json]
  node scripts/setup.mjs audit --module tool-integrations --platform <claude|codex> --scope <machine|project> --target <absolute-target-path> [--json]
  node scripts/setup.mjs <plan|apply|audit|remove> --module global-configuration --platform <claude|codex> --scope machine --target <absolute-home-path> [--apply] [--json]
Apply and remove preview by default; --apply performs the operation.
Add --target to plan for read-only installation preflight. Machine/project Skills and Global configuration are supported.
Use scripts/bootstrap.mjs for repository project configuration.
The full profile installs both global configurations, the exact canonical skill inventory, required-tool preflight and owned machine controls.
Use --legacy-root only for an explicit migration from checkout-bound legacy state.
Existing machine setup, bootstrap and audit commands remain compatibility entry points.`;

function parseArgs(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  const [operation, ...options] = args;
  if (!['list', 'plan', 'apply', 'audit', 'remove'].includes(operation)) throw new Error('Unknown setup operation');
  const result = { operation, json: false, ids: [], modules: [], enabled: [], artifacts: {} };
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
    if (['--materialize', '--allow-network'].includes(option)) {
      const key = option.slice(2).replace('-network', 'Network');
      if (result[key]) throw new Error(`Duplicate ${option}`);
      result[key] = true;
      continue;
    }
    if (operation === 'list' || !['--select', '--module', '--profile', '--platform', '--scope', '--target', '--legacy-root', '--enable', '--artifact', '--python'].includes(option)) throw new Error(`Unsupported option: ${option}`);
    const value = options[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    if (option === '--select') result.ids.push(value);
    else if (option === '--module') result.modules.push(value);
    else if (option === '--enable') result.enabled.push(value);
    else if (option === '--artifact') {
      const separator = value.indexOf('=');
      if (separator < 1 || Object.hasOwn(result.artifacts, value.slice(0, separator))) throw new Error('Artifacts use one --artifact <id>=<absolute-file> per integration');
      result.artifacts[value.slice(0, separator)] = value.slice(separator + 1);
    }
    else {
      if (seen.has(option)) throw new Error(`Duplicate ${option}`);
      seen.add(option);
      result[option === '--legacy-root' ? 'legacyRoot' : option.slice(2)] = value;
    }
  }
  if (operation !== 'list' && (!result.platform || !result.scope)) throw new Error('Requires explicit --platform and --scope');
  if (['apply', 'audit', 'remove'].includes(operation) && !result.target) throw new Error('Lifecycle requires explicit --target');
  const global = result.modules.length === 1 && result.modules[0] === 'global-configuration';
  const integrations = result.modules.length === 1 && result.modules[0] === 'tool-integrations';
  const full = result.profile === 'full';
  if (result.profile && !full) throw new Error('Only --profile full is supported');
  if (full && (result.modules.length || result.ids.length || result.enabled.length || Object.keys(result.artifacts).length
    || result.materialize || result.allowNetwork || result.python)) {
    throw new Error('The full profile cannot be mixed with module, selection or integration options');
  }
  if (full && (!result.target || result.platform !== 'both' || result.scope !== 'machine')) {
    throw new Error('The full profile requires --target, --platform both and --scope machine');
  }
  if (result.legacyRoot && !full) throw new Error('--legacy-root requires --profile full');
  if (global && (result.ids.length || !result.target)) throw new Error('Global configuration requires --target and cannot be mixed with skills');
  if ((result.target || operation !== 'plan') && result.modules.length && !global && !integrations) throw new Error('Lifecycle supports Global configuration, Tool integrations, or explicit skill IDs');
  if ((result.enabled.length || Object.keys(result.artifacts).length || result.materialize || result.allowNetwork || result.python) && !integrations) throw new Error('--enable, --artifact and runtime materialization options require --module tool-integrations');
  if (integrations && result.platform === 'both') throw new Error('Tool integration lifecycle requires one platform');
  if (integrations && operation === 'audit' && (result.ids.length || result.enabled.length || Object.keys(result.artifacts).length)) throw new Error('Tool integration audit inspects the whole receipt');
  result.global = global;
  result.integrations = integrations;
  result.full = full;
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
    const catalog = options.target ? null : await loadCatalog(root);
    const integrationCatalog = !options.target && (options.operation === 'list' || options.integrations)
      ? await loadIntegrationCatalog(root) : null;
    if (options.operation === 'list') {
      if (options.json) console.log(JSON.stringify({ ...catalog, integrations: integrationCatalog.integrations }, null, 2));
      else {
        console.log(`Catalog v${catalog.version} — declared capabilities; installed state is not inspected.`);
        for (const module of catalog.modules) {
          console.log(`${module.label} (${module.id}; ${module.visibility})`);
          const members = catalog.capabilities.filter((entry) => entry.module === module.id);
          for (const entry of members) console.log(`  ${entry.id}: ${entry.description} [${entry.activation}; ${entry.platforms.join('/')}; ${entry.scopes.join('/')}]`);
          if (!members.length) console.log(module.id === 'global-configuration'
            ? `  Lifecycle: --module ${module.id} with an explicit target, matching scope and one platform.`
            : module.id === 'project-configuration'
              ? '  Lifecycle: node scripts/bootstrap.mjs <project-path>'
            : module.id === 'tool-integrations'
              ? `  Integrations: ${integrationCatalog.integrations.map((entry) => entry.id).join(', ')}`
              : '  Source ownership recorded; no selectable capability definitions.');
        }
      }
    } else if (options.target) {
      const planner = options.full ? planFullProfileInstallation : options.integrations ? planIntegrationInstallation : options.global ? planGlobalInstallation : planInstallation;
      const applyPlan = options.full ? applyFullProfileInstallation : options.integrations ? applyIntegrationInstallation : options.global ? applyGlobalInstallation : applyInstallation;
      const plan = await planner(root, { operation: options.operation === 'plan' ? 'apply' : options.operation,
        ids: options.ids, platform: options.platform, scope: options.scope, target: options.target,
        ...(options.full ? { legacyRoot: options.legacyRoot ?? null } : {}),
        ...(options.integrations ? { enabled: options.enabled, artifacts: options.artifacts, materialize: Boolean(options.materialize),
          allowNetwork: Boolean(options.allowNetwork), python: options.python ?? null } : {}) });
      const result = options.apply ? await applyPlan(plan) : plan;
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        console.log(`${options.operation}: ${result.platform} / ${result.scope ?? 'machine'} / ${result.profile ?? 'coexistence'} (${options.apply ? 'applied' : 'read-only'})`);
        for (const capability of result.capabilities ?? []) {
          console.log(`${capability.module === 'workflows' ? 'Workflow' : 'Capability'}: ${capability.id} (${capability.currentStatus} -> ${capability.plannedStatus})`);
          for (const prerequisite of capability.prerequisites) console.log(`  At invocation [${prerequisite.status}]: ${prerequisite.description}`);
          for (const use of capability.conditionalUses) console.log(`  Conditional [${use.currentStatus} -> ${use.plannedStatus}]: ${use.id} — ${use.when}`);
          for (const route of capability.routes) console.log(`  Route [${route.currentStatus} -> ${route.plannedStatus}]: ${route.id}`);
        }
        for (const integration of result.integrations ?? []) console.log(`Integration: ${integration.id} (provisioned=${integration.provisioned}; configured=${integration.configured}; invocable=${integration.invocable}; plannedInvocable=${integration.plannedInvocable}; running=${integration.running})`);
        for (const change of result.changes) console.log(`${change.action}: ${change.id}`);
        if (result.evidence) console.log(`${result.evidence.action}: ${result.evidence.path}`);
        for (const conflict of result.conflicts) console.log(`Conflict: ${conflict}`);
        if (options.global || options.integrations || options.full) console.log(result.activation);
        for (const note of result.notes ?? []) console.log(note);
        if (!result.changes.length && !result.receiptChanged && result.applicable) console.log(result.installed
          ? 'No changes required; installed state is consistent.' : 'No selected installation is recorded.');
        if (!options.apply && ['apply', 'remove'].includes(options.operation)) console.log('Use --apply to perform this operation.');
      }
      if (!result.applicable) process.exitCode = 1;
    } else {
      const plan = options.integrations
        ? planIntegrations(integrationCatalog, { ids: options.ids, platform: options.platform, scope: options.scope, enabled: options.enabled })
        : planSelection(catalog, { ids: options.ids, modules: options.modules,
          platforms: options.platform === 'both' ? ['claude', 'codex'] : [options.platform], scope: options.scope });
      if (options.json) console.log(JSON.stringify(plan, null, 2));
      else if (options.integrations) {
        console.log(`Integration preview: ${plan.platform} / ${plan.scope} / coexistence`);
        for (const integration of plan.integrations) {
          console.log(`- ${integration.id} (${integration.runtime.kind}; ${integration.provenance.release})`);
          for (const capability of integration.capabilities) console.log(`  ${capability.id}: ${capability.enabled ? capability.activation : 'disabled'}`);
        }
        for (const note of plan.notes) console.log(note);
      } else printPlan(plan);
    }
  }
} catch (error) {
  console.error(`Setup: ${error.message}`);
  process.exitCode = 1;
}
