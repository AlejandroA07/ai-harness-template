import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

async function snapshotFile(file) {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new Error('Unsafe snapshot file');
    // This check follows opening: it never authorizes a subsequent path-based
    // open/read. It also rejects followed links on platforms without O_NOFOLLOW.
    const current = await fs.lstat(file);
    if (!current.isFile() || opened.dev !== current.dev || opened.ino !== current.ino) {
      throw new Error('Snapshot file changed while opening');
    }
    return { bytes: (await handle.readFile()).toString('base64'), mode: opened.mode, mtime: opened.mtimeMs };
  } finally { await handle.close(); }
}

// Snapshot controlled fixture trees. Directory entries determine traversal;
// regular-file metadata and bytes come from one validated, already-open handle.
// This is not an atomic snapshot of a changing directory.
export async function snapshot(directory) {
  const result = {};
  async function walk(current, relative) {
    const info = await fs.lstat(current);
    if (!info.isDirectory()) throw new Error('Unsafe snapshot directory');
    result[relative] = { directory: true, mode: info.mode, mtime: info.mtimeMs };
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(current, entry.name);
      const childRelative = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) result[childRelative] = { link: await fs.readlink(child) };
      else if (entry.isDirectory()) await walk(child, childRelative);
      else if (entry.isFile()) result[childRelative] = await snapshotFile(child);
      else throw new Error('Unsafe snapshot entry');
    }
  }
  await walk(directory, '');
  return result;
}
