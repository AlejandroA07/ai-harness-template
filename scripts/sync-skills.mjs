import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSkillTree } from './skill-lib.mjs';

const apply = process.argv.includes('--apply');
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const sourceRoot = path.join(root, 'skills');
const generatedRoot = path.join(root, '.generated', 'skills');
const skills = apply ? await generateSkillTree(sourceRoot, generatedRoot) : await (await import('./skill-lib.mjs')).discoverSkills(sourceRoot);
const names = new Set(skills.map((skill) => skill.name));

const platforms = [
  { name: 'Claude', source: path.join(generatedRoot, 'claude'), target: path.join(os.homedir(), '.claude', 'skills') },
  { name: 'Codex', source: path.join(generatedRoot, 'codex'), target: path.join(os.homedir(), '.agents', 'skills') },
];

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function existingLinkTarget(target) {
  try {
    const stat = await fs.lstat(target);
    if (!stat.isSymbolicLink()) return null;
    return await fs.realpath(target);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

const actions = [];
const conflicts = [];
for (const platform of platforms) {
  if (apply) await fs.mkdir(platform.target, { recursive: true });
  for (const name of names) {
    const target = path.join(platform.target, name);
    const expected = path.join(platform.source, name);
    const linkTarget = await existingLinkTarget(target);
    if (linkTarget === undefined) actions.push({ kind: 'link', platform, name, target, expected });
    else if (linkTarget === null) conflicts.push(`${platform.name}: ${target} exists and is not a harness link`);
    else if (path.resolve(linkTarget) !== path.resolve(expected)) {
      if (isWithin(linkTarget, generatedRoot)) actions.push({ kind: 'replace', platform, name, target, expected });
      else conflicts.push(`${platform.name}: ${target} links outside this harness (${linkTarget})`);
    }
  }

  let installedEntries = [];
  try {
    installedEntries = await fs.readdir(platform.target, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const entry of installedEntries) {
    if (names.has(entry.name)) continue;
    const target = path.join(platform.target, entry.name);
    const linkTarget = await existingLinkTarget(target);
    if (linkTarget && isWithin(linkTarget, generatedRoot)) {
      actions.push({ kind: 'remove-obsolete', platform, name: entry.name, target });
    }
  }
}

if (conflicts.length) {
  console.error('Skill sync stopped on conflicts:');
  for (const conflict of conflicts) console.error(`- ${conflict}`);
  process.exit(1);
}

for (const action of actions) {
  console.log(`${apply ? 'APPLY' : 'WOULD'} ${action.kind}: ${action.target}`);
  if (!apply) continue;
  if (action.kind === 'replace' || action.kind === 'remove-obsolete') {
    await fs.rm(action.target, { recursive: true, force: true });
  }
  if (action.kind !== 'remove-obsolete') {
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    await fs.symlink(action.expected, action.target, type);
  }
}

console.log(`${apply ? 'Applied' : 'Planned'} skill sync: ${names.size} skills per platform, ${actions.length} changes.`);
