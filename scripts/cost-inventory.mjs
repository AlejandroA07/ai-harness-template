import path from 'node:path';
import { assertSafeDirectory, parseSkill } from './skill-lib.mjs';
import { readRegular } from './installation-core.mjs';

const estimate = (value) => Math.ceil(Buffer.byteLength(value, 'utf8') / 4);
const measuredFields = ['date', 'agentVersion', 'model', 'project', 'scenario', 'mcps', 'result', 'method'];
const plannedFields = ['agentVersion', 'model', 'project', 'scenario', 'mcps', 'method'];

function fail(message) { throw new Error(message); }
function exactRecord(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...fields].sort())) fail(`Invalid ${label}`);
  for (const field of fields) {
    if (typeof value[field] !== 'string' || !value[field].trim() || /[\x00-\x1f\x7f]/.test(value[field])) fail(`Invalid ${label} ${field}`);
  }
}

export function validateTokenMeasurements(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['plannedSamples', 'samples', 'version'])) fail('Invalid token measurement ledger');
  if (value.version !== 1 || !Array.isArray(value.samples) || !Array.isArray(value.plannedSamples)) fail('Unsupported token measurement ledger');
  value.samples.forEach((entry) => exactRecord(entry, measuredFields, 'measured token sample'));
  value.plannedSamples.forEach((entry) => exactRecord(entry, plannedFields, 'planned token sample'));
  const keys = [...value.samples, ...value.plannedSamples].map((entry) => [entry.date ?? 'pending', entry.agentVersion, entry.model, entry.project, entry.scenario].join('\0'));
  if (new Set(keys).size !== keys.length) fail('Duplicate token measurement sample');
  return value;
}

export async function loadTokenMeasurements(repositoryRoot) {
  return validateTokenMeasurements(JSON.parse((await safeRead(repositoryRoot, 'catalog/token-measurements.json')).toString('utf8')));
}

async function safeRead(repositoryRoot, relative) {
  const file = path.join(repositoryRoot, relative);
  await assertSafeDirectory(repositoryRoot, path.dirname(file));
  return readRegular(file);
}

async function resourceSize(repositoryRoot, resources) {
  let bytes = 0;
  for (const resource of resources) bytes += (await safeRead(repositoryRoot, resource)).length;
  return bytes;
}

export async function buildCostInventory(repositoryRoot, catalog, integrationCatalog) {
  const guidance = [];
  for (const [platform, source] of [['codex', 'global/AGENTS.md'], ['claude', 'global/CLAUDE.md']]) {
    const body = (await safeRead(repositoryRoot, source)).toString('utf8');
    guidance.push({ platform, source, bytes: Buffer.byteLength(body), estimatedTokens: estimate(body) });
  }

  const capabilities = [];
  for (const capability of catalog.capabilities) {
    const body = parseSkill((await safeRead(repositoryRoot, capability.source)).toString('utf8'), capability.source).body;
    capabilities.push({ id: capability.id, module: capability.module, source: capability.source, invocation: capability.activation,
      metadataEstimatedTokens: estimate(`${capability.id}: ${capability.description}`), bodyEstimatedTokens: estimate(body),
      resourceFiles: capability.resources.length, resourceBytes: await resourceSize(repositoryRoot, capability.resources) });
  }

  const integrationAdapters = [];
  for (const integration of integrationCatalog.integrations) {
    if (typeof integration.adapter === 'string') {
      const source = integration.adapter;
      const text = (await safeRead(repositoryRoot, source)).toString('utf8');
      const skill = parseSkill(text, source);
      integrationAdapters.push({ id: integration.id, platform: 'both', kind: 'skill', source,
        metadataEstimatedTokens: estimate(`${skill.name}: ${skill.description}`), bodyEstimatedTokens: estimate(skill.body),
        configurationBytes: 0, runtimeSchema: 'not-applicable' });
    } else for (const platform of integration.platforms) {
      const source = integration.adapter[platform];
      const text = (await safeRead(repositoryRoot, source)).toString('utf8');
      integrationAdapters.push({ id: integration.id, platform, kind: 'mcp', source, metadataEstimatedTokens: 0, bodyEstimatedTokens: 0,
        configurationBytes: Buffer.byteLength(text), runtimeSchema: 'measure-when-loaded' });
    }
  }

  return { version: 1, estimate: 'ceil(UTF-8 bytes / 4)', guidance, capabilities, integrationAdapters,
    measurements: await loadTokenMeasurements(repositoryRoot) };
}

const escapeCell = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\n', ' ');
const measurementRow = (entry, pending = false) => `| ${pending ? '—' : escapeCell(entry.date)} | ${escapeCell(entry.agentVersion)} | ${escapeCell(entry.model)} | ${escapeCell(entry.project)} | ${escapeCell(entry.scenario)} | ${escapeCell(entry.mcps)} | ${pending ? 'Pending' : escapeCell(entry.result)} | ${escapeCell(entry.method)} |`;

export function renderCostMarkdown(inventory, deniedTools) {
  const guidanceRows = inventory.guidance.map((entry) => `| ${entry.source} | ${entry.bytes} | ${entry.estimatedTokens} |`).join('\n');
  const capabilityRows = inventory.capabilities.map((entry) => `| ${entry.id} | ${entry.module} | ${entry.invocation} | ${entry.metadataEstimatedTokens} | ${entry.bodyEstimatedTokens} | ${entry.resourceFiles} / ${entry.resourceBytes} |`).join('\n');
  const adapterRows = inventory.integrationAdapters.map((entry) => `| ${entry.id} | ${entry.platform} | ${entry.kind} | ${entry.source} | ${entry.metadataEstimatedTokens || '—'} | ${entry.bodyEstimatedTokens || '—'} | ${entry.configurationBytes || '—'} | ${entry.runtimeSchema} |`).join('\n');
  const measurements = [...inventory.measurements.samples.map((entry) => measurementRow(entry)),
    ...inventory.measurements.plannedSamples.map((entry) => measurementRow(entry, true))].join('\n');
  return `# Token costs

This is the template's central cost ledger. Static sizes are measured from files; token counts are estimates at four UTF-8 bytes per token. Runtime measurements are loaded from \`catalog/token-measurements.json\` so regenerating this inventory cannot erase observed samples.

## What consumes context or tokens

| Source | When it costs | Control |
| --- | --- | --- |
| System and developer instructions | Every session | Product-owned; measure, do not duplicate locally |
| Global and project guidance | Every applicable session | Keep AGENTS/CLAUDE lean and remove repetition |
| Skill names and descriptions | Skill discovery | Audit unused skills; keep descriptions concise |
| Skill bodies | When invoked or selected | User-only for deliberate workflows; progressive disclosure |
| Skill references | When opened | Keep details in one referenced file; no duplicate README |
| Built-in tool schemas | Every request when loaded eagerly | Disable unused optional tools only after reviewing the capability trade-off |
| Deferred and MCP tool schemas | When the client loads them; they may show zero cost while deferred | Keep tools on demand and record deferred versus loaded cost separately |
| Conversation messages and tool output | During the session | Start implementation tickets fresh; avoid dumping broad output |
| Specs, issues, ADRs, and code | When read | Load the relevant artifact, not the entire history |
| Subagents and parallel research | Per agent/session | Use only for independent work whose time or isolation benefit pays for it |
| Images and attachments | When included | Include only the fidelity needed for the decision |
| Compaction and handoffs | When crossing context boundaries | Reference existing artifacts instead of duplicating them |

## Claude built-in tool policy

Claude Code loads built-in tool schemas into every request. The harness removes the following optional tools with bare permission denials, while retaining both Bash and PowerShell:

${deniedTools.map((tool) => `- \`${tool}\``).join('\n')}

This is a capability trade-off, not just a permission-prompt change. Re-run the runtime protocol after changing the list.

## Static global guidance

| File | Measured bytes | Estimated tokens |
| --- | ---: | ---: |
${guidanceRows}

## Static capability inventory

Metadata is the approximate always-discovered cost. Body cost is paid only when invoked. Resource bytes do not enter context unless the agent reads them; executable scripts can often run without being loaded. The module column prevents workflows from being counted as a second copy of their required skill bodies.

| Capability | Module | Invocation | Metadata est. tokens | Body est. tokens | Resource files / bytes |
| --- | --- | --- | ---: | ---: | ---: |
${capabilityRows}

## Tool adapter inventory

Skill adapters have normal discovery/body costs. MCP configuration bytes are not MCP schema tokens; runtime schema cost stays unmeasured until the client actually loads it.

| Integration | Platform | Adapter | Source | Metadata est. tokens | Body est. tokens | Config bytes | Runtime schema |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
${adapterRows}

## Runtime measurement protocol

Record runtime samples in \`catalog/token-measurements.json\`; this generated file is only a view.

1. Start a fresh representative project session and record date, CLI version, model, project, and enabled MCPs.
2. Claude: run \`/context\` before invoking a skill and again after the representative workflow. Record the component breakdown Claude displays.
3. Codex: run \`/status\` before and after the same workflow. Record the total/context delta; Codex does not currently expose Claude's component-level breakdown.
4. Compare repeated samples only when the model, project, and enabled tools are equivalent.

| Date | Agent/version | Model | Project | Scenario | MCPs | Measured result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
${measurements}

## Audit triggers

- Review a skill when it has not been used for several projects, its body grows materially, or another skill duplicates its job.
- Reconsider extensive user stories when measured planning cost is high relative to the clarity they add.
- Reconsider an MCP when it is enabled but rarely called.
- Prefer scripts for deterministic repeated operations; prefer references for detail needed only sometimes.
- Archive retired material outside discovery paths. Archived files have zero normal context cost.
`;
}
