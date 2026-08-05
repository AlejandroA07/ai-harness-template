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

export async function renderSkill(skill, destination, platform, userOnly) {
  await copyResources(skill.directory, destination);
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
  await fs.writeFile(path.join(destination, 'SKILL.md'), `${frontmatter.join('\n')}\n${skill.body}`);

  if (platform === 'codex') {
    const agentsDirectory = path.join(destination, 'agents');
    await fs.mkdir(agentsDirectory, { recursive: true });
    const openaiYaml = [
      'interface:',
      `  display_name: ${yamlValue(titleCase(skill.name))}`,
      `  short_description: ${yamlValue(shortDescription(skill))}`,
      `  default_prompt: ${yamlValue(defaultPrompt(skill))}`,
      'policy:',
      `  allow_implicit_invocation: ${userOnly ? 'false' : 'true'}`,
      '',
    ].join('\n');
    await fs.writeFile(path.join(agentsDirectory, 'openai.yaml'), openaiYaml);
  }
}

export async function generateSkillTree(sourceRoot, outputRoot) {
  const skills = await discoverSkills(sourceRoot);
  const userOnly = await readInvocationPolicy(sourceRoot);
  const knownNames = new Set(skills.map((skill) => skill.name));
  for (const name of userOnly) {
    if (!knownNames.has(name)) throw new Error(`Invocation policy names missing skill: ${name}`);
  }

  await fs.rm(outputRoot, { recursive: true, force: true });
  for (const skill of skills) {
    await renderSkill(skill, path.join(outputRoot, 'claude', skill.name), 'claude', userOnly.has(skill.name));
    await renderSkill(skill, path.join(outputRoot, 'codex', skill.name), 'codex', userOnly.has(skill.name));
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
      if (entry.isDirectory()) await walk(path.join(current, entry.name), relative);
      else {
        hash.update(relative);
        hash.update('\0');
        hash.update(await fs.readFile(path.join(current, entry.name)));
        hash.update('\0');
      }
    }
  }
  await walk(directory);
  return hash.digest('hex');
}
