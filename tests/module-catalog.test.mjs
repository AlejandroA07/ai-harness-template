import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { loadCatalog } from '../scripts/catalog-loader.mjs';
import { planSelection, validateCatalog } from '../scripts/module-catalog.mjs';
import { discoverSkills, readInvocationPolicy } from '../scripts/skill-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = await loadCatalog(root);
const select = (ids, extra = {}) => ({ ids, modules: [], platforms: ['codex'], scope: 'machine', ...extra });
const names = (plan) => plan.capabilities.map((entry) => entry.id);
function freeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return value;
}

test('catalog retains all 22 capabilities, resources, provenance and canonical activation settings', async () => {
  const skills = await discoverSkills(path.join(root, 'skills'));
  const policy = await readInvocationPolicy(path.join(root, 'skills'));
  assert.equal(catalog.version, 1);
  assert.equal(catalog.modules.filter((module) => module.visibility === 'public').length, 5);
  assert.equal(catalog.modules.filter((module) => module.visibility === 'internal').length, 2);
  assert.equal(catalog.capabilities.length, 22);
  assert.equal(catalog.capabilities.filter((entry) => entry.module === 'skills').length, 13);
  assert.deepEqual(catalog.capabilities.filter((entry) => entry.module === 'workflows').map((entry) => entry.id),
    ['ask-alfred', 'grill-me', 'grill-with-docs', 'implement', 'improve-codebase-architecture', 'teach', 'to-spec', 'to-tickets', 'wayfinder']);
  for (const skill of skills) {
    const entry = catalog.capabilities.find((entry) => entry.id === skill.name);
    assert.equal(entry.description, skill.description);
    assert.equal(entry.activation, policy.has(skill.name) ? 'user-only' : 'model-or-user');
    assert.equal(entry.source, `${path.relative(root, skill.directory).split(path.sep).join('/')}/SKILL.md`);
    assert.ok(['local', 'adapted', 'exact'].includes(entry.provenance.mode));
  }
  assert.ok(catalog.capabilities.find((entry) => entry.id === 'diagnosing-bugs').resources.some((resource) => resource.endsWith('.ps1')));
});

test('single capability plans stay narrow on each supported platform and scope', () => {
  for (const platform of ['claude', 'codex']) for (const scope of ['machine', 'project']) {
    const plan = planSelection(catalog, select(['research'], { platforms: [platform], scope }));
    assert.deepEqual(names(plan), ['research']);
    assert.equal(plan.discoveryEntries.length, 1);
    assert.equal(plan.discoveryEntries[0].platform, platform);
    assert.equal(plan.discoveryEntries[0].scope, scope);
    assert.equal(plan.inventoryPolicy, 'coexistence');
    assert.equal(plan.targetPreflight, 'not-performed');
    assert.equal(plan.applicable, false);
  }
});

test('required dependencies are ordered first while conditional use and routes stay optional', () => {
  const plan = planSelection(catalog, select(['implement']));
  assert.deepEqual(names(plan), ['code-review', 'tdd', 'implement']);
  assert.deepEqual(plan.capabilities[0].requiredBy, ['implement']);
  assert.equal(plan.capabilities[2].conditionalUses[0].id, 'security-checklist');
  assert.equal(plan.capabilities[2].conditionalUses[0].included, false);
  assert.equal(plan.capabilities[2].activation.mode, 'user-only');
  assert.equal(plan.capabilities[2].activation.provenance, 'source-derived');
  assert.equal(plan.relationshipProvenance.dependencies.kind, 'declared');
  assert.equal(plan.relationshipProvenance.containment.kind, 'declared');
  assert.equal(plan.relationshipProvenance.activation.source, 'skills/invocation-policy.json');
  assert.equal(plan.capabilities[2].requires[0].provenance, 'declared');
  assert.ok(plan.capabilities[2].prerequisites.some((text) => text.includes('node scripts/verify.mjs')));
  assert.deepEqual(names(planSelection(catalog, select(['grill-with-docs']))), ['domain-modeling', 'grilling', 'grill-with-docs']);
  const router = planSelection(catalog, select(['ask-alfred']));
  assert.deepEqual(names(router), ['ask-alfred']);
  assert.equal(router.capabilities[0].routes.length, 21);
  assert.ok(router.capabilities[0].routes.every((route) => !route.included));
  const wayfinder = planSelection(catalog, select(['wayfinder']));
  assert.deepEqual(names(wayfinder), ['domain-modeling', 'grilling', 'wayfinder']);
  assert.deepEqual(wayfinder.capabilities.at(-1).conditionalUses.map((use) => use.id), ['research', 'prototype']);
  const stages = wayfinder.capabilities.at(-1).workflow.stages;
  assert.match(stages.find((stage) => stage.id === 'chart-map').when, /Stop after charting/);
  assert.match(stages.find((stage) => stage.id === 'discuss-decision').when, /grilling ticket/);
  assert.match(stages.find((stage) => stage.id === 'record-resolution').when, /after the selected ticket is resolved/);
});

test('every workflow declares ordered stages, invoked capabilities, approvals and artifacts', () => {
  for (const capability of catalog.capabilities.filter((entry) => entry.module === 'workflows')) {
    assert.ok(capability.workflow.stages.length > 0, capability.id);
  }
  const plan = planSelection(catalog, select(['to-spec', 'to-tickets', 'teach']));
  const spec = plan.capabilities.find((entry) => entry.id === 'to-spec').workflow;
  assert.deepEqual(spec.stages.map((stage) => stage.id), ['explore', 'confirm-test-seams', 'publish']);
  assert.match(spec.stages[1].approval, /user confirms/i);
  assert.deepEqual(spec.stages[2].artifacts, ['ready-for-agent specification']);
  const tickets = plan.capabilities.find((entry) => entry.id === 'to-tickets').workflow;
  assert.match(tickets.stages[1].approval, /user approves/i);
  assert.ok(tickets.stages[2].artifacts.includes('ticket blocking relationships'));
  const teach = plan.capabilities.find((entry) => entry.id === 'teach').workflow;
  assert.ok(teach.stages.flatMap((stage) => stage.artifacts).includes('learning record Markdown'));
  assert.equal(spec.provenance, 'declared');
});

test('shared and transitive dependencies produce one discovery entry per platform without mutating input', () => {
  const fixture = structuredClone(catalog);
  fixture.capabilities.find((entry) => entry.id === 'grilling').requires = ['domain-modeling'];
  freeze(fixture);
  const selection = freeze(select(['grill-with-docs', 'grill-me'], { platforms: ['codex', 'claude'] }));
  const plan = planSelection(fixture, selection);
  assert.deepEqual(names(plan), ['domain-modeling', 'grilling', 'grill-me', 'grill-with-docs']);
  assert.equal(plan.discoveryEntries.length, 8);
  assert.equal(new Set(plan.discoveryEntries.map((entry) => `${entry.platform}/${entry.id}`)).size, 8);
  assert.deepEqual(planSelection(fixture, select(['grill-me', 'grill-with-docs'], { platforms: ['claude', 'codex'] })), plan);
  assert.deepEqual(plan.capabilities.find((entry) => entry.id === 'domain-modeling').requiredBy, ['grill-with-docs', 'grilling']);
});

test('module selection expands members and resolves dependencies without changing full-profile commands', () => {
  const plan = planSelection(catalog, select([], { modules: ['skills', 'workflows'], platforms: ['claude', 'codex'] }));
  assert.equal(plan.capabilities.length, 22);
  assert.equal(plan.discoveryEntries.length, 44);
  const workflows = planSelection(catalog, select([], { modules: ['workflows'] }));
  assert.ok(names(workflows).includes('tdd'));
  assert.ok(names(workflows).includes('grilling'));
  assert.ok(!names(workflows).includes('security-checklist'));
  assert.throws(() => planSelection(catalog, select([], { modules: ['tool-integrations'] })), /no M1 capability definitions/);
});

test('invalid IDs, cycles, schema, discovery collisions and unsafe catalog paths are rejected', () => {
  const cases = [
    (value) => { value.version = 2; },
    (value) => { value.unexpected = true; },
    (value) => { value.modules[0].scopes = ['unknown']; },
    (value) => { value.modules[0].sources = ['../outside']; },
    (value) => { value.capabilities[0].id = '../escape'; },
    (value) => { value.capabilities[1].id = value.capabilities[0].id; },
    (value) => { value.capabilities[1].source = value.capabilities[0].source; },
    (value) => { value.capabilities[0].module = 'unknown'; },
    (value) => { value.capabilities[0].requires = ['unknown']; },
    (value) => { value.capabilities[0].routes = ['unknown']; },
    (value) => { value.capabilities[0].uses = [{ id: 'research', when: '' }]; },
    (value) => { value.capabilities[0].requires = [value.capabilities[0].id]; },
    (value) => { value.capabilities[0].routes = []; value.capabilities[0].requires = [value.capabilities[1].id]; value.capabilities[1].requires = [value.capabilities[0].id]; },
    (value) => { value.capabilities[0].source = 'skills/../outside/SKILL.md'; },
    (value) => { value.capabilities[0].source = 'C:\\outside\\SKILL.md'; },
    (value) => { value.capabilities[0].resources = ['scripts/setup.mjs']; },
    (value) => { value.capabilities[0].resources = ['skills/engineering/ask-alfred/../outside']; },
    (value) => { value.capabilities[0].provenanceRef = 'research'; },
    (value) => { delete value.capabilities.find((entry) => entry.module === 'workflows').workflow; },
    (value) => { value.capabilities.find((entry) => entry.module === 'skills').workflow = { stages: [] }; },
    (value) => { value.capabilities.find((entry) => entry.module === 'workflows').workflow.stages = []; },
    (value) => { value.capabilities.find((entry) => entry.module === 'workflows').workflow.stages[0].unexpected = true; },
    (value) => { value.capabilities.find((entry) => entry.id === 'implement').workflow.stages[0].invokes = ['unknown']; },
    (value) => { value.capabilities.find((entry) => entry.id === 'implement').workflow.stages[1].invokes = []; },
  ];
  for (const mutate of cases) {
    const fixture = structuredClone(catalog);
    mutate(fixture);
    assert.throws(() => validateCatalog(fixture), undefined, mutate.toString());
  }
  const routes = structuredClone(catalog);
  routes.capabilities.find((entry) => entry.id === 'research').routes = ['ask-alfred'];
  assert.doesNotThrow(() => validateCatalog(routes), 'Recommendation cycles are not installation cycles');
});

test('unsupported selections and unsupported required dependencies fail closed', () => {
  for (const selection of [select([]), select(['unknown']), select(['research', 'research']),
    select(['research'], { platforms: ['unknown'] }), select(['research'], { scope: 'global' }),
    select([], { modules: ['unknown'] }), select([], { modules: ['installation-core'] })]) {
    assert.throws(() => planSelection(catalog, selection));
  }
  const fixture = structuredClone(catalog);
  fixture.capabilities.find((entry) => entry.id === 'tdd').platforms = ['claude'];
  assert.throws(() => planSelection(fixture, select(['implement'])), /Unsupported platform\/scope/);
  fixture.capabilities.find((entry) => entry.id === 'tdd').scopes = ['project'];
  assert.throws(() => planSelection(fixture, select(['implement'], { platforms: ['claude'] })), /Unsupported platform\/scope/);
});

async function fixtureRepository() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-selection-'));
  const repository = path.join(temporary, 'repository with spaces');
  for (const directory of ['catalog', 'skills', 'scripts', 'global', 'project', 'components']) {
    await fs.cp(path.join(root, directory), path.join(repository, directory), { recursive: true });
  }
  return { temporary, repository };
}
async function snapshot(directory) {
  const result = {};
  async function walk(current, relative) {
    const children = await fs.readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const childPath = path.join(current, child.name);
      const childRelative = `${relative}/${child.name}`;
      if (child.isSymbolicLink()) {
        result[childRelative] = { link: await fs.readlink(childPath) };
      } else if (child.isDirectory()) {
        await walk(childPath, childRelative);
      } else {
        const handle = await fs.open(childPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          const stat = await handle.stat();
          result[childRelative] = {
            bytes: (await handle.readFile()).toString('base64'),
            mode: stat.mode,
            mtime: stat.mtimeMs,
          };
        } finally {
          await handle.close();
        }
      }
    }
    const stat = await fs.stat(current);
    result[relative] = { directory: true, mode: stat.mode, mtime: stat.mtimeMs };
  }
  await walk(directory, '');
  return result;
}

test('list, plan and rejected CLI operations write nothing or invoke external tools', async () => {
  const { temporary, repository } = await fixtureRepository();
  try {
    const home = path.join(temporary, 'fake-home');
    const emptyPath = path.join(temporary, 'no-tools');
    await fs.mkdir(home);
    await fs.mkdir(emptyPath);
    await fs.mkdir(path.join(repository, '.generated'));
    await fs.writeFile(path.join(repository, '.generated', 'sentinel'), 'Previous generated content');
    await fs.writeFile(path.join(home, 'sentinel'), 'Unrelated user content');
    const before = await snapshot(temporary);
    const run = (...args) => spawnSync(process.execPath, [path.join(repository, 'scripts/setup.mjs'), ...args], {
      cwd: home, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, PATH: emptyPath },
    });
    const listing = run('list', '--json');
    assert.equal(listing.status, 0, listing.stderr);
    assert.equal(JSON.parse(listing.stdout).capabilities.length, 22);
    const plan = run('plan', '--select', 'implement', '--platform', 'codex', '--scope', 'machine', '--json');
    assert.equal(plan.status, 0, plan.stderr);
    assert.deepEqual(names(JSON.parse(plan.stdout)), ['code-review', 'tdd', 'implement']);
    assert.equal(run('plan', '--select', 'research', '--platform', 'both', '--scope', 'project').status, 0);
    for (const args of [['apply'], ['remove'], ['audit'], ['plan', '--apply'], ['list', '--select', 'research'],
      ['plan', '--select'], ['plan', '--select', 'research'],
      ['plan', '--select', 'unknown', '--platform', 'codex', '--scope', 'machine'],
      ['plan', '--select', 'research', '--platform', 'codex', '--platform', 'claude', '--scope', 'machine']]) {
      const rejected = run(...args);
      assert.notEqual(rejected.status, 0, args.join(' '));
      assert.equal(rejected.stdout, '');
    }
    assert.deepEqual(await snapshot(temporary), before);
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});

test('catalog loading detects missing classification, omitted resources, changed names and linked source roots', async () => {
  for (const kind of ['missing-capability', 'omitted-resource', 'name-drift', 'linked-root', 'linked-resource', 'missing-module-source']) {
    const { temporary, repository } = await fixtureRepository();
    try {
      const manifestPath = path.join(repository, 'catalog/modules.json');
      const definition = JSON.parse(await fs.readFile(manifestPath));
      if (kind === 'missing-capability') definition.capabilities.pop();
      if (kind === 'omitted-resource') definition.capabilities.find((entry) => entry.id === 'teach').resources.pop();
      if (kind === 'missing-module-source') definition.modules[0].sources = ['global/missing'];
      await fs.writeFile(manifestPath, JSON.stringify(definition));
      if (kind === 'name-drift') {
        const file = path.join(repository, 'skills/engineering/research/SKILL.md');
        await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('name: research', 'name: renamed'));
      }
      if (kind === 'linked-root') {
        const source = path.join(repository, 'skills');
        const outside = path.join(temporary, 'outside');
        await fs.rename(source, outside);
        await fs.symlink(outside, source, process.platform === 'win32' ? 'junction' : 'dir');
      }
      if (kind === 'linked-resource') {
        const outside = path.join(temporary, 'outside');
        await fs.mkdir(outside);
        await fs.writeFile(path.join(outside, 'sentinel'), 'Keep me');
        await fs.symlink(outside, path.join(repository, 'skills/engineering/research/linked'), process.platform === 'win32' ? 'junction' : 'dir');
      }
      const before = await snapshot(temporary);
      await assert.rejects(loadCatalog(repository), undefined, kind);
      assert.deepEqual(await snapshot(temporary), before);
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  }
});
