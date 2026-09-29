import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFullProfileInstallation, planFullProfileInstallation } from './full-profile-installation.mjs';

const usage = `Usage:
  node scripts/machine-setup.mjs [plan|apply|audit|remove] [--target <absolute-home-path>] [--legacy-root <absolute-old-checkout>] [--apply] [--json]

The target defaults to the current home directory. Apply and remove preview by default;
--apply performs the operation. Use --legacy-root only to migrate the exact
checkout-bound installation created by the retired machine setup.`;

function parseArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const defaultTarget = os.homedir();
  const options = { command: 'apply', apply: false, json: false, target: defaultTarget, legacyRoot: null };
  let index = 0;
  if (['plan', 'apply', 'audit', 'remove'].includes(args[0])) options.command = args[index++];
  let targetSeen = false;
  let legacyRootSeen = false;
  for (; index < args.length; index++) {
    const option = args[index];
    if (option === '--apply') {
      if (options.apply) throw new Error('Duplicate --apply');
      options.apply = true;
      continue;
    }
    if (option === '--json') {
      if (options.json) throw new Error('Duplicate --json');
      options.json = true;
      continue;
    }
    if (!['--target', '--legacy-root'].includes(option)) throw new Error(`Unsupported option: ${option}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    if (option === '--target') {
      if (targetSeen) throw new Error('Duplicate --target');
      targetSeen = true;
      options.target = value;
    } else {
      if (legacyRootSeen) throw new Error('Duplicate --legacy-root');
      legacyRootSeen = true;
      options.legacyRoot = value;
    }
  }
  if (options.apply && !['apply', 'remove'].includes(options.command)) {
    throw new Error('--apply is valid only for apply or remove');
  }
  if (options.legacyRoot && !['plan', 'apply'].includes(options.command)) {
    throw new Error('--legacy-root is valid only for plan or apply');
  }
  return options;
}

function printResult(options, result) {
  const operation = options.command === 'plan' ? 'apply' : options.command;
  const mode = options.apply ? 'applied' : 'read-only';
  console.log(`Machine setup ${operation}: ${result.applicable ? 'ready' : 'blocked'} (${mode})`);
  for (const change of result.changes) console.log(`${change.action}: ${change.id}`);
  for (const conflict of result.conflicts) console.log(`Conflict: ${conflict}`);
  for (const tool of result.controls.tools.filter((entry) => !entry.required && !entry.available)) {
    console.log(`Warning: Optional tool is unavailable: ${tool.id}`);
  }
  if (result.activation) console.log(result.activation);
  if (!options.apply && ['plan', 'apply', 'remove'].includes(options.command)) {
    console.log('Use --apply to perform this operation.');
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
  } else {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const operation = ['plan', 'apply'].includes(options.command) ? 'apply' : options.command;
    const plan = await planFullProfileInstallation(root, {
      operation,
      platform: 'both',
      scope: 'machine',
      target: options.target,
      ...(options.legacyRoot ? { legacyRoot: options.legacyRoot } : {}),
    });
    const result = options.apply ? await applyFullProfileInstallation(plan) : plan;
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printResult(options, result);
    if (!result.applicable) process.exitCode = 1;
  }
} catch (error) {
  console.error(`Machine setup: ${error.message}`);
  process.exitCode = 1;
}
