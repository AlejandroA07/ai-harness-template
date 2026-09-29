import { verifyOwnershipHead } from './installation-evidence.mjs';
import { readProjectPayload } from './project-provenance.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRegular, digest } from './installation-core.mjs';
import { assertSafeDirectory } from './skill-lib.mjs';
import { projectAdapters, adapterRoot, projectTree } from './project-adapters.mjs';
import { receiptPath, validateProjectReceipt } from './project-receipt.mjs';
import { projectIgnore } from './project-state.mjs';

export async function checkProject(target) {
  const read = async (relative) => {
    await assertSafeDirectory(target, path.dirname(path.join(target, relative)));
    return readRegular(path.join(target, relative));
  };
  await assertSafeDirectory(target, target);
  try { await fs.access(path.join(target, '.ai-harness-install.lock')); throw new Error('Project installation is locked or interrupted'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const receipt = validateProjectReceipt(JSON.parse(await read(receiptPath)));
  const required = ['AGENTS.md', 'docs/agents/domain.md', 'docs/agents/issue-tracker.md', '.gitleaks.toml', 'scripts/verify.mjs',
    ...(receipt.platforms.includes('claude') ? ['CLAUDE.md'] : [])];
  for (const file of required) {
    try { await read(file); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`Required project file is missing: ${file}`); throw error; }
  }
  await readProjectPayload(target, receipt);
  await verifyOwnershipHead(target, path.join(target, '.harness/project-current.json'), receipt.payload);
  for (const [file, hash] of Object.entries(receipt.owned)) if (digest(await read(file)) !== hash) throw new Error(`Owned project file drift: ${file}`);
  if (process.platform !== 'win32') for (const file of ['.githooks/pre-commit', '.githooks/commit-msg']) {
    if (!((await fs.stat(path.join(target, file))).mode & 0o111)) throw new Error(`Project hook is not executable: ${file}`);
  }
  const hooks = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: target, encoding: 'utf8', shell: false });
  if (hooks.error) throw new Error('Git is required to verify repository hook activation');
  if (hooks.status !== 0 || hooks.stdout.trim() !== '.githooks') throw new Error('Repository hooks are not active; expected core.hooksPath=.githooks');
  const rendered = await projectAdapters(target, receipt.platforms);
  const adapterOwned = Object.keys(receipt.owned).filter((file) => receipt.platforms.some((platform) => file.startsWith(adapterRoot(platform) + '/'))).sort();
  if (JSON.stringify(adapterOwned) !== JSON.stringify(Object.keys(rendered.files).sort())) throw new Error('Project adapter inventory drift');
  for (const [file, bytes] of Object.entries(rendered.files)) if (digest(bytes) !== receipt.owned[file]) throw new Error('Project adapter source drift');
  for (const directory of new Set(adapterOwned.map((file) => file.split('/').slice(0, 3).join('/')))) {
    const actual = Object.keys(await projectTree(target, path.join(target, directory))).map((file) => directory + '/' + file).sort();
    if (JSON.stringify(actual) !== JSON.stringify(adapterOwned.filter((file) => file.startsWith(directory + '/')))) throw new Error('Unexpected project adapter resource');
  }
  projectIgnore(await read('.gitignore'), receipt.ignore);
  return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    await checkProject(target);
    console.log('Project harness and adapters are current.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
