import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolveWindowsCli, runTool } from '../scripts/windows-cli.mjs';

const windowsOnly = { skip: process.platform !== 'win32' && 'Windows shim resolution' };

test('resolves a native executable to its own path', windowsOnly, () => {
  const resolved = resolveWindowsCli('node');
  assert.ok(resolved);
  assert.deepEqual(resolved.prefix, []);
  assert.match(resolved.command.toLowerCase(), /node\.exe$/);
});

test('resolves an npm shim to the script it wraps', windowsOnly, () => {
  const resolved = resolveWindowsCli('codex');
  if (!resolved) return; // codex is optional on a given machine
  if (resolved.prefix.length === 0) return; // installed as a native binary
  assert.equal(resolved.command, process.execPath);
  assert.match(resolved.prefix[0], /\.js$/);
});

test('reports unresolvable tools instead of guessing', windowsOnly, () => {
  assert.equal(resolveWindowsCli('definitely-not-a-real-tool-xyz'), null);
});

test('arguments never reach a shell interpreter', () => {
  const result = runTool('node', ['--version', '&', 'echo', 'INJECTED']);
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  assert.doesNotMatch(output, /INJECTED/);
});

test('falls back to a direct spawn when resolution finds nothing', () => {
  const direct = spawnSync(process.execPath, ['--version'], { encoding: 'utf8' });
  const viaTool = runTool('node', ['--version']);
  assert.equal(viaTool.status, 0);
  assert.equal(viaTool.stdout.trim(), direct.stdout.trim());
});
