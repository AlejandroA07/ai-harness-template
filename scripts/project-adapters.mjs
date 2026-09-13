import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSkill, renderSkillDocuments, assertSafeDirectory } from './skill-lib.mjs';
import { readRegular } from './installation-core.mjs';

export const adapterRoot = (platform) => platform === 'claude' ? '.claude/skills' : '.agents/skills';
export async function projectTree(target, source) {
  await assertSafeDirectory(target, source);
  const files = {};
  async function walk(directory, prefix = '') {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT' && directory === source) return; throw error; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || /\.(?:pem|key|p12|pfx)$/i.test(entry.name) || /^(?:id_rsa|id_ed25519)/i.test(entry.name)) throw new Error('Hidden or sensitive skill resource requires review');
      const relative = prefix + entry.name;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { await assertSafeDirectory(source, file); await walk(file, relative + '/'); }
      else files[relative] = await readRegular(file);
    }
  }
  await walk(source);
  return files;
}
export async function projectAdapters(target, platforms) {
  const files = await projectTree(target, path.join(target, '.harness/skills'));
  if (files['SKILL.md']) throw new Error('Project skills require named subdirectories');
  let policy = [];
  if (files['invocation-policy.json']) {
    const value = JSON.parse(files['invocation-policy.json']);
    policy = value.userOnly;
    if (!Array.isArray(policy) || policy.some((id) => typeof id !== 'string')) throw new Error('Invalid project invocation policy');
  }
  const skills = Object.keys(files).filter((name) => name.endsWith('/SKILL.md')).sort();
  const names = new Set();
  const output = {};
  for (const file of skills) {
    const skill = parseSkill(files[file].toString('utf8'), file);
    if (names.has(skill.name.toLowerCase())) throw new Error('Duplicate project skill name');
    names.add(skill.name.toLowerCase());
    const prefix = file.slice(0, -'SKILL.md'.length);
    if (skills.some((other) => other !== file && other.startsWith(prefix))) throw new Error('Nested project skills require review');
    for (const platform of platforms) {
      const base = `${adapterRoot(platform)}/${skill.name}/`;
      for (const [relative, bytes] of Object.entries(files)) {
        if (relative.startsWith(prefix)) output[base + relative.slice(prefix.length)] = bytes;
      }
      for (const [relative, value] of Object.entries(renderSkillDocuments(skill, platform, policy.includes(skill.name)))) output[base + relative] = Buffer.from(value);
    }
  }
  if (policy.some((id) => !names.has(id))) throw new Error('Project invocation policy names a missing skill');
  return { files: output, source: files };
}
