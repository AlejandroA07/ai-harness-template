import fs from 'node:fs/promises';
import path from 'node:path';

const normalized = (value) => value.replaceAll('\\', '/');

export function detectDomainSignals(relativeFiles, packageJson = {}) {
  const files = new Set(relativeFiles.map(normalized));
  const signals = [];

  if (files.has('pnpm-workspace.yaml')) signals.push('pnpm workspace');
  if (Array.isArray(packageJson.workspaces) || packageJson.workspaces?.packages) signals.push('package.json workspaces');
  for (const marker of ['nx.json', 'turbo.json', 'lerna.json']) if (files.has(marker)) signals.push(marker);

  const nodeProjects = relativeFiles.filter((file) => /^(?:apps|packages|services)\/[^/]+\/package\.json$/i.test(normalized(file)));
  if (nodeProjects.length >= 2) signals.push('multiple Node projects');

  const dotnetProjects = relativeFiles.filter((file) => file.toLowerCase().endsWith('.csproj'));
  if (dotnetProjects.length >= 2 || relativeFiles.some((file) => /\.(?:sln|slnx)$/i.test(file))) signals.push('multi-project .NET structure');

  const mavenModules = relativeFiles.filter((file) => /(?:^|\/)pom\.xml$/i.test(normalized(file)));
  const gradleBuilds = relativeFiles.filter((file) => /(?:^|\/)build\.gradle(?:\.kts)?$/i.test(normalized(file)));
  const gradleSettings = relativeFiles.filter((file) => /(?:^|\/)settings\.gradle(?:\.kts)?$/i.test(normalized(file)));
  if (mavenModules.length >= 2 || gradleBuilds.length >= 2 || gradleSettings.length >= 2) signals.push('multi-module Java structure');

  return [...new Set(signals)];
}

export function renderTrackerInstructions({ github }) {
  if (!github) return `# Issue tracker: Local Markdown

Issues and specifications live under ignored \`.scratch/\` paths.

- Specification: \`.scratch/<feature>/spec.md\`
- Implementation ticket: \`.scratch/<feature>/issues/<NN>-<slug>.md\`
- Record blockers in a \`Blocked by:\` line and readiness as \`Status: ready-for-agent\`.
- A Wayfinder map is \`.scratch/<effort>/map.md\`; its numbered child files record type, blockers, claim state, and resolution.
- The frontier is every open, unclaimed child whose blockers are resolved.
`;

  return `# Issue tracker: GitHub

Issues and specifications live in GitHub Issues. Use \`gh\` with argument arrays or body files; do not interpolate untrusted issue content into shell commands.

## Common operations

- Read: \`gh issue view <number> --comments\`
- Create: write the body to a temporary Markdown file, then run \`gh issue create --title <title> --body-file <file>\`
- Comment: \`gh issue comment <number> --body-file <file>\`
- Label ready work: apply \`ready-for-agent\`; if the label is absent, request approval before creating it once.
- Close only when the active workflow calls for resolution.

## Wayfinding operations

- Create one map issue labelled \`wayfinder:map\`.
- Create child issues first. Resolve a child's numeric database id with \`gh api repos/{owner}/{repo}/issues/<child-number> --jq .id\`, then attach it with \`gh api --method POST repos/{owner}/{repo}/issues/<map-number>/sub_issues -F sub_issue_id=<database-id>\`. Use a linked task list plus \`Part of #<map>\` only when sub-issues are unavailable.
- Prefer GitHub's native blocked-by relationship. Resolve the blocker's numeric database id the same way, then run \`gh api --method POST repos/{owner}/{repo}/issues/<blocked-number>/dependencies/blocked_by -F issue_id=<blocker-database-id>\`. The endpoint does not accept the visible issue number or GraphQL node ID in that field.
- Fall back to a \`Blocked by: #<n>\` line when native dependencies are unavailable.
- The frontier is every open child with no open blocker and no assignee.
- Claim before work with \`gh issue edit <number> --add-assignee @me\`.
- Resolve by posting the answer, closing the child, and appending a one-line linked gist to the map's Decisions-so-far.
`;
}

export function renderDomainInstructions({ multiContext = false } = {}) {
  const layout = multiContext
    ? 'Read the root `CONTEXT-MAP.md`, then each relevant context `CONTEXT.md`, system ADRs, and context-specific ADRs.'
    : 'Read root `CONTEXT.md` and relevant `docs/adr/` entries when they exist.';
  return `# Domain documentation

${layout}

- Proceed silently when domain files do not exist; create them lazily through \`domain-modeling\` only after a term or qualifying decision is resolved.
- Use the glossary's canonical vocabulary in issues, specifications, tests, reviews, and code.
- Surface conflicts with an existing ADR instead of silently overriding it.
- Treat \`CONTEXT.md\` as a glossary, not as a specification or implementation guide.
`;
}

export async function inspectExistingTrackerConfiguration(projectRoot, github) {
  const tracker = path.join(projectRoot, 'docs', 'agents', 'issue-tracker.md');
  try {
    const stat = await fs.lstat(tracker);
    if (stat.isSymbolicLink()) return { state: 'conflict', reason: 'docs/agents/issue-tracker.md must not be a symbolic link.' };
    const text = await fs.readFile(tracker, 'utf8');
    const actual = /^# Issue tracker: GitHub\s*$/m.test(text) ? 'github'
      : /^# Issue tracker: Local Markdown\s*$/m.test(text) ? 'local'
        : 'custom';
    const expected = github ? 'github' : 'local';
    if (actual !== expected) return { state: 'conflict', reason: `Existing tracker contract is ${actual}; detected tracker is ${expected}.` };
    return { state: 'aligned', tracker: expected };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'unconfigured' };
    throw error;
  }
}

export async function inspectExistingDomainContract(projectRoot) {
  const contract = path.join(projectRoot, 'docs', 'agents', 'domain.md');
  try {
    const stat = await fs.lstat(contract);
    if (stat.isSymbolicLink()) return { state: 'conflict', reason: 'docs/agents/domain.md must not be a symbolic link.' };
    const text = await fs.readFile(contract, 'utf8');
    if (/CONTEXT-MAP\.md/.test(text)) return { state: 'configured', layout: 'multi' };
    if (/Read root `CONTEXT\.md`/.test(text)) return { state: 'configured', layout: 'single' };
    return { state: 'conflict', reason: 'docs/agents/domain.md does not declare a recognized single-context or multi-context layout.' };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'unconfigured' };
    throw error;
  }
}

export async function inspectExistingDomainConfiguration(projectRoot) {
  const context = path.join(projectRoot, 'CONTEXT.md');
  const map = path.join(projectRoot, 'CONTEXT-MAP.md');
  const has = async (file) => { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
  const [hasContext, hasMap] = await Promise.all([has(context), has(map)]);
  for (const [label, file, present] of [['CONTEXT.md', context, hasContext], ['CONTEXT-MAP.md', map, hasMap]]) {
    if (present && (await fs.lstat(file)).isSymbolicLink()) return { state: 'conflict', reason: `${label} must not be a symbolic link.` };
  }
  if (hasContext && hasMap) return { state: 'conflict', reason: 'Both CONTEXT.md and CONTEXT-MAP.md exist at the root.' };
  if (hasMap) {
    const text = await fs.readFile(map, 'utf8');
    const references = [...text.matchAll(/\(([^)]+CONTEXT\.md)\)/gi)].map((match) => match[1].split('#')[0]);
    if (references.length === 0) return { state: 'conflict', reason: 'CONTEXT-MAP.md does not point to any context CONTEXT.md files.' };
    const missing = [];
    for (const reference of references) {
      const target = path.resolve(projectRoot, reference);
      if (!target.startsWith(`${path.resolve(projectRoot)}${path.sep}`) || !(await has(target))) {
        missing.push(reference);
        continue;
      }
      const realTarget = await fs.realpath(target);
      if (!realTarget.startsWith(`${await fs.realpath(projectRoot)}${path.sep}`)) missing.push(reference);
    }
    if (missing.length > 0) return { state: 'conflict', reason: `CONTEXT-MAP.md has missing or unsafe context references: ${missing.join(', ')}` };
    return { state: 'multi-context' };
  }
  if (hasContext) {
    const text = await fs.readFile(context, 'utf8');
    if (!/^#\s+\S/m.test(text)) return { state: 'conflict', reason: 'CONTEXT.md is empty or has no Markdown heading.' };
    return { state: 'single-context' };
  }
  return { state: 'unconfigured' };
}
