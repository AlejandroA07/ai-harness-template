import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverSkills, hashDirectory, readInvocationPolicy, renderSkill } from './skill-lib.mjs';

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

let skills = [];
try {
  skills = await discoverSkills(sourceRoot);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const userOnly = await readInvocationPolicy(sourceRoot);
const names = skills.map((skill) => skill.name);

let previous = { generated: [] };
try {
  previous = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const previouslyOwned = new Set(previous.generated ?? []);

const platforms = [
  { name: 'claude', directory: path.join(projectRoot, '.claude', 'skills') },
  { name: 'codex', directory: path.join(projectRoot, '.agents', 'skills') },
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

for (const platform of platforms) {
  for (const name of names) {
    const target = path.join(platform.directory, name);
    if (await exists(target) && !previouslyOwned.has(name)) {
      throw new Error(`Refusing to overwrite unowned adapter: ${target}`);
    }
  }
}

if (check) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-project-skills-'));
  try {
    let failed = false;
    for (const platform of platforms) {
      for (const skill of skills) {
        const expected = path.join(temporary, platform.name, skill.name);
        await renderSkill(skill, expected, platform.name, userOnly.has(skill.name));
        const actual = path.join(platform.directory, skill.name);
        if (!(await exists(actual)) || await hashDirectory(expected) !== await hashDirectory(actual)) {
          console.error(`Generated adapter is missing or stale: ${actual}`);
          failed = true;
        }
      }
    }
    const manifestNames = [...previouslyOwned].sort();
    if (JSON.stringify(manifestNames) !== JSON.stringify([...names].sort())) {
      console.error(`Generated skill manifest is stale: ${manifestPath}`);
      failed = true;
    }
    if (failed) process.exitCode = 1;
    else console.log(`Project skill adapters are current: ${names.length} skills.`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
} else {
  for (const platform of platforms) {
    await fs.mkdir(platform.directory, { recursive: true });
    for (const oldName of previouslyOwned) {
      if (!names.includes(oldName)) {
        await fs.rm(path.join(platform.directory, oldName), { recursive: true, force: true });
      }
    }
    for (const skill of skills) {
      const target = path.join(platform.directory, skill.name);
      await fs.rm(target, { recursive: true, force: true });
      await renderSkill(skill, target, platform.name, userOnly.has(skill.name));
    }
  }
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify({ generated: [...names].sort() }, null, 2)}\n`);
  console.log(`Generated project adapters: ${names.length} skills.`);
}
