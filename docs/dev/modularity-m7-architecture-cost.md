# M7: logical architecture and cost views

M7 adds a deterministic, read-only architecture module over the existing catalog
and lifecycle interfaces. The checked-in [architecture overview](../../ARCHITECTURE.md)
navigates from module to platform to capability or integration and then to its
canonical source. A target-aware JSON view reuses the M2–M6 audit planners, so it
never interprets receipt JSON as write authority or invents installation state.

## Use

Regenerate the target-free overview:

```text
node scripts/architecture-view.mjs --write
```

Inspect one target and keep planned, installed and observed state separate:

```text
node scripts/architecture-view.mjs --platform codex --scope project --target <absolute-project> --json
node scripts/architecture-view.mjs --platform codex --scope machine --target <absolute-home> --select tdd --select graphify --json
node scripts/architecture-view.mjs --platform codex --scope project --module workflows --module tool-integrations --json
```

The target-free command does not inspect a profile. `--target` requires one
platform and scope and runs only the existing read-only audit paths. Selections
without a target show intended closure but do not claim installation. The
checked-in Markdown can be reproduced byte-for-byte from the validated inputs.

## Architecture contract

`buildArchitectureModel` is the module interface. It returns versioned nodes and
typed edges for the Harness root, seven public/internal modules, platform paths,
the 22 canonical Skills and Workflows, project/global configuration, four Tool
integrations, their individual features and canonical sources. Module
dependencies now live in `catalog/modules.json`, are cycle-checked, and remain
distinct from capability installation dependencies.

Edges retain their meaning and provenance:

- `contains` and `supports` form the logical navigation hierarchy;
- `depends-on` and `requires` affect module or capability dependencies;
- `uses` and `routes-to` remain optional and never expand installation closure;
- `stage-invokes` preserves workflow order and conditions;
- `exposes` identifies Tool integration capabilities; and
- `sourced-by` and `resource` lead to validated repository paths.

Every selectable node has three independent fields. `planned` comes only from
the explicit view selection. `installed` comes only from a validated ownership
receipt. `observed` comes from current audit evidence and is never used to claim
a running process. Integration runtime details retain M6's provisioned,
configured, invocable, hook-activation and running distinctions.

## Cost contract

Static cost inventory and rendering moved behind `cost-inventory.mjs`. The view
classifies each discovery entry as a Skill or Workflow, adds Graphify/Archify
skill-adapter costs, and records the byte size of platform MCP configuration.
MCP configuration bytes are explicitly not presented as runtime tool-schema
tokens. Required Skill bodies are counted once under their canonical capability,
not copied into each Workflow that uses them.

Measured samples now live in the strict, versioned
`catalog/token-measurements.json` ledger. `TOKEN-COSTS.md` is a generated view of
that ledger plus current static files. Regeneration therefore cannot erase or
silently rewrite measurements. Pending measurements remain separate from
observed samples.

## Graphify interchange decision

M7 keeps the logical catalog graph and Graphify's source graph linked but
separate. Their safe join seam is a normalized repository-relative source path.
The catalog is authoritative for authored modules, workflow stages, activation
and receipt-backed state. Graphify is authoritative only for the extracted or
inferred evidence in its own graph.

Direct `merge-graphs` interchange is rejected for this slice. The reviewed
Graphify node-link output does not preserve lifecycle states, workflow-stage
conditions or the catalog's relationship-provenance contract. Importing the
catalog into that format would make declared architecture look like observed
source execution. The JSON architecture view supplies a future lossless export
seam; the existing local Graphify HTML remains a linked, regenerable code view.

## Verification and security boundary

Registered tests cover logical paths and typed edges, source links, planned /
installed / observed separation against a real isolated receipt, invalid module
and capability selections, relative and control-character target paths, strict
measurement schemas, preserved measured samples, Graphify separation, and
byte-for-byte generated views. Existing catalog loaders continue to reject
missing, linked and unsafe sources; existing lifecycle audits validate receipt
evidence and current ownership before M7 reports installed state.

The completed repository run contains 188 registered tests: 186 passed and the
two Windows-only shim-resolution cases were skipped on macOS. The full local
gate also passed its whitespace check, full-history Gitleaks scan, Zizmor audit
and syntax checks.

Security checklist verdicts:

- Access and identity — **Not applicable**: this is a local read-only command
  with no remote identity or authorization surface.
- Inputs and outputs — **Pass**: platforms, scopes, modules, selections,
  integration features, measurement records and target paths use bounded
  contracts; the generated model omits the absolute inspected target path.
- Injection and navigation — **Pass**: no shell or database is used; targets are
  absolute, control-character-free and revalidated by the lifecycle planners;
  catalog reads reject unsafe links and Markdown table data is escaped.
- Browser and network boundaries — **Not applicable**: generation and target
  inspection perform no network or browser action.
- Files and abuse — **Pass**: source reads use regular-file and safe-directory
  checks; the only write is the fixed repository `ARCHITECTURE.md` path under an
  explicit `--write` mode that forbids target and selection arguments.
- Dependencies and delivery — **Pass**: no dependency or CI surface was added;
  measured data and generated views are included in the normal repository gate.
- Regression evidence — **Pass**: denied paths and schema drift are tested along
  with target receipt and deterministic generation cases.
