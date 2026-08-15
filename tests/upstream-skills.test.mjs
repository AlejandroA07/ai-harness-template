import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { changedInventoryPaths, inventoryDirectory, safeMarkdownFiles, validateOwnershipManifest } from '../scripts/upstream-skills.mjs';

const root = path.resolve(import.meta.dirname, '..');
const commit = '8b78b531ab965735c5dc74f6f7a219e1e37326df';

test('upstream ownership manifest distinguishes exact, adapted, and local skills', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'skills', 'upstream-sources.json'), 'utf8'));
  assert.equal(manifest.reviewedCommit, commit);
  assert.equal(manifest.skills['domain-modeling'].mode, 'exact');
  assert.equal(manifest.skills.implement.mode, 'adapted');
  assert.equal(manifest.skills['security-checklist'].mode, 'local');
});

test('upstream ownership rejects path traversal and repository substitution', () => {
  const base = {
    repository: 'https://github.com/mattpocock/skills.git',
    reviewedCommit: commit,
    skills: { tdd: { mode: 'exact', upstreamPath: 'skills/engineering/tdd', reviewedCommit: commit } },
    rejected: [],
  };
  assert.doesNotThrow(() => validateOwnershipManifest(base));
  assert.throws(() => validateOwnershipManifest({ ...base, repository: 'https://example.com/skills.git' }), /Unexpected upstream repository/);
  assert.throws(() => validateOwnershipManifest({
    ...base,
    skills: { tdd: { ...base.skills.tdd, upstreamPath: 'skills/engineering/../../outside' } },
  }), /Unsafe upstream path/);
});

test('upstream audit rejects an unexpected executable or script resource', async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'unsafe-upstream-'));
  try {
    await fs.writeFile(path.join(fixture, 'SKILL.md'), '---\nname: fixture\ndescription: Fixture.\n---\n');
    await fs.writeFile(path.join(fixture, 'unsafe.sh'), 'exit 0\n');
    await assert.rejects(() => safeMarkdownFiles(fixture), /Unexpected upstream file type/);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});

test('adapted resource inventories notice helper-script-only drift', async () => {
  const upstream = await fs.mkdtemp(path.join(os.tmpdir(), 'upstream-inventory-'));
  const local = await fs.mkdtemp(path.join(os.tmpdir(), 'local-inventory-'));
  try {
    for (const root of [upstream, local]) {
      await fs.writeFile(path.join(root, 'SKILL.md'), 'same\n');
      await fs.mkdir(path.join(root, 'scripts'));
    }
    await fs.writeFile(path.join(upstream, 'scripts', 'helper.sh'), 'upstream\n');
    await fs.writeFile(path.join(local, 'scripts', 'helper.sh'), 'local\n');
    assert.deepEqual(changedInventoryPaths(await inventoryDirectory(upstream), await inventoryDirectory(local)), ['scripts/helper.sh']);
  } finally {
    await fs.rm(upstream, { recursive: true, force: true });
    await fs.rm(local, { recursive: true, force: true });
  }
});
