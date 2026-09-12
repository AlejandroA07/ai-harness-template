# M1: catalog and read-only selection planning

M1 adds a declared catalog and a pure dependency planner on top of M0 (`2ac3e46368879577c9b0e33710d8356c6cdcef9c`). It preserves all 22 existing capability names, their canonical sources, resources, invocation policy and provenance. It does not change generation, synchronization, bootstrap, machine setup or installed-state audit behavior.

## Commands

```sh
node scripts/setup.mjs list
node scripts/setup.mjs list --json
node scripts/setup.mjs plan --select research --platform codex --scope machine
node scripts/setup.mjs plan --select implement --platform both --scope project --json
node scripts/setup.mjs plan --module workflows --platform claude --scope machine
node scripts/setup.mjs plan --module skills --module workflows --platform both --scope project
```

Repeat `--select` to choose several IDs; combine explicit IDs and `--module` if useful. Plans require an explicit platform (`claude`, `codex`, or `both`) and scope (`machine` or `project`). Unknown options, IDs and unsupported selections fail before producing a plan. No installation, tool discovery, network request, generation or target inspection occurs. Paths are relative discovery locations under a future machine/project target, not an instruction to link to the source checkout.

`list` includes the five public modules and two internal owners. M1 selection covers the 13 Skills and nine Workflows from the review. Global configuration, Project configuration and Tool integrations retain source references and supported dimensions, but do not yet have selectable capability definitions; selecting them reports that limitation. Their executable lifecycle definitions remain M3, M4 and M6 work. Selecting both Skills and Workflows previews all 22 capabilities; it does not activate the legacy full managed profile's inventory rules.

At the M1 boundary, the new setup command rejected `apply`, `audit` and `remove`. [M2 now supplies those operations for selected machine skills](modularity-m2-installation.md). Existing machine setup, bootstrap, synchronization, generation and audit commands continue to serve their established profiles.

## Catalog contract

[`catalog/modules.json`](../../catalog/modules.json) is version 1. Module records contain stable ID, human label, public/internal visibility, description, source references, and supported platforms/scopes. Module source references are ownership areas, not recursive installation payload lists; Skills and Workflows share the current physical `skills/` tree and are distinguished by each capability's module ID.

Capability records retain the invocation name as their stable ID and declare label, module, source, platforms/scopes, required dependencies, conditional uses with conditions, routing recommendations, invocation prerequisites, a complete resource inventory, and a provenance reference. Every Workflow also declares an ordered list of stages with invoked capabilities, conditions, approval points and produced artifacts. Source and resource paths remain in place. Relationships are local declarations informed by the reviewed canonical instructions; they are not measurements of actual execution.

Descriptions come from canonical `SKILL.md` frontmatter. Activation comes from `skills/invocation-policy.json`, preserving `user-only` versus `model-or-user`. Provenance resolves through `skills/upstream-sources.json`, including exact/adapted/local mode and reviewed upstream location/revision. Duplicating these derived values in the catalog file is rejected. No upstream source text or invocation metadata was rewritten.

[`catalog-loader.mjs`](../../scripts/catalog-loader.mjs) reads and validates those sources. It verifies that every canonical capability is classified exactly once, that IDs retain discovery names, and that no declared resource is missing or undeclared resource is silently omitted. Paths are constrained to supported local layouts; linked/nonregular source paths are rejected before reading. Opened metadata/source files must be regular and unlinked. The loader also validates provenance with the existing narrow upstream validator; it does not acquire remote sources or broaden vendor permissions.

[`module-catalog.mjs`](../../scripts/module-catalog.mjs) exposes two pure functions: `validateCatalog(catalog)` and `planSelection(catalog, selection)`. Neither accesses files, environment variables or processes. The loader supplies the resolved catalog to the CLI. Validation rejects unknown fields/versions, IDs, relationship targets, duplicate sources/IDs, unsafe paths and cycles in required dependencies. Recommendation/conditional-use cycles do not become installation cycles.

The planner resolves only required dependencies, checks every included capability against the selected platform/scope, and emits dependencies before their consumers. Shared dependencies appear once per platform. It records requested IDs, dependency reasons, direct consumers, resources, invocation prerequisites, conditional-use inclusion, recommendation inclusion and the ordered workflow stages. Results do not mutate inputs and are deterministic for reordered selections.

Every emitted relationship kind states its provenance. Containment, dependencies, routes, conditional uses, prerequisites and workflow stages are declared in the catalog; dependency consumers are derived from those declarations. Activation is derived from `skills/invocation-policy.json`. Descriptions shown by `list` come from `SKILL.md` frontmatter, and its upstream provenance comes from `skills/upstream-sources.json`. The plan does not describe declared relationships as observed execution.

## Reviewed relationship choices

| Selection | Required closure beyond itself | Conditional uses / recommendations |
|---|---|---|
| `research` | None | Background-agent/source access is an invocation prerequisite |
| `grill-me` | `grilling` | None |
| `grill-with-docs` | `grilling`, `domain-modeling` | Repository domain artifacts are invocation prerequisites |
| `implement` | `tdd`, `code-review` | Security checklist for sensitive changes; project verification is an invocation prerequisite |
| `improve-codebase-architecture` | `codebase-design` | Grilling and domain modeling follow user selection of a candidate |
| `wayfinder` | `grilling`, `domain-modeling` | Research and prototype depend on ticket type; later specification/implementation phases are recommendations |
| `ask-alfred` | None | Routes to the other 21 canonical capabilities |
| `tdd` | None | Consults design vocabulary when the interface shape is in question; recommends code review for the review phase |

These distinctions preserve the actual conditions in the source instructions. An invocation prerequisite does not install the entire Project configuration module, and a router does not install everything it mentions. Missing capabilities needed at invocation must be handled by the later M5 workflow availability contract. Tracker/domain fallback guidance remains visible rather than becoming an unconditional installation dependency.

## Verification and preservation evidence

- `node scripts/verify.mjs` exited 0 after review fixes: 85 tests, 83 passed, zero failed, and two existing Windows-only tests skipped. Whitespace, full-history Gitleaks, Zizmor and syntax checks passed; Zizmor used its default offline mode.
- `tests/module-catalog.test.mjs` is registered in the real test runner. It validates all 22 classifications, descriptions, invocation flags, resources and provenance against canonical sources.
- Planner tests cover one capability on both platforms/scopes, required and transitive dependencies, shared consumers, module expansion, workflow order/approvals/artifacts, fact provenance, deterministic output, immutable inputs and unsupported dependencies.
- Rejection tests cover malformed schemas, unknown IDs/relationships, required cycles, duplicate discovery entries, missing classifications/resources and unsafe/linked source paths.
- CLI fixtures have isolated home directories, existing generated sentinels, a different working directory, spaces in paths, and an empty tool PATH. Successful list/plan and rejected operations preserve file bytes, modes, modification times and directory/link state.
- All M0 tests and earlier guard, attribution, provenance, Windows argument handling and full-profile synchronization tests remain in the gate. No existing runtime source or canonical capability file changed in M1.

## Handoff to M2

Plans deliberately report `stage: selection-only`, `applicable: false`, a structured `relationshipProvenance` map, and `targetPreflight: not-performed`. They are not serialized authority to write files. M2 must revalidate source/selection and inspect an explicitly chosen target before building an actionable plan.

M2 still owns the installation store, receipt trust/adoption rules, exact file/settings ownership, staging and operation serialization, target conflict checks, failure recovery, consumer-aware update/removal, and installed-state audit. New explicit selections retain the agreed coexistence policy. Do not route a narrow selection through the full-tree generator or existing exact-inventory sync command. Installed-state routing, vendor resources, global/project lifecycle definitions and the architecture view retain their planned later slices.

## Security review

| Area | Verdict | Evidence |
|---|---|---|
| Catalog/selection input validation | Pass | Strict fields, IDs, graphs and supported combinations; denied cases in planner tests |
| Filesystem source handling | Pass for M1 read-only loading | Constrained paths, regular-file handles, linked-root/resource rejection and unchanged sentinels |
| Commands, external tools and network | Pass | Planner has no process access; CLI performs local reads only and succeeds with an empty tool PATH |
| Dependencies and delivery | Pass | No added packages, changed CI actions or weakened upstream rules; full gate retained |
| Installation authorization/receipts | Not applicable to M1 | Apply/remove unavailable; explicitly remains M2 work |
| Authentication, sessions, uploads and browser services | Not applicable | No service or credential handling added |
