import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { snapshot } from './helpers/filesystem-snapshot.mjs';

test('snapshot rejects a file replaced between classification and opening', async () => {
  for (const kind of ['file', 'symlink']) {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-race-'));
    const root = path.join(temporary, 'tree');
    const victim = path.join(root, 'checked.md');
    const replacement = path.join(temporary, 'replacement.md');
    const originalLstat = fs.lstat;
    let replaced = false;
    try {
      await fs.mkdir(root);
      await fs.writeFile(victim, 'Expected fixture bytes');
      await fs.writeFile(replacement, 'Replacement fixture bytes');
      fs.lstat = async (file, ...args) => {
        const info = await originalLstat(file, ...args);
        if (file === victim && !replaced) {
          replaced = true;
          await fs.rename(victim, path.join(temporary, 'original.md'));
          if (kind === 'symlink') await fs.symlink(replacement, victim);
          else await fs.rename(replacement, victim);
        }
        return info;
      };
      await assert.rejects(snapshot(root), /changed|unsafe|ELOOP/i, kind);
      assert.equal(replaced, true);
    } finally {
      fs.lstat = originalLstat;
      await fs.rm(temporary, { recursive: true, force: true });
    }
  }
});

test('snapshot reads the opened file even if its path is replaced after opening', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-handle-'));
  const root = path.join(temporary, 'tree');
  const victim = path.join(root, 'checked.md');
  const originalOpen = fs.open;
  let replaced = false;
  try {
    await fs.mkdir(root);
    await fs.writeFile(victim, 'Expected fixture bytes');
    const expected = await fs.stat(victim);
    fs.open = async (file, ...args) => {
      const handle = await originalOpen(file, ...args);
      if (file === victim && !replaced) {
        replaced = true;
        await fs.rename(victim, path.join(temporary, 'original.md'));
        await fs.writeFile(victim, 'Replacement fixture bytes');
      }
      return handle;
    };
    const result = await snapshot(root);
    assert.equal(replaced, true);
    assert.deepEqual(result['/checked.md'], { bytes: Buffer.from('Expected fixture bytes').toString('base64'),
      mode: expected.mode, mtime: expected.mtimeMs });
  } finally {
    fs.open = originalOpen;
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
