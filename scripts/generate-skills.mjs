import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSkillTree } from './skill-lib.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const source = path.join(root, 'skills');
const output = path.join(root, '.generated', 'skills');

const skills = await generateSkillTree(source, output);
console.log(`Generated ${skills.length} skills for Claude and Codex in ${output}`);
