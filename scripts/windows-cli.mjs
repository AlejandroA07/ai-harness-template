import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Windows tools installed through npm arrive as generated .cmd shims, which Node
// refuses to execute directly. Routing them through cmd.exe would make every
// argument shell-parsed, so resolve the shim to the JavaScript entry point it
// wraps and run that with the current Node binary instead.
const shimEntry = /"%dp0%\\(node_modules\\[^"]+?\.js)"/i;

export function resolveWindowsCli(name) {
  const lookup = spawnSync('where.exe', [name], { encoding: 'utf8' });
  if (lookup.error || lookup.status !== 0) return null;
  const candidates = lookup.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const executable = candidates.find((candidate) => candidate.toLowerCase().endsWith('.exe'));
  if (executable) return { command: executable, prefix: [] };
  const shim = candidates.find((candidate) => candidate.toLowerCase().endsWith('.cmd'));
  if (!shim) return null;
  let contents;
  try { contents = fs.readFileSync(shim, 'utf8'); } catch { return null; }
  const entry = contents.match(shimEntry);
  if (!entry) return null;
  const script = path.join(path.dirname(shim), entry[1]);
  return fs.existsSync(script) ? { command: process.execPath, prefix: [script] } : null;
}

export function runTool(command, args, options = {}) {
  if (process.platform === 'win32') {
    const resolved = resolveWindowsCli(command);
    if (resolved) return spawnSync(resolved.command, [...resolved.prefix, ...args], { encoding: 'utf8', ...options });
  }
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}
