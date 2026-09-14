import fs from 'node:fs/promises';
import path from 'node:path';
import { digest, encode, readRegular } from './installation-core.mjs';
import { assertSafeDirectory } from './skill-lib.mjs';

function evidenceBytes(receipt) {
  const { evidence, ...metadata } = receipt;
  return Buffer.from(encode(metadata));
}

export function sealReceipt(receipt) {
  return { ...receipt, version: 2, evidence: digest(evidenceBytes({ ...receipt, version: 2 })) };
}

export const ownershipHeadBytes = (revision) => Buffer.from(encode({ version: 1, revision }));

export async function verifyOwnershipHead(target, file, revision) {
  await assertSafeDirectory(target, path.dirname(file));
  let bytes;
  try { bytes = await readRegular(file); }
  catch (error) { if (error.code !== 'ENOENT') throw error; bytes = null; }
  if (revision === null ? bytes !== null : bytes === null || !bytes.equals(ownershipHeadBytes(revision))) {
    throw new Error('Current ownership revision is missing or changed; reviewed recovery is required');
  }
  return bytes;
}

export async function verifyReceiptEvidence(target, store, receipt) {
  if (receipt.version !== 2 || typeof receipt.evidence !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.evidence)) {
    throw new Error('Receipt requires reviewed migration; see docs/dev/receipt-migration.md');
  }
  const file = path.join(store, 'evidence', `${receipt.evidence}.json`);
  await assertSafeDirectory(target, path.dirname(file));
  const expected = evidenceBytes(receipt);
  if (digest(expected) !== receipt.evidence || !(await readRegular(file)).equals(expected)) {
    throw new Error('Receipt ownership evidence does not match');
  }
}

export async function planReceiptEvidence(target, store, receipt) {
  let exists = false;
  try { await verifyReceiptEvidence(target, store, receipt); exists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { path: path.join(store, 'evidence', `${receipt.evidence}.json`), action: exists ? 'retain' : 'create' };
}

export async function storeReceiptEvidence(target, store, staging, receipt) {
  const directory = path.join(store, 'evidence');
  await assertSafeDirectory(target, directory);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const staged = path.join(staging, 'ownership.json');
  await fs.writeFile(staged, evidenceBytes(receipt), { flag: 'wx', mode: 0o600 });
  try { await fs.link(staged, path.join(directory, `${receipt.evidence}.json`)); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await fs.unlink(staged);
  await verifyReceiptEvidence(target, store, receipt);
}
