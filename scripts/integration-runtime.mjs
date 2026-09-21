import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { digest, encode, payloadHash, readRegular, treeFiles } from './installation-core.mjs';
import { assertSafeDirectory } from './skill-lib.mjs';
import { resolveWindowsCli } from './windows-cli.mjs';

const execute = promisify(execFile);
const fail = (message) => { throw new Error(message); };
const expandedLimit = 100_000_000;
const fileLimit = 30_000;
const extraRuntimeCapabilities = new Set([
  'community-labeling', 'database-connectors', 'mcp', 'pr-triage',
  'remote-ingest', 'semantic-media', 'watch',
]);

export function requiredRuntimeProfile(integration, enabled) {
  if (integration.runtime.kind !== 'python-wheel') return 'runtime';
  return enabled.some((id) => extraRuntimeCapabilities.has(id)) ? 'all' : 'base';
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeArchivePath(name, root) {
  if (!name || name.includes('\\') || name.includes('\0') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    fail('Unsafe integration archive path');
  }
  const parts = name.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) fail('Unsafe integration archive path');
  if (root) {
    if (parts.shift() !== root) fail('Integration archive escaped its declared root');
    if (!parts.length) return null;
  }
  const relative = parts.join('/');
  if (!relative || relative.length > 500) fail('Unsafe integration archive path');
  return relative;
}

export function extractZip(bytes, { root = null } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22) fail('Invalid integration ZIP archive');
  const minimum = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) fail('Invalid integration ZIP directory');
  const count = bytes.readUInt16LE(eocd + 10);
  const directorySize = bytes.readUInt32LE(eocd + 12);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (count > fileLimit || directoryOffset + directorySize > eocd) fail('Oversized integration ZIP directory');
  const files = {};
  let expanded = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) fail('Invalid integration ZIP entry');
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const external = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    if ((flags & 1) || ![0, 8].includes(method) || [compressedSize, size, localOffset].includes(0xffffffff)) {
      fail('Unsupported integration ZIP entry');
    }
    const mode = external >>> 16;
    if ((mode & 0o170000) === 0o120000) fail('Integration ZIP links are not allowed');
    const nameEnd = cursor + 46 + nameLength;
    if (nameEnd + extraLength + commentLength > bytes.length) fail('Invalid integration ZIP entry length');
    const name = bytes.subarray(cursor + 46, nameEnd).toString('utf8');
    cursor = nameEnd + extraLength + commentLength;
    const relative = safeArchivePath(name, root);
    if (name.endsWith('/')) continue;
    if (relative === null || Object.hasOwn(files, relative)) fail('Duplicate integration archive entry');
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) fail('Invalid integration ZIP local entry');
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const localNameEnd = localOffset + 30 + localNameLength;
    if (localNameEnd > bytes.length
      || !bytes.subarray(localOffset + 30, localNameEnd).equals(bytes.subarray(cursor - extraLength - commentLength - nameLength, cursor - extraLength - commentLength))) {
      fail('Integration ZIP local entry name mismatch');
    }
    if (dataOffset + compressedSize > bytes.length) fail('Invalid integration ZIP payload');
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const contents = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: size });
    expanded += contents.length;
    if (contents.length !== size || expanded > expandedLimit || crc32(contents) !== expectedCrc) fail('Invalid integration ZIP content');
    files[relative] = contents;
  }
  if (!Object.keys(files).length) fail('Integration archive contains no runtime files');
  return files;
}

async function checkedResource(repository, resource) {
  const file = path.join(repository, resource.path);
  await assertSafeDirectory(repository, path.dirname(file));
  const bytes = await readRegular(file);
  if (digest(bytes) !== resource.sha256) fail(`Integration runtime resource drifted: ${resource.path}`);
  return bytes;
}

function cleanEnvironment(home, additions = {}) {
  const result = { HOME: home, USERPROFILE: home, PATH: process.env.PATH ?? '',
    SystemRoot: process.env.SystemRoot ?? '', WINDIR: process.env.WINDIR ?? '',
    TMPDIR: process.env.TMPDIR ?? '', TEMP: process.env.TEMP ?? '', TMP: process.env.TMP ?? '', ...additions };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value));
}

async function run(command, args, options) {
  try {
    return await execute(command, args, { ...options, windowsHide: true, timeout: 900_000, maxBuffer: 10_000_000 });
  } catch (error) {
    const detail = String(error.stderr ?? error.stdout ?? error.message).trim().slice(0, 1000);
    fail(`Integration runtime command failed${detail ? `: ${detail}` : ''}`);
  }
}

export function npmInvocation(hostPlatform = process.platform, resolver = resolveWindowsCli) {
  if (hostPlatform !== 'win32') return { command: 'npm', prefix: [] };
  const resolved = resolver('npm');
  if (!resolved) fail('Unable to resolve the Windows npm shim safely');
  return resolved;
}

function minimumVersion(minimumRuntime) {
  const match = minimumRuntime.match(/>=(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) fail('Invalid minimum integration runtime');
  return match.slice(1).map((value) => Number(value ?? 0));
}

function assertVersion(actual, minimumRuntime) {
  const match = actual.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) fail('Unable to determine integration runtime version');
  const found = match.slice(1).map((value) => Number(value ?? 0));
  const required = minimumVersion(minimumRuntime);
  for (let index = 0; index < 3; index++) {
    if (found[index] > required[index]) return;
    if (found[index] < required[index]) fail(`Integration requires ${minimumRuntime}`);
  }
}

async function materializeGraphify({ repository, integration, artifact, enabled, staging, python, allowNetwork }) {
  if (!allowNetwork) fail('Graphify materialization requires explicit --allow-network for hash-locked dependencies');
  if (typeof python !== 'string' || !path.isAbsolute(python)) fail('Graphify materialization requires --python <absolute-python-path>');
  const home = path.join(staging, 'home');
  const site = path.join(staging, 'site-packages');
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(site, { recursive: true });
  const version = await run(python, ['--version'], { env: cleanEnvironment(home) });
  assertVersion(`${version.stdout} ${version.stderr}`, integration.runtime.minimumRuntime);
  const profile = requiredRuntimeProfile(integration, enabled);
  const resource = integration.runtime.resources.find((entry) => entry.profile === profile);
  if (!resource) fail(`Missing Graphify ${profile} runtime lock`);
  const requirements = path.join(staging, `${profile}-requirements.txt`);
  await fs.writeFile(requirements, await checkedResource(repository, resource), { flag: 'wx', mode: 0o600 });
  await run(python, ['-m', 'pip', 'install', '--require-hashes', '--only-binary=:all:', '--no-compile',
    '--disable-pip-version-check', '--target', site, '--requirement', requirements], {
    cwd: staging,
    env: cleanEnvironment(home, { PIP_CONFIG_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null',
      PIP_INDEX_URL: 'https://pypi.org/simple', PYTHONDONTWRITEBYTECODE: '1' }),
  });
  const wheel = extractZip(artifact);
  const dependencyFiles = await treeFiles(site);
  for (const [name, contents] of Object.entries(wheel)) {
    const relative = `site-packages/${name}`;
    if (Object.hasOwn(dependencyFiles, name)) fail(`Graphify wheel collides with a dependency: ${name}`);
    await fs.mkdir(path.dirname(path.join(staging, relative)), { recursive: true });
    await fs.writeFile(path.join(staging, relative), contents, { flag: 'wx', mode: 0o600 });
  }
  await fs.rm(requirements);
  const env = cleanEnvironment(home, { PYTHONPATH: site, PYTHONDONTWRITEBYTECODE: '1', GRAPHIFY_QUERY_LOG_DISABLE: '1' });
  const probe = await run(python, ['-B', '-m', integration.runtime.module, '--version'], { cwd: staging, env });
  if (!`${probe.stdout} ${probe.stderr}`.includes(integration.runtime.version)) fail('Graphify runtime version probe failed');
  await fs.rm(home, { recursive: true, force: true });
  const files = await treeFiles(staging);
  return { files, metadata: { kind: 'python-target', command: python, profile,
    entrypoint: integration.runtime.module, hash: payloadHash(files), fileCount: Object.keys(files).length } };
}

async function materializeNpm({ repository, integration, artifact, staging, allowNetwork }) {
  if (!allowNetwork) fail(`${integration.id} materialization requires explicit --allow-network for integrity-locked dependencies`);
  assertVersion(process.version, integration.runtime.minimumRuntime);
  const home = path.join(staging, 'home');
  const cache = path.join(staging, 'npm-cache');
  await fs.mkdir(home, { recursive: true });
  const manifestResource = integration.runtime.resources.find((entry) => entry.path.endsWith('/package.json'));
  const lockResource = integration.runtime.resources.find((entry) => entry.path.endsWith('/package-lock.json'));
  const manifest = JSON.parse((await checkedResource(repository, manifestResource)).toString('utf8'));
  const lock = JSON.parse((await checkedResource(repository, lockResource)).toString('utf8'));
  const vendorName = 'vendor.tgz';
  manifest.dependencies[integration.runtime.package] = `file:${vendorName}`;
  lock.packages[''].dependencies[integration.runtime.package] = `file:${vendorName}`;
  lock.packages[`node_modules/${integration.runtime.package}`].resolved = `file:${vendorName}`;
  await fs.writeFile(path.join(staging, 'package.json'), encode(manifest), { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(staging, 'package-lock.json'), encode(lock), { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(staging, vendorName), artifact, { flag: 'wx', mode: 0o600 });
  const npm = npmInvocation();
  await run(npm.command, [...npm.prefix, 'ci', '--ignore-scripts', '--no-bin-links', '--omit=dev', '--no-audit', '--no-fund', '--cache', cache], {
    cwd: staging,
    env: cleanEnvironment(home, { NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org', NPM_CONFIG_USERCONFIG: path.join(home, '.npmrc') }),
  });
  await fs.rm(path.join(staging, vendorName));
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(cache, { recursive: true, force: true });
  const entrypoint = path.join(staging, integration.runtime.entrypoint);
  await readRegular(entrypoint);
  await run(process.execPath, ['--check', entrypoint], { cwd: staging, env: cleanEnvironment(staging) });
  const files = await treeFiles(staging);
  return { files, metadata: { kind: 'node-tree', command: process.execPath, profile: 'runtime',
    entrypoint: integration.runtime.entrypoint, hash: payloadHash(files), fileCount: Object.keys(files).length } };
}

function materializeArchive({ integration, artifact }) {
  const files = extractZip(artifact, { root: integration.provenance.artifact.root });
  if (!Object.hasOwn(files, integration.runtime.entrypoint)) fail('Archive runtime entrypoint is missing');
  return { files, metadata: { kind: 'node-tree', command: process.execPath, profile: 'runtime',
    entrypoint: integration.runtime.entrypoint, hash: payloadHash(files), fileCount: Object.keys(files).length } };
}

export async function materializeIntegrationRuntime(input) {
  if (input.integration.runtime.kind === 'release-archive') return materializeArchive(input);
  if (input.integration.runtime.kind === 'python-wheel') return await materializeGraphify(input);
  if (input.integration.runtime.kind === 'npm-package') return await materializeNpm(input);
  fail('Unsupported integration runtime materializer');
}

export function renderRuntimeCommand(entry, runtimeRoot, capability, operands, target) {
  const actions = {
    graphify: {
      'build-code': () => ['extract', target, '--code-only'],
      refresh: () => ['update', target],
      cluster: () => ['cluster-only', target],
      query: () => ['query', operands[0]],
      affected: () => ['affected', operands[0], ...operands.slice(1)],
      'god-nodes': () => ['god-nodes', ...operands],
      path: () => ['path', operands[0], operands[1]],
      explain: () => ['explain', operands[0]],
      'diagnose-multigraph': () => ['diagnose', 'multigraph', ...operands],
      export: () => ['export', ...operands],
      tree: () => ['tree', ...operands],
      benchmark: () => ['benchmark', ...operands],
      'merge-graphs': () => ['merge-graphs', ...operands],
      'semantic-media': () => ['extract', target, ...operands],
      'remote-ingest': () => ['add', ...operands],
      'database-connectors': () => ['neo4j', 'falkordb'].includes(operands[0])
        ? ['export', ...operands] : ['extract', target, ...operands],
      'community-labeling': () => ['label', target, ...operands],
      'provider-management': () => ['provider', ...operands],
      'repository-clone': () => ['clone', ...operands],
      'pr-dashboard': () => ['prs', ...operands],
      'pr-triage': () => ['prs', '--triage', ...operands],
      'semantic-update-check': () => ['check-update', target],
      watch: () => ['watch', target],
      hooks: () => ['hook', 'install'],
      mcp: () => [],
      'global-graph': () => ['global', ...operands],
      memory: () => ['save-result', ...operands],
      reflection: () => ['reflect', ...operands],
    },
    archify: {
      doctor: () => ['doctor'], validate: () => ['validate', ...operands], render: () => ['render', ...operands],
      deliver: () => ['deliver', ...operands], preview: () => ['preview', ...operands],
    },
  };
  const builder = actions[entry.id]?.[capability];
  if (!builder) fail(`No invocation contract for ${entry.id}:${capability}`);
  const args = builder();
  if (args.some((argument) => argument === undefined)) fail(`Missing operand for ${entry.id}:${capability}`);
  if (entry.runtime.kind === 'python-target') {
    const module = capability === 'mcp' ? 'graphify.serve' : entry.runtime.entrypoint;
    return { command: entry.runtime.command, args: ['-B', '-m', module, ...args],
      environment: { PYTHONPATH: path.join(runtimeRoot, 'site-packages'), PYTHONDONTWRITEBYTECODE: '1', GRAPHIFY_QUERY_LOG_DISABLE: '1' } };
  }
  return { command: entry.runtime.command, args: [path.join(runtimeRoot, entry.runtime.entrypoint), ...args], environment: {} };
}
