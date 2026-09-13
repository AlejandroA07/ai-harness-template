import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { encode, digest, payloadHash, treeFiles, stat } from './installation-core.mjs';
import { assertSafeDirectory } from './skill-lib.mjs';

export function projectPayload(receipt, owned) {
  const { payload, ...metadata } = receipt;
  const files = { 'manifest.json': Buffer.from(encode(metadata)) };
  for (const file of Object.keys(receipt.owned)) {
    if (!owned[file] || digest(owned[file]) !== receipt.owned[file]) throw new Error('Invalid project payload content');
    files[`files/${file}`] = owned[file];
  }
  return files;
}

export async function readProjectPayload(target, receipt) {
  const directory = path.join(target, '.harness/project-payloads', receipt.payload);
  await assertSafeDirectory(target, directory);
  const files = await treeFiles(directory);
  if (payloadHash(files) !== receipt.payload) throw new Error('Project ownership payload changed');
  const owned = Object.fromEntries(Object.keys(receipt.owned).map((file) => [file, files[`files/${file}`]]));
  if (!equal(files, projectPayload(receipt, owned))) throw new Error('Project receipt does not match ownership payload');
  return owned;
}

export async function storeProjectPayload(target, staging, receipt, files) {
  const parent = path.join(target, '.harness/project-payloads');
  const destination = path.join(parent, receipt.payload);
  await assertSafeDirectory(target, destination);
  if (await stat(destination)) { await readProjectPayload(target, receipt); return; }
  const temporary = path.join(staging, 'payload');
  for (const [relative, bytes] of Object.entries(files)) {
    const file = path.join(temporary, relative);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  }
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  await assertSafeDirectory(target, parent);
  await fs.rename(temporary, destination);
  await readProjectPayload(target, receipt);
}
