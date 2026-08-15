import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'skills', 'upstream-sources.json');
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const refIndex = args.indexOf('--ref');
const sourceCommitIndex = args.indexOf('--source-commit');
const applyExact = args.includes('--apply-exact');

export function validateOwnershipManifest(manifest) {
  if (manifest.repository !== 'https://github.com/mattpocock/skills.git') throw new Error('Unexpected upstream repository');
  if (!/^[0-9a-f]{40}$/.test(manifest.reviewedCommit ?? '')) throw new Error('reviewedCommit must be a full commit SHA');
  for (const [name, entry] of Object.entries(manifest.skills ?? {})) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid canonical skill name: ${name}`);
    if (!['exact', 'adapted', 'local'].includes(entry.mode)) throw new Error(`Invalid ownership mode for ${name}`);
    if (entry.mode === 'local') {
      if (entry.upstreamPath) throw new Error(`Local skill must not have an upstream path: ${name}`);
      continue;
    }
    if (!/^skills\/(?:engineering|productivity)\/[a-z0-9-]+$/.test(entry.upstreamPath ?? '')) {
      throw new Error(`Unsafe upstream path for ${name}`);
    }
    if (!/^[0-9a-f]{40}$/.test(entry.reviewedCommit ?? '')) throw new Error(`Invalid reviewed commit for ${name}`);
  }
  for (const name of manifest.rejected ?? []) if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid rejected skill name: ${name}`);
}

function argValue(index) {
  return index === -1 ? null : args[index + 1] ?? null;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || `${command} failed`);
  return result.stdout.trim();
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function safeMarkdownFiles(directory, strict = true) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Refusing upstream symlink: ${path.join(directory, entry.name)}`);
    if (entry.name === 'agents' || entry.name === 'README.md') continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (strict) throw new Error(`Unexpected upstream directory: ${child}`);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') {
      if (strict) throw new Error(`Unexpected upstream file type: ${child}`);
      continue;
    }
    files.push(entry.name);
  }
  if (!files.includes('SKILL.md')) throw new Error(`Missing upstream SKILL.md: ${directory}`);
  return files.sort();
}

async function normalizedDirectory(directory, strict = true) {
  if (!(await exists(directory))) return new Map();
  const result = new Map();
  for (const name of await safeMarkdownFiles(directory, strict)) {
    result.set(name, (await fs.readFile(path.join(directory, name), 'utf8')).replaceAll('\r\n', '\n'));
  }
  return result;
}

export async function inventoryDirectory(directory) {
  const result = new Map();
  if (!(await exists(directory))) return result;
  async function walk(current, prefix = '') {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`Refusing upstream symlink: ${path.join(current, entry.name)}`);
      if (!prefix && (entry.name === 'agents' || entry.name === 'README.md')) continue;
      const relative = path.posix.join(prefix, entry.name);
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(child, relative);
      else if (entry.isFile()) result.set(relative, crypto.createHash('sha256').update(await fs.readFile(child)).digest('hex'));
      else throw new Error(`Unexpected filesystem entry: ${child}`);
    }
  }
  await walk(directory);
  return result;
}

export function changedInventoryPaths(left, right) {
  return [...new Set([...left.keys(), ...right.keys()])]
    .filter((name) => left.get(name) !== right.get(name))
    .sort();
}

function mapsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const [name, contents] of left) if (right.get(name) !== contents) return false;
  return true;
}

async function discoverUpstreamNames(source) {
  const names = new Set();
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`Refusing upstream symlink: ${path.join(directory, entry.name)}`);
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (await exists(path.join(child, 'SKILL.md'))) names.add(entry.name);
      else await walk(child);
    }
  }
  for (const bucket of ['engineering', 'productivity']) await walk(path.join(source, 'skills', bucket));
  return names;
}

async function acquireSource(repository, ref) {
  const supplied = argValue(sourceIndex);
  if (supplied) return { source: path.resolve(supplied), temporary: false };
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-upstream-skills-'));
  run('git', ['clone', '--quiet', '--no-checkout', repository, temporary]);
  run('git', ['-C', temporary, 'checkout', '--quiet', ref]);
  return { source: temporary, temporary: true };
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  validateOwnershipManifest(manifest);
  const ref = argValue(refIndex) ?? manifest.reviewedCommit;
  if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error('--ref must be a full 40-character commit SHA');
  const acquired = await acquireSource(manifest.repository, ref);

  try {
    const declaredSourceCommit = argValue(sourceCommitIndex);
    if (applyExact && declaredSourceCommit) {
      throw new Error('--source-commit is only for read-only fixture audits; exact updates must verify the checkout with Git');
    }
    const sourceHead = declaredSourceCommit ?? run('git', ['-C', acquired.source, 'rev-parse', 'HEAD']);
    if (declaredSourceCommit && !/^[0-9a-f]{40}$/.test(declaredSourceCommit)) {
      throw new Error('--source-commit must be a full 40-character commit SHA');
    }
    if (sourceHead !== ref) throw new Error(`Source checkout is ${sourceHead}; expected ${ref}`);
    if (!declaredSourceCommit) {
      const index = run('git', ['-C', acquired.source, 'ls-files', '--stage']);
      if (/^120000\s/m.test(index)) throw new Error('Refusing an upstream checkout containing symbolic links');
      const sourceStatus = run('git', ['-C', acquired.source, 'status', '--porcelain', '--untracked-files=all', '--ignored']);
      if (sourceStatus) throw new Error('Refusing a source checkout with modified, untracked, or ignored working-tree files');
    }

    if (applyExact) {
      const unreviewed = Object.entries(manifest.skills)
        .filter(([, entry]) => entry.mode !== 'local' && entry.reviewedCommit !== ref)
        .map(([name]) => name);
      if (unreviewed.length > 0) throw new Error(`Manifest has not recorded review at ${ref}: ${unreviewed.join(', ')}`);
      const branch = run('git', ['-C', root, 'branch', '--show-current']);
      if (!/^feature\/[a-zA-Z0-9._/-]+$/.test(branch)) {
        throw new Error(`Exact updates require a feature/<topic> branch; current branch is '${branch || 'detached HEAD'}'`);
      }
      for (const [name, entry] of Object.entries(manifest.skills).filter(([, value]) => value.mode === 'exact')) {
        const upstream = path.join(acquired.source, ...entry.upstreamPath.split('/'));
        const local = path.join(root, 'skills', entry.upstreamPath.split('/')[1], name);
        await normalizedDirectory(upstream, true);
        await normalizedDirectory(local, true);
        const dirty = spawnSync('git', ['status', '--porcelain', '--', path.relative(root, local)], { cwd: root, encoding: 'utf8' });
        if (dirty.status !== 0 || dirty.stdout?.trim()) throw new Error(`Refusing to overwrite locally modified exact skill: ${name}`);
      }
    }

    let exactChanges = 0;
    for (const [name, entry] of Object.entries(manifest.skills)) {
      if (entry.mode === 'local') {
        console.log(`LOCAL ${name}`);
        continue;
      }
      const upstream = path.join(acquired.source, ...entry.upstreamPath.split('/'));
      const local = path.join(root, 'skills', entry.upstreamPath.split('/')[1], name);

      if (entry.mode === 'adapted') {
        const upstreamInventory = await inventoryDirectory(upstream);
        const localInventory = await inventoryDirectory(local);
        const changed = changedInventoryPaths(upstreamInventory, localInventory);
        console.log(`${changed.length === 0 ? 'ALIGNED' : 'REVIEW'} adapted ${name}${changed.length > 0 ? `: ${changed.join(', ')}` : ''}`);
        continue;
      }

      const upstreamFiles = await normalizedDirectory(upstream, true);
      const localFiles = await normalizedDirectory(local, true);
      const same = mapsEqual(upstreamFiles, localFiles);

      console.log(`${same ? 'CURRENT' : applyExact ? 'UPDATE' : 'STALE'} exact ${name}`);
      if (!same && applyExact) {
        await fs.rm(local, { recursive: true, force: true });
        await fs.mkdir(local, { recursive: true });
        for (const [file, contents] of upstreamFiles) await fs.writeFile(path.join(local, file), contents);
        exactChanges += 1;
      }
    }

    const classified = new Set(Object.values(manifest.skills)
      .filter((entry) => entry.upstreamPath)
      .map((entry) => entry.upstreamPath.split('/').at(-1)));
    const rejected = new Set(manifest.rejected);
    for (const name of await discoverUpstreamNames(acquired.source)) {
      if (!classified.has(name) && !rejected.has(name)) console.log(`UNCLASSIFIED upstream ${name}`);
    }
    if (applyExact) console.log(`Applied ${exactChanges} exact skill update(s) from ${ref}.`);
  } finally {
    if (acquired.temporary) await fs.rm(acquired.source, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
