import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runTool } from './windows-cli.mjs';

const root = path.resolve(import.meta.dirname, '..');
const defaultConfig = path.join(root, 'global', 'claude-tools.json');

export async function loadClaudeToolConfig(file = defaultConfig) {
  const value = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'tools,version' || value.version !== 1
    || !Array.isArray(value.tools) || value.tools.length === 0
    || value.tools.some((tool) => typeof tool !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(tool))
    || new Set(value.tools).size !== value.tools.length) {
    throw new Error('Invalid Claude tool configuration');
  }
  return value;
}

export function claudeLaunchArgs(tools, args) {
  if (args.includes('--tools')) throw new Error('Edit global/claude-tools.json instead of passing a second --tools option');
  return ['--tools', tools.join(','), ...args];
}

async function main() {
  const config = await loadClaudeToolConfig();
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--print-tools') {
    process.stdout.write(`${config.tools.join('\n')}\n`);
    return;
  }
  const result = runTool('claude', claudeLaunchArgs(config.tools, args), { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Claude launcher: ${error.message}`);
    process.exitCode = 1;
  });
}
