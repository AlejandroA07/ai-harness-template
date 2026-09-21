import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { parseSkill } from './skill-lib.mjs';
import { validateOwnershipManifest } from './upstream-skills.mjs';
import { validateCatalog } from './module-catalog.mjs';

// All paths originate in the validated catalog or these fixed metadata locations.
async function inspectPath(root, relative) {
  let current = root;
  let stat;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error(`Unsafe catalog source: ${relative}`);
  }
  return stat;
}

async function readFile(root, relative) {
  if (!(await inspectPath(root, relative)).isFile()) throw new Error(`Expected catalog file: ${relative}`);
  const handle = await fs.open(path.join(root, relative), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Unsafe catalog file: ${relative}`);
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}

async function filesUnder(root, relative) {
  if (!(await inspectPath(root, relative)).isDirectory()) throw new Error(`Expected catalog directory: ${relative}`);
  const files = [];
  for (const name of (await fs.readdir(path.join(root, relative))).sort()) {
    const child = `${relative}/${name}`;
    const stat = await inspectPath(root, child);
    if (stat.isDirectory()) files.push(...await filesUnder(root, child));
    else files.push(child);
  }
  return files;
}

export async function loadCatalog(repositoryRoot) {
  const root = await fs.realpath(repositoryRoot);
  const catalog = validateCatalog(JSON.parse(await readFile(root, 'catalog/modules.json')));
  for (const capability of catalog.capabilities) {
    if (['description', 'activation', 'provenance'].some((field) => Object.hasOwn(capability, field))) {
      throw new Error('Descriptions, activation and provenance must come from canonical sources');
    }
  }
  for (const module of catalog.modules) {
    for (const source of module.sources) await inspectPath(root, source);
    for (const behavior of module.behaviors) {
      if (!(await inspectPath(root, behavior.source)).isFile()) throw new Error(`Expected module behavior source file: ${behavior.source}`);
      if (behavior.activation.program && !(await inspectPath(root, behavior.activation.program)).isFile()) {
        throw new Error(`Expected module behavior program file: ${behavior.activation.program}`);
      }
    }
  }
  const policy = JSON.parse(await readFile(root, 'skills/invocation-policy.json'));
  if (!policy || Object.keys(policy).some((key) => key !== 'userOnly') || !Array.isArray(policy.userOnly)
    || policy.userOnly.some((name) => typeof name !== 'string')
    || new Set(policy.userOnly).size !== policy.userOnly.length) throw new Error('Invalid invocation policy');
  const ownership = JSON.parse(await readFile(root, 'skills/upstream-sources.json'));
  validateOwnershipManifest(ownership);
  const sourceFiles = await filesUnder(root, 'skills');
  const discovered = sourceFiles.filter((file) => file.endsWith('/SKILL.md')).sort();
  const declared = catalog.capabilities.map((capability) => capability.source).sort();
  if (JSON.stringify(discovered) !== JSON.stringify(declared)) throw new Error('Catalog must classify every canonical capability exactly once');
  const names = new Set(catalog.capabilities.map((capability) => capability.id));
  if (policy.userOnly.some((name) => !names.has(name))) throw new Error('Invocation policy references an unknown capability');
  if (JSON.stringify(Object.keys(ownership.skills).sort()) !== JSON.stringify([...names].sort())) throw new Error('Provenance inventory differs from catalog');
  for (const capability of catalog.capabilities) {
    const skill = parseSkill(await readFile(root, capability.source), capability.source);
    if (skill.name !== capability.id) throw new Error('Catalog ID must retain the canonical discovery name');
    const prefix = capability.source.slice(0, -'SKILL.md'.length);
    const resources = sourceFiles.filter((file) => file.startsWith(prefix) && file !== capability.source).sort();
    if (JSON.stringify(resources) !== JSON.stringify([...capability.resources].sort())) throw new Error(`Resource inventory differs for ${capability.id}`);
    const owner = ownership.skills[capability.provenanceRef];
    capability.description = skill.description;
    capability.activation = policy.userOnly.includes(skill.name) ? 'user-only' : 'model-or-user';
    capability.provenance = owner.mode === 'local' ? { mode: 'local' } : { ...owner, repository: ownership.repository };
  }
  return validateCatalog(catalog);
}
