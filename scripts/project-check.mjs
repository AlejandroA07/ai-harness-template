import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegular, digest } from './installation-core.mjs';
import { assertSafeDirectory } from './skill-lib.mjs';
import { projectAdapters, adapterRoot, projectTree } from './project-adapters.mjs';
import { receiptPath, validateProjectReceipt } from './project-receipt.mjs';
import { projectSettings } from './project-settings.mjs';
import { projectIgnore, projectFeatures } from './project-state.mjs';

export async function checkProject(target) {
  const read = async (relative) => {
    await assertSafeDirectory(target, path.dirname(path.join(target, relative)));
    return readRegular(path.join(target, relative));
  };
  await assertSafeDirectory(target, target);
  try { await fs.access(path.join(target, '.ai-harness-install.lock')); throw new Error('Project installation is locked or interrupted'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const receipt = validateProjectReceipt(JSON.parse(await read(receiptPath)));
  for (const [file, hash] of Object.entries(receipt.owned)) if (digest(await read(file)) !== hash) throw new Error(`Owned project file drift: ${file}`);
  const rendered = await projectAdapters(target, receipt.platforms);
  const adapterOwned = Object.keys(receipt.owned).filter((file) => receipt.platforms.some((platform) => file.startsWith(adapterRoot(platform) + '/'))).sort();
  if (JSON.stringify(adapterOwned) !== JSON.stringify(Object.keys(rendered.files).sort())) throw new Error('Project adapter inventory drift');
  for (const [file, bytes] of Object.entries(rendered.files)) if (digest(bytes) !== receipt.owned[file]) throw new Error('Project adapter source drift');
  for (const directory of new Set(adapterOwned.map((file) => file.split('/').slice(0, 3).join('/')))) {
    const actual = Object.keys(await projectTree(target, path.join(target, directory))).map((file) => directory + '/' + file).sort();
    if (JSON.stringify(actual) !== JSON.stringify(adapterOwned.filter((file) => file.startsWith(directory + '/')))) throw new Error('Unexpected project adapter resource');
  }
  for (const platform of receipt.platforms) {
    const file = platform === 'codex' ? '.codex/hooks.json' : '.claude/settings.json';
    projectSettings(await read(file), receipt.settings[platform].hook, receipt.settings[platform]);
  }
  projectIgnore(await read('.gitignore'), receipt.ignore);
  if (receipt.platforms.includes('codex')) projectFeatures(await read('.codex/config.toml'), receipt.codexFeatures);
  return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    await checkProject(target);
    console.log('Project harness and adapters are current.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
