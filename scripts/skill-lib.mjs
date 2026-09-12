import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function yamlValue(value) {
  return JSON.stringify(value);
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

export function parseSkill(markdown, filePath) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`Missing YAML frontmatter: ${filePath}`);

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (field) metadata[field[1]] = parseScalar(field[2]);
  }

  if (!metadata.name || !metadata.description) {
    throw new Error(`Skill requires name and description: ${filePath}`);
  }
  if (!/^[a-z0-9-]{1,64}$/.test(metadata.name)) {
    throw new Error(`Invalid skill name '${metadata.name}': ${filePath}`);
  }

  return {
    name: metadata.name,
    description: metadata.description,
    argumentHint: metadata['argument-hint'],
    body: markdown.slice(match[0].length).replaceAll('\r\n', '\n'),
  };
}

export async function discoverSkills(sourceRoot) {
  const found = [];

  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      const skillFile = path.join(child, 'SKILL.md');
      try {
        const markdown = await fs.readFile(skillFile, 'utf8');
        found.push({ directory: child, ...parseSkill(markdown, skillFile) });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await walk(child);
      }
    }
  }

  await walk(sourceRoot);
  found.sort((left, right) => left.name.localeCompare(right.name));

  const names = new Set();
  for (const skill of found) {
    if (names.has(skill.name)) throw new Error(`Duplicate skill name: ${skill.name}`);
    names.add(skill.name);
  }
  return found;
}

export async function readInvocationPolicy(sourceRoot) {
  const policyPath = path.join(sourceRoot, 'invocation-policy.json');
  try {
    const policy = JSON.parse(await fs.readFile(policyPath, 'utf8'));
    return new Set(policy.userOnly ?? []);
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

export async function readLinkTarget(target) {
  try {
    const stat = await fs.lstat(target);
    if (!stat.isSymbolicLink()) return null;
    const value = await fs.readlink(target);
    return path.resolve(path.dirname(target), value);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function canonicalPath(filePath) {
  let current = path.resolve(filePath);
  const missingSegments = [];

  while (true) {
    try {
      const resolved = await fs.realpath(current);
      return path.join(resolved, ...missingSegments.reverse());
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(filePath);
      missingSegments.push(path.basename(current));
      current = parent;
    }
  }
}

export async function isPathWithin(candidate, parent) {
  const [canonicalCandidate, canonicalParent] = await Promise.all([
    canonicalPath(candidate),
    canonicalPath(parent),
  ]);
  const relative = path.relative(canonicalParent, canonicalCandidate);
  return relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export async function inspectManagedSkillLink(target, expected) {
  const linkTarget = await readLinkTarget(target);
  if (linkTarget === undefined) return 'missing';
  if (linkTarget === null) return 'not-link';
  if (path.resolve(linkTarget) !== path.resolve(expected)) return 'unexpected';
  try {
    const resolved = await fs.stat(target);
    await fs.access(path.join(target, 'SKILL.md'));
    return resolved.isDirectory() ? 'valid' : 'broken';
  } catch (error) {
    if (error.code === 'ENOENT') return 'broken';
    throw error;
  }
}

function titleCase(name) {
  return name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function shortDescription(skill) {
  const firstSentence = skill.description.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '');
  const fallback = `Reusable workflow for ${titleCase(skill.name)}`;
  const value = firstSentence.length >= 25 ? firstSentence : fallback;
  return value.length <= 64 ? value : `${value.slice(0, 61).trimEnd()}...`;
}

function defaultPrompt(skill) {
  const action = skill.description.replace(/[.!?]+$/, '');
  const lowerAction = action.charAt(0).toLowerCase() + action.slice(1);
  return `Use $${skill.name} to ${lowerAction}.`;
}

async function copyResources(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.name === 'SKILL.md' || entry.name === 'agents' || entry.name === 'README.md') continue;
    await fs.cp(path.join(source, entry.name), path.join(destination, entry.name), { recursive: true });
  }
}

export function renderSkillDocuments(skill, platform, userOnly) {
  const documents = {};
  const frontmatter = [
    '---',
    `name: ${skill.name}`,
    `description: ${yamlValue(skill.description)}`,
  ];
  if (platform === 'claude' && userOnly) frontmatter.push('disable-model-invocation: true');
  if (platform === 'claude' && skill.argumentHint) {
    frontmatter.push(`argument-hint: ${yamlValue(skill.argumentHint)}`);
  }
  frontmatter.push('---', '');
  documents['SKILL.md'] = `${frontmatter.join('\n')}\n${skill.body}`;

  if (platform === 'codex') {
    const openaiYaml = [
      'interface:',
      `  display_name: ${yamlValue(titleCase(skill.name))}`,
      `  short_description: ${yamlValue(shortDescription(skill))}`,
      `  default_prompt: ${yamlValue(defaultPrompt(skill))}`,
      'policy:',
      `  allow_implicit_invocation: ${userOnly ? 'false' : 'true'}`,
      '',
    ].join('\n');
    documents['agents/openai.yaml'] = openaiYaml;
  }
  return documents;
}

export async function renderSkill(skill, destination, platform, userOnly) {
  await copyResources(skill.directory, destination);
  for (const [relative, content] of Object.entries(renderSkillDocuments(skill, platform, userOnly))) {
    const file = path.join(destination, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
}

export async function generateSkillTree(sourceRoot, outputRoot) {
  const skills = await discoverSkills(sourceRoot);
  const userOnly = await readInvocationPolicy(sourceRoot);
  const knownNames = new Set(skills.map((skill) => skill.name));
  for (const name of userOnly) {
    if (!knownNames.has(name)) throw new Error(`Invocation policy names missing skill: ${name}`);
  }

  await assertSafeDirectory(path.dirname(outputRoot), outputRoot);
  let stagingParent = path.dirname(outputRoot);
  while (true) {
    try { await fs.access(stagingParent); break; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      stagingParent = path.dirname(stagingParent);
    }
  }
  const staging = await fs.mkdtemp(path.join(stagingParent, '.skill-generation-'));
  const payload = path.join(staging, 'payload');
  const backup = path.join(staging, 'previous');
  let moved = false;
  try {
    await fs.mkdir(payload);
    for (const skill of skills) {
      await assertRegularTree(skill.directory);
      await renderSkill(skill, path.join(payload, 'claude', skill.name), 'claude', userOnly.has(skill.name));
      await renderSkill(skill, path.join(payload, 'codex', skill.name), 'codex', userOnly.has(skill.name));
    }
    await assertSafeDirectory(path.dirname(outputRoot), outputRoot);
    await fs.mkdir(path.dirname(outputRoot), { recursive: true });
    try { await fs.rename(outputRoot, backup); moved = true; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try { await fs.rename(payload, outputRoot); } catch (error) {
      if (moved) {
        try { await fs.rename(backup, outputRoot); moved = false; } catch (rollbackError) {
          throw new Error(`Generation failed; previous output retained at ${backup}: ${rollbackError.message}`, { cause: error });
        }
      }
      throw error;
    }
    moved = false;
  } finally {
    // Retain the backup if restoring it failed.
    if (!moved) await fs.rm(staging, { recursive: true, force: true });
  }
  return skills;
}

export async function hashDirectory(directory) {
  const hash = crypto.createHash('sha256');
  async function walk(current, prefix = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) {
        hash.update(`directory\0${relative}\0`);
        await walk(path.join(current, entry.name), relative);
      }
      else {
        hash.update('file\0');
        hash.update(relative);
        hash.update('\0');
        hash.update(crypto.createHash('sha256').update(await fs.readFile(path.join(current, entry.name))).digest());
        hash.update('\0');
      }
    }
  }
  await walk(directory);
  return hash.digest('hex');
}

// Reject linked roots and descendants while tolerating OS aliases above the anchor.
export async function assertSafeDirectory(anchor, directory) {
  const relative = path.relative(anchor, directory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Directory escapes its approved root');
  }
  let current = anchor;
  for (const segment of ['', ...relative.split(path.sep).filter(Boolean)]) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error(`Skill root must be absent or a real directory: ${current}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

export async function assertRegularTree(directory) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe adapter directory: ${directory}`);
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) await assertRegularTree(child);
    else if (!entry.isFile()) throw new Error(`Unsafe adapter resource: ${child}`);
  }
}
