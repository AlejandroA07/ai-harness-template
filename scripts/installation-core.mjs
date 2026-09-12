import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertSafeDirectory } from './skill-lib.mjs';

export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const encode = (value) => JSON.stringify(value, null, 2) + '\n';
export async function stat(file) {
  try { return await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function readRegular(file) {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1) throw new Error('Expected an unlinked regular file');
    const current = await fs.lstat(file);
    if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1
      || opened.ino !== current.ino || opened.dev !== current.dev) throw new Error('File changed while opening');
    return await handle.readFile();
  } finally { await handle.close(); }
}
export function payloadHash(files) {
  return digest(encode(Object.keys(files).sort().map((name) => [name, digest(files[name])])));
}
export async function treeFiles(directory, prefix = '') {
  await assertSafeDirectory(directory, directory);
  const files = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await treeFiles(file, relative + '/');
      if (!Object.keys(nested).length) throw new Error('Unexpected empty payload directory');
      Object.assign(files, nested);
    } else files[relative] = await readRegular(file);
  }
  return files;
}
export async function acquireTargetLock(target) {
  await assertSafeDirectory(target, target);
  const lock = path.join(target, '.ai-harness-install.lock');
  await fs.mkdir(lock, { mode: 0o700 }).catch(() => { throw new Error('Target is locked; no changes applied'); });
  return lock;
}
export async function releaseTargetLock(lock) { await fs.rmdir(lock); }

// Caller holds the shared target lock and supplies fully preflighted, private
// operations. Only hashes and owned metadata belong in the durable journal.
export async function publishFiles({ target, staging, operations, journal, checkpoint = async () => {} }) {
  const progressed = [];
  const equal = (a, b) => a === null ? b === null : b !== null && a.equals(b);
  async function current(file) {
    await assertSafeDirectory(target, path.dirname(file));
    try { return await readRegular(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  try {
    await fs.writeFile(path.join(staging, 'transaction.json'), encode(journal), { flag: 'wx', mode: 0o600 });
    for (const [index, operation] of operations.entries()) {
      if (operation.after !== null) await fs.writeFile(path.join(staging, `${index}.new`), operation.after, { flag: 'wx', mode: 0o600 });
    }
    await checkpoint('staged');
    for (const operation of operations) {
      if (!equal(await current(operation.file), operation.before)) throw new Error('File changed after preflight');
    }
    for (const [index, operation] of operations.entries()) {
      if (!equal(await current(operation.file), operation.before)) throw new Error('File changed before publication');
      await fs.mkdir(path.dirname(operation.file), { recursive: true });
      const entry = { ...operation, backup: path.join(staging, `${index}.old`), moved: false, published: false };
      if (operation.before !== null) {
        await fs.rename(operation.file, entry.backup);
        entry.moved = true;
        progressed.push(entry);
        // Keep the original in private staging until the transaction completes.
        // A raced-in entry is retained for recovery, never deleted as a backup.
        if (!equal(await readRegular(entry.backup), operation.before)) throw new Error('File replaced during publication');
      } else progressed.push(entry);
      if (operation.after !== null) {
        // Exclusive publication cannot overwrite a competing target.
        await fs.link(path.join(staging, `${index}.new`), operation.file);
        entry.published = true;
        await fs.unlink(path.join(staging, `${index}.new`));
      }
      await checkpoint(operation.receipt ? 'receipt' : 'file', operation.id);
    }
    for (const operation of operations) {
      if (!equal(await current(operation.file), operation.after)) throw new Error('Published state changed');
    }
  } catch (error) {
    const unresolved = [];
    for (const [index, operation] of [...progressed].reverse().entries()) {
      try {
        if (operation.moved && !equal(await readRegular(operation.backup), operation.before)) throw new Error('Moved entry was replaced');
        const expected = operation.published ? operation.after : null;
        if (!equal(await current(operation.file), expected)) throw new Error('Rollback conflict');
        if (operation.published) {
          const retired = path.join(staging, `${index}.rollback`);
          await fs.rename(operation.file, retired);
          if (!equal(await readRegular(retired), operation.after)) throw new Error('Rollback target was replaced');
          await fs.unlink(retired);
        }
        if (operation.moved) {
          await fs.link(operation.backup, operation.file);
          await fs.unlink(operation.backup);
        }
      } catch { unresolved.push(operation.id); }
    }
    const failure = new Error(`Publication failed; completed: ${progressed.map((item) => item.id).join(', ') || 'none'}; ${unresolved.length ? 'recovery required; retain staging and lock' : 'owned changes rolled back'}`);
    failure.recoveryRequired = unresolved.length > 0;
    throw failure;
  }
}
