import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { discoverSkills, generateSkillTree, readLinkTarget } from './skill-lib.mjs';

const apply = process.argv.includes('--apply');
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const sourceRoot = path.join(root, 'skills');
const generatedRoot = path.join(root, '.generated', 'skills');
const home = os.homedir();
const archiveBase = path.join(home, '.ai-harness-skill-archive');
const skills = apply ? await generateSkillTree(sourceRoot, generatedRoot) : await discoverSkills(sourceRoot);
const names = new Set(skills.map((skill) => skill.name));

const platforms = [
  { name: 'Claude', archiveName: 'claude', source: path.join(generatedRoot, 'claude'), target: path.join(home, '.claude', 'skills') },
  { name: 'Codex', archiveName: 'codex', source: path.join(generatedRoot, 'codex'), target: path.join(home, '.agents', 'skills') },
];

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

const actionShapes = {
  'archive-and-link': { archive: ['source', 'entryName'], remove: [], link: ['source', 'target'] },
  'archive-obsolete': { archive: ['source', 'entryName'], remove: [], link: [] },
  link: { archive: [], remove: [], link: ['source', 'target'] },
  replace: { archive: [], remove: ['target'], link: ['source', 'target'] },
};

function defineAction(action) {
  const expectedShape = actionShapes[action.kind];
  if (!expectedShape) throw new Error(`Unknown skill reconciliation action: ${action.kind}`);
  for (const operation of ['archive', 'remove', 'link']) {
    const requiredFields = expectedShape[operation];
    const operationPresent = Object.hasOwn(action, operation);
    if (operationPresent !== Boolean(requiredFields.length)) {
      throw new Error(`Invalid ${action.kind} action: ${operation} operation must be ${requiredFields.length ? 'present' : 'absent'}`);
    }
    if (operationPresent && (typeof action[operation] !== 'object' || action[operation] === null || Array.isArray(action[operation]))) {
      throw new Error(`Invalid ${action.kind} action: ${operation} operation must be an object`);
    }
    for (const field of requiredFields) {
      if (typeof action[operation][field] !== 'string' || action[operation][field].length === 0) {
        throw new Error(`Invalid ${action.kind} action: ${operation}.${field} must be a non-empty string`);
      }
    }
  }
  return Object.freeze({
    ...action,
    ...(action.archive && { archive: Object.freeze(action.archive) }),
    ...(action.remove && { remove: Object.freeze(action.remove) }),
    ...(action.link && { link: Object.freeze(action.link) }),
  });
}

function linkAction({ platform, name, target, expected }) {
  return defineAction({ kind: 'link', platform, name, link: { source: expected, target } });
}

function archiveAndLinkAction({ platform, name, target, archiveEntryName, installTarget, expected }) {
  return defineAction({
    kind: 'archive-and-link',
    platform,
    name,
    archive: { source: target, entryName: archiveEntryName },
    link: { source: expected, target: installTarget },
  });
}

function replaceAction({ platform, name, target, expected }) {
  return defineAction({
    kind: 'replace',
    platform,
    name,
    remove: { target },
    link: { source: expected, target },
  });
}

function archiveObsoleteAction({ platform, name, target }) {
  return defineAction({
    kind: 'archive-obsolete',
    platform,
    name,
    archive: { source: target, entryName: name },
  });
}

const actions = [];
const conflicts = [];
for (const platform of platforms) {
  let rootStat;
  try {
    rootStat = await fs.lstat(platform.target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (rootStat && (rootStat.isSymbolicLink() || !rootStat.isDirectory())) {
    conflicts.push(`${platform.name} skill root must be absent or a real directory: ${platform.target}`);
    continue;
  }
  if (!rootStat && apply) {
    await fs.mkdir(platform.target, { recursive: true });
    rootStat = await fs.lstat(platform.target);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      conflicts.push(`${platform.name} skill root must be absent or a real directory: ${platform.target}`);
      continue;
    }
  }
  let installedEntries = [];
  try {
    installedEntries = await fs.readdir(platform.target, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const claimedEntries = new Set();
  for (const name of names) {
    const matchingEntries = installedEntries
      .filter((entry) => entry.name.toLowerCase() === name.toLowerCase())
      .sort((left, right) => Number(right.name === name) - Number(left.name === name));
    const installedEntry = matchingEntries[0];
    if (installedEntry) claimedEntries.add(installedEntry.name);
    const target = path.join(platform.target, installedEntry?.name ?? name);
    const installTarget = path.join(platform.target, name);
    const expected = path.join(platform.source, name);
    const linkTarget = await readLinkTarget(target);
    if (linkTarget === undefined) actions.push(linkAction({ platform, name, target: installTarget, expected }));
    else if (installedEntry?.name !== name) {
      const stat = await fs.lstat(target);
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        actions.push(archiveAndLinkAction({ platform, name, target, archiveEntryName: installedEntry.name, installTarget, expected }));
      } else conflicts.push(`${platform.name}: ${target} exists but is not a skill directory or link`);
    }
    else if (linkTarget === null) {
      const stat = await fs.lstat(target);
      if (stat.isDirectory()) actions.push(archiveAndLinkAction({ platform, name, target, archiveEntryName: name, installTarget, expected }));
      else conflicts.push(`${platform.name}: ${target} exists but is not a skill directory or link`);
    }
    else if (path.resolve(linkTarget) !== path.resolve(expected)) {
      if (isWithin(linkTarget, generatedRoot)) actions.push(replaceAction({ platform, name, target, expected }));
      else actions.push(archiveAndLinkAction({ platform, name, target, archiveEntryName: name, installTarget, expected }));
    }
  }

  for (const entry of installedEntries) {
    if (claimedEntries.has(entry.name) || entry.name.startsWith('.')) continue;
    const target = path.join(platform.target, entry.name);
    const stat = await fs.lstat(target);
    if (stat.isDirectory() || stat.isSymbolicLink()) {
      actions.push(archiveObsoleteAction({ platform, name: entry.name, target }));
    }
  }
}

const archiveActions = actions.filter((action) => action.archive);
if (archiveActions.length) {
  try {
    const stat = await fs.lstat(archiveBase);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      conflicts.push(`Skill archive path must be a real directory: ${archiveBase}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (conflicts.length) {
  console.error('Skill sync stopped on conflicts:');
  for (const conflict of conflicts) console.error(`- ${conflict}`);
  process.exit(1);
}

let archiveSession;
if (apply && archiveActions.length) {
  await fs.mkdir(archiveBase, { recursive: true });
  const label = `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID()}`;
  archiveSession = path.join(archiveBase, label);
  await fs.mkdir(archiveSession);
}

for (const action of actions) {
  const archiveTarget = action.archive
    ? path.join(archiveSession ?? path.join(archiveBase, '<new-session>'), action.platform.archiveName, action.archive.entryName)
    : undefined;
  const actionTarget = action.archive?.source ?? action.remove?.target ?? action.link.target;
  const linkDescription = action.link && action.link.target !== actionTarget
    ? `; link -> ${action.link.target}`
    : '';
  console.log(`${apply ? 'APPLY' : 'WOULD'} ${action.kind}: ${actionTarget}${archiveTarget ? ` -> ${archiveTarget}` : ''}${linkDescription}`);
  if (!apply) continue;
  if (archiveTarget) {
    await fs.mkdir(path.dirname(archiveTarget), { recursive: true });
    await fs.rename(action.archive.source, archiveTarget);
  } else if (action.remove) {
    await fs.unlink(action.remove.target);
  }
  if (action.link) {
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      await fs.symlink(action.link.source, action.link.target, type);
    } catch (error) {
      if (archiveTarget) {
        try { await fs.rename(archiveTarget, action.archive.source); } catch (rollbackError) {
          throw new Error(`Failed to install ${action.name} and restore its archived entry: ${error.message}; rollback failed: ${rollbackError.message}`);
        }
      }
      throw error;
    }
  }
}

console.log(`${apply ? 'Applied' : 'Planned'} skill sync: ${names.size} skills per platform, ${actions.length} changes.`);
