import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOwnershipHead } from './installation-evidence.mjs';
import { readRegular } from './installation-core.mjs';
import { assertSafeDirectory } from './skill-lib.mjs';
import { planInstallation } from './selection-installation.mjs';
import { planGlobalInstallation } from './global-installation.mjs';
import { planProjectInstallation } from './project-installation.mjs';

// Assessment never adopts a receipt or emits its prior values/configuration.
export async function assessReceiptMigration(repository, { target, module, platform }) {
  if (!path.isAbsolute(target ?? '') || !['codex', 'claude'].includes(platform)
    || !['skills', 'global-configuration', 'project-configuration'].includes(module)) throw new Error('Requires an absolute target, module and one platform');
  target = path.resolve(target);
  const project = module === 'project-configuration';
  const relative = project ? '.harness/project-installation.json'
    : `.ai-harness/installations/${platform}/${module === 'skills' ? 'receipt.json' : 'global.json'}`;
  await assertSafeDirectory(target, path.dirname(path.join(target, relative)));
  let receipt;
  try { receipt = JSON.parse(await readRegular(path.join(target, relative))); }
  catch (error) {
    if (error.code === 'ENOENT') {
      const head = project ? '.harness/project-current.json' : `.ai-harness/installations/${platform}/${module === 'skills' ? 'skills-current.json' : 'global-current.json'}`;
      try {
        await verifyOwnershipHead(target, path.join(target, head), null);
        return { status: 'absent', applicable: false, receipt: relative };
      } catch { return { status: 'conflict', applicable: false, receipt: relative, guidance: 'Receipt is missing but current ownership state remains; preserve it for reviewed recovery.' }; }
    }
    return { status: 'conflict', applicable: false, receipt: relative, guidance: 'Preserve the unsafe or malformed receipt and reconcile from trusted history.' };
  }
  if (receipt?.version === 1 || (project && receipt?.version === 2)) return { status: 'review-required', applicable: false, receipt: relative,
    guidance: 'This older receipt cannot prove current historical ownership. Preserve state and follow docs/dev/receipt-migration.md; do not run the old remover or change the version field.' };
  const planner = project ? planProjectInstallation : module === 'skills' ? planInstallation : planGlobalInstallation;
  try {
    const plan = await planner(repository, { target, platform, scope: project ? 'project' : 'machine', operation: 'audit' });
    return { status: plan.applicable ? 'current' : 'conflict', applicable: plan.applicable, receipt: relative,
      guidance: plan.applicable ? 'No receipt format migration is needed.' : 'Resolve installed-state or activation conflicts before continuing.' };
  } catch { return { status: 'conflict', applicable: false, receipt: relative, guidance: 'Ownership evidence is invalid, missing or unsupported; preserve state for review.' }; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index]?.slice(2), value = args[index + 1];
      if (!['target', 'module', 'platform'].includes(key) || !args[index].startsWith('--') || !value || Object.hasOwn(options, key)) throw new Error('Use --target <absolute-path> --module <skills|global-configuration|project-configuration> --platform <codex|claude>; assessment is read-only');
      options[key] = value;
    }
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const result = await assessReceiptMigration(root, options);
    console.log(JSON.stringify(result, null, 2));
    if (!result.applicable) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
