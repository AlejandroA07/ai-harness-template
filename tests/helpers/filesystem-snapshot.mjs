import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

// Snapshot controlled fixture trees. File contents and metadata come from the
// same checked handle; this is not an atomic snapshot of a changing directory.
export async function snapshot(directory) {
  const result = {};
  async function walk(current, relative) {
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) result[relative] = { link: await fs.readlink(current) };
    else if (stat.isDirectory()) {
      result[relative] = { directory: true, mode: stat.mode, mtime: stat.mtimeMs };
      for (const entry of (await fs.readdir(current)).sort()) await walk(path.join(current, entry), relative + '/' + entry);
    } else {
      if (!stat.isFile()) throw new Error('Unsafe snapshot file');
      const handle = await fs.open(current, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino) {
          throw new Error('Snapshot file changed while opening');
        }
        result[relative] = { bytes: (await handle.readFile()).toString('base64'), mode: opened.mode, mtime: opened.mtimeMs };
      } finally { await handle.close(); }
    }
  }
  await walk(directory, '');
  return result;
}
