import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertRegularTree, assertSafeDirectory, discoverSkills, hashDirectory, readInvocationPolicy, renderSkill } from './skill-lib.mjs';

const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
if (projectIndex === -1 || !args[projectIndex + 1]) {
  console.error('Usage: node scripts/generate-project-skills.mjs --project <path> [--check]');
  process.exit(2);
}

const projectRoot = path.resolve(args[projectIndex + 1]);
const check = args.includes('--check');
const sourceRoot = path.join(projectRoot, '.harness', 'skills');
const manifestPath = path.join(projectRoot, '.harness', 'generated-skills.json');
const platforms = [
  { name: 'claude', directory: path.join(projectRoot, '.claude', 'skills') },
  { name: 'codex', directory: path.join(projectRoot, '.agents', 'skills') },
];

async function statIfPresent(target) {
  try { return await fs.lstat(target); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  }
}

async function inspectRoots() {
  await assertSafeDirectory(projectRoot, sourceRoot);
  for (const platform of platforms) await assertSafeDirectory(projectRoot, platform.directory);
  const stat = await statIfPresent(manifestPath);
  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)) {
    throw new Error('Generated skill manifest must be a regular, unlinked file');
  }
}

function validateManifest(value) {
  const invalid = () => { throw new Error('Invalid generated skill manifest; no adapters changed'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (!Array.isArray(value.generated)
    || value.generated.some((name) => typeof name !== 'string' || !/^[a-z0-9-]{1,64}$/.test(name))
    || new Set(value.generated).size !== value.generated.length) invalid();
  const legacy = value.version === undefined;
  const keys = legacy ? ['generated'] : ['version', 'generated', 'hashes'];
  if (Object.keys(value).some((key) => !keys.includes(key))) invalid();
  if (!legacy) {
    if (value.version !== 1 || !value.hashes || typeof value.hashes !== 'object' || Array.isArray(value.hashes)) invalid();
    if (Object.keys(value.hashes).sort().join(',') !== 'claude,codex') invalid();
    for (const platform of platforms) {
      const hashes = value.hashes[platform.name];
      if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)
        || Object.keys(hashes).sort().join(',') !== [...value.generated].sort().join(',')) invalid();
      for (const hash of Object.values(hashes)) if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) invalid();
    }
  }
  return value;
}

await inspectRoots();
let skills = [];
if (await statIfPresent(sourceRoot)) {
  await assertRegularTree(sourceRoot);
  skills = await discoverSkills(sourceRoot);
}
const userOnly = await readInvocationPolicy(sourceRoot);
const names = skills.map((skill) => skill.name).sort();
for (const name of userOnly) if (!names.includes(name)) throw new Error(`Invocation policy names missing skill: ${name}`);
const manifestText = await statIfPresent(manifestPath) ? await fs.readFile(manifestPath, 'utf8') : null;
const previous = validateManifest(manifestText === null ? { generated: [] } : JSON.parse(manifestText));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-project-skills-'));
try {
  const hashes = { claude: {}, codex: {} };
  const operations = [];
  for (const platform of platforms) {
    for (const skill of skills) {
      const staged = path.join(temporary, platform.name, skill.name);
      await renderSkill(skill, staged, platform.name, userOnly.has(skill.name));
      hashes[platform.name][skill.name] = await hashDirectory(staged);
    }
    for (const name of new Set([...previous.generated, ...names])) {
      const target = path.join(platform.directory, name);
      const present = await statIfPresent(target);
      let actual = null;
      if (present) {
        await assertRegularTree(target);
        actual = await hashDirectory(target);
        if (!previous.generated.includes(name)) throw new Error(`Refusing to overwrite unowned adapter: ${target}`);
        // Legacy names are adoptable only when the current canonical rendering proves their content.
        const ownedHash = previous.hashes?.[platform.name][name] ?? hashes[platform.name][name];
        if (!ownedHash || ownedHash !== actual) throw new Error(`Edited or ambiguous adapter requires review: ${target}`);
      }
      const expected = hashes[platform.name][name] ?? null;
      if (actual !== expected) operations.push({ target, actual, expected, staged: path.join(temporary, platform.name, name) });
    }
  }
  const next = { version: 1, generated: names, hashes };
  const nextText = `${JSON.stringify(next, null, 2)}\n`;
  if (check) {
    const stale = operations.length > 0 || JSON.stringify([...previous.generated].sort()) !== JSON.stringify(names);
    if (stale) {
      console.error('Generated project adapters or manifest are missing or stale');
      process.exitCode = 1;
    } else console.log(`Project skill adapters are current: ${names.length} skills.`);
  } else {
    // Recheck all preconditions before the first live write.
    await inspectRoots();
    const currentText = await statIfPresent(manifestPath) ? await fs.readFile(manifestPath, 'utf8') : null;
    if (currentText !== manifestText) throw new Error('Generated skill manifest changed during preflight');
    for (const operation of operations) {
      const present = await statIfPresent(operation.target);
      if (present) await assertRegularTree(operation.target);
      const actual = present ? await hashDirectory(operation.target) : null;
      if (actual !== operation.actual) throw new Error('Adapter changed during preflight');
    }
    for (const operation of operations) {
      await fs.rm(operation.target, { recursive: true, force: true });
      if (operation.expected) await fs.cp(operation.staged, operation.target, { recursive: true });
    }
    if (manifestText !== nextText) {
      await fs.mkdir(path.dirname(manifestPath), { recursive: true });
      await fs.writeFile(manifestPath, nextText);
    }
    console.log(`Generated project adapters: ${names.length} skills.`);
  }
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
