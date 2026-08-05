import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolveWindowsCandidates, resolveWindowsCli, runTool } from '../scripts/windows-cli.mjs';

const windowsOnly = { skip: process.platform !== 'win32' && 'Windows shim resolution' };

test('resolves a native executable to its own path', windowsOnly, () => {
  const resolved = resolveWindowsCli('node');
  assert.ok(resolved);
  assert.deepEqual(resolved.prefix, []);
  assert.match(resolved.command.toLowerCase(), /node\.exe$/);
});

test('resolves npm and Corepack shims to their JavaScript entry points', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-cli-shims-'));
  try {
    const npmShim = path.join(temporary, 'npm.cmd');
    const npmEntry = path.join(temporary, 'node_modules', 'npm', 'bin', 'npm-cli.js');
    fs.mkdirSync(path.dirname(npmEntry), { recursive: true });
    fs.writeFileSync(npmEntry, '');
    fs.writeFileSync(npmShim, '"%dp0%\\node_modules\\npm\\bin\\npm-cli.js" %*\n');

    const corepackDirectory = path.join(temporary, 'corepack', 'bin', 'fallback');
    const pnpmShim = path.join(corepackDirectory, 'pnpm.cmd');
    const pnpmEntry = path.join(temporary, 'corepack', 'node', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs');
    fs.mkdirSync(path.dirname(pnpmShim), { recursive: true });
    fs.mkdirSync(path.dirname(pnpmEntry), { recursive: true });
    fs.writeFileSync(pnpmEntry, '');
    fs.writeFileSync(pnpmShim, '"%~dp0..\\..\\node\\bin\\node.exe" "%~dp0..\\..\\node\\node_modules\\pnpm\\bin\\pnpm.mjs" %*\n');

    for (const [shim, entry] of [[npmShim, npmEntry], [pnpmShim, pnpmEntry]]) {
      assert.deepEqual(resolveWindowsCandidates([shim]), {
        command: process.execPath,
        prefix: [fs.realpathSync(entry)],
      });
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('preserves PATH order between command shims and native executables', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-cli-order-'));
  try {
    const shim = path.join(temporary, 'first', 'tool.cmd');
    const entry = path.join(temporary, 'first', 'node_modules', 'tool', 'cli.cjs');
    const executable = path.join(temporary, 'second', 'tool.exe');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(entry, '');
    fs.writeFileSync(executable, '');
    fs.writeFileSync(shim, '"%dp0%\\node_modules\\tool\\cli.cjs" %*\n');

    assert.deepEqual(resolveWindowsCandidates([shim, executable]), {
      command: process.execPath,
      prefix: [fs.realpathSync(entry)],
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('does not bypass an unsupported earlier shim for a later executable', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-cli-shadow-'));
  try {
    const shim = path.join(temporary, 'first', 'tool.cmd');
    const executable = path.join(temporary, 'second', 'tool.exe');
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(shim, '@echo unsupported\n');
    fs.writeFileSync(executable, '');

    assert.equal(resolveWindowsCandidates([shim, executable]), null);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('rejects shim entry points that escape node_modules', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-cli-traversal-'));
  try {
    const shim = path.join(temporary, 'bin', 'tool.cmd');
    const outside = path.join(temporary, 'outside', 'evil.js');
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, '');
    fs.writeFileSync(shim, '"%dp0%\\node_modules\\..\\..\\outside\\evil.js" %*\n');

    assert.equal(resolveWindowsCandidates([shim]), null);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('rejects shim entry points that leave node_modules through a link', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-cli-link-'));
  try {
    const shim = path.join(temporary, 'bin', 'tool.cmd');
    const outsideDirectory = path.join(temporary, 'outside');
    const outside = path.join(outsideDirectory, 'tool', 'evil.js');
    const modulesLink = path.join(temporary, 'bin', 'node_modules');
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, '');
    fs.symlinkSync(outsideDirectory, modulesLink, process.platform === 'win32' ? 'junction' : 'dir');
    fs.writeFileSync(shim, '"%dp0%\\node_modules\\tool\\evil.js" %*\n');

    assert.equal(resolveWindowsCandidates([shim]), null);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('rejects command lookup syntax outside the tool-name allowlist', () => {
  for (const name of ['node*', '..\\node', 'node/calc', 'node & calc']) assert.equal(resolveWindowsCli(name), null);
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
