# Plan: make the harness understandable and selectively adoptable

- **Status:** five-module direction agreed; implementation pending in a separate task
- **Scope:** repository organization, selective installation, and a readable architecture map
- **Graphify decision:** adopt with all capabilities in Tool integrations, available across projects and invoked by the user. Watchers, Git hooks, semantic document processing, and MCP are supported configuration choices; availability does not automatically activate them everywhere.
- **Review baseline:** `a31e26aa1a9d6fdec2f61ca33c50ba32187b307c`; see the [whole-repository review](harness-modularity-review.md) for the ownership map, 22-capability classification, and findings R1–R10.
- **Current delivery:** planning/review complete; runtime implementation has not started. The detailed contract and slices below supersede the earlier high-level sequence wherever more specific.

## Recommended order

Implement the smallest useful modular foundation before permanent Graphify or Archify integration: module definitions, dependency resolution, selected installation, and ownership-aware audit. Then add the tools through that interface. This avoids implementing tool setup twice. Folder migration and the polished architecture viewer can follow incrementally; they need not delay tool adoption.

Evaluation on Westcoast Cars can proceed independently once its repository location and baseline are confirmed. It tests the external tools, so it does not require the harness reorganization to be complete. Track that work in the [adoption checklist](graph-and-quality-adoption-roadmap.md).

## Problem and current evidence

The current Graphify tree shows physical files and extracted symbols. It does not explain what a person can adopt, how instructions activate, or which configuration applies globally versus to one project.

The retained tree shows eight JSON property nodes under `global/claude-settings.json`, including nested keys flattened beneath the file. That total counts extracted nodes, not capabilities, tokens, or activations. Markdown guidance and `.template` configuration files were excluded from the code-only pilot, so the absence of Codex guidance is an extraction gap.

The repository already separates `global/`, `project/`, `skills/`, and `components/`. However, [machine setup](../../scripts/machine-setup.mjs) preflights and synchronizes the complete skill inventory while configuring both platforms. The [README](../../README.md) documents this exact-inventory policy. Selective adoption therefore requires installation and audit changes, not only new folders.

## Agreed user-facing modules

| Module | What someone chooses | Existing implementation |
|---|---|---|
| Global configuration | Machine-wide preferences and controls for Claude, Codex, or both | `global/` and machine setup/settings merge scripts |
| Project configuration | Repository guidance, local verification, and optional CI | `project/`, bootstrap and project-configuration scripts |
| Skills | Reusable instructions for individual capabilities such as TDD, diagnosis, or review | Current canonical skills, invocation policy, and platform adapters |
| Workflows | Ordered steps, dependencies, handoffs, approval points, and verification gates | Currently packaged among the skills; classify by responsibility during migration |
| Tool integrations | Optional external programs and MCP connections | `components/mcp/`; future integrations when adopted |

Shared guards, generation, installation, and audit machinery support these modules. Expose their required dependencies without making users select every internal helper.

The review found no need for a sixth public module now. Define two internal modules explicitly: Installation core (catalog, selection, planning, receipts, generation, platform adapters, audit) and Shared policy/runtime (guards, attribution checks, portable process execution). Project verification/security and CI are visible Project configuration options. Repository tests, documentation, source updates, and cost reporting are maintainer facilities.

Treat workflows as compositions of skills, with one canonical implementation. A platform may still expose a workflow as an invocable skill package; that packaging does not change its architectural role. Add a separate agents category only when an actual reusable agent definition needs independent ownership.

Declare and display relationships explicitly. For example, an implementation workflow uses the TDD and code-review skills, invokes project verification, and optionally queries the Graphify integration. Resolve required dependencies when installing a workflow; leave optional integrations optional. Workflow definitions reference skills instead of copying their instructions.

## One repository, module-specific installation definitions

Keep one repository and one shared setup interface. Each module declares what it provides and requires, which files it owns, supported platforms and installation scopes, configuration choices, installation/update/removal behavior, and verification. Supply module-specific templates only where files must be generated; not every module needs a standalone template project.

Users choose modules or the full-harness profile. Platform (Claude/Codex) and installation scope (machine/project) are separate dimensions where supported. The Global configuration module owns machine-wide policy, but a skill, workflow, or tool integration can also be installed at either scope without duplicating its source.

## Proposed logical view

```text
Harness
├── Global configuration
│   ├── Shared preferences
│   ├── Claude: guidance, permissions, tool hooks
│   └── Codex: guidance, tool hooks
├── Project configuration
│   ├── Project guidance
│   ├── Verification and Git checks
│   └── Optional CI
├── Skills
├── Workflows → uses skills; invokes project checks and tools
├── Tool integrations
└── Shared installation and audit machinery
```

This is a proposed logical view. These modules are not independently installable today.

## Implementation sequence

1. Inventory responsibilities: what each module provides, source files, dependencies, target scope, and activation mechanism. Distinguish instructions read by an agent from programs triggered by commands or hook events.
2. Define global-only, project-only, selected-skills, selected-workflows, selected-integrations, and full-harness installation contracts. Allow platform/scope selection and specify required dependencies and uninstall ownership.
3. Resolve the inventory-policy change: selected-skills installation must preserve unrelated user skills. Retain exact-inventory behavior as an explicitly selected managed profile. Update preflight, synchronization, audit, and tests together.
4. Add a small declarative architecture catalog with stable IDs, human labels, source references, and explicit relationships: contains, depends-on, uses, invokes, installs, and activates. Generate catalog facts from module definitions where possible to avoid maintaining the same dependencies twice. Keep detailed prose in existing documents.
5. Generate an overview from that catalog: purpose → platform configuration → source file → individual setting. Include the command or event that activates each behavior.
6. Add Graphify through Tool integrations with its full capability set, documented activation options, and visible model-cost distinctions. Evaluate a documented import/export or merge interface for combining the catalog with extracted source evidence. Keep declared relationships distinguishable from extracted and inferred relationships. If interoperability is unsuitable, link the generated architecture view to the separate Graphify code view.
7. Move folders only where it improves ownership. Preserve canonical sources; migrate paths, scripts, tests, and documentation together. Keep Markdown as Markdown rather than converting it into code solely for the extractor.

A deterministic catalog renderer would use local compute to regenerate the overview. Authoring and maintaining the catalog still costs human or agent effort. The catalog describes structure and activation; it does not measure actual model reads or token usage.

## Completion checks

- Global-only installation can select a platform without installing unrelated skills.
- Selected-skills installation preserves unrelated user skills and resolves declared dependencies.
- Selected-workflow installation resolves required skills without duplicating their instructions or automatically enabling optional tools.
- Tool integrations can be selected independently; Graphify exposes its full capabilities with explicit configuration and invocation behavior.
- Project-only installation changes only the selected repository and its declared configuration.
- Existing full-harness installation remains supported.
- Workflow instructions retain one canonical source.
- Catalog references resolve; missing files and invalid relationships fail validation.
- The overview explains a complete path from a request or hook event to the loaded skill or executing program.
- `node scripts/verify.mjs` exits with code 0.

## Handoff to another task

Use the [fresh-task handoff](#fresh-task-handoff) after reading the detailed contract and migration slices below.

## Implementation contract

### Stable catalog and separate graphs

Keep source paths in place during initial slices. Introduce versioned module/capability definitions with stable IDs, public module, label, description, local source path, supported platforms/scopes, required dependencies, conditional uses, routing recommendations, activation mode, resources, and provenance reference. Validate unknown IDs, duplicate IDs/discovery names, cycles in required installation dependencies, unsupported combinations, and unsafe paths before planning writes.

Separate three kinds of relationship:

- Installation dependencies determine required payloads and tools.
- Workflow relationships describe order, conditional calls, approval points, and artifacts; a route to a capability is not a mandatory installation dependency.
- Architecture relationships show declared containment/activation and source-derived evidence. Mark their provenance, and do not present static structure as observed execution or token usage.

One invocation ID produces one platform discovery entry. A workflow may still be packaged as a platform skill. Preserve all current invocation names and user-only/model-selected settings while classifying the 22 capabilities from the review. Exact upstream content remains exact; classification belongs in local metadata.

### Shared setup interface and compatibility

Provide one setup interface with list, plan, apply, audit, and remove operations; exact CLI spelling is a routine implementation choice. Existing machine setup, bootstrap, sync and generation commands remain compatibility entry points for their established profiles until documented migration is complete.

New explicit selections use coexistence: preserve unrelated skills, hooks, settings, and agents. The existing complete managed profile keeps its deliberate inventory and custom-agent rules when explicitly selected. This profile decision is distinct from capability dependencies. Missing Claude, GitHub CLI, or security scanners must not block a Codex-only skill selection unless the selected operation actually requires them.

Examples the interface must support:

| User request | Expected behavior |
|---|---|
| One Codex skill on this machine | Only its required capability closure and Codex discovery entries; no Claude settings or Git hook changes |
| Global Codex configuration | Global policy/guard dependencies; no unrelated skills and no requirement for Claude CLI |
| One implementation workflow | TDD/review dependencies, visible conditional checks and invocation prerequisites |
| Project configuration only | Project-owned payloads/gates; no machine settings or dependency on the harness checkout at runtime |
| Graphify integration | Tool runtime/adapter/configuration ownership; full capabilities available with explicit activation settings |
| Full managed harness | Existing complete-profile behavior and controls with upgrade conflicts reported clearly |

### Installation lifecycle and receipts

Resolve the complete plan and preflight every affected target before applying. Plans identify the selected modules, dependency closure, tools, writes, merges, conflicts and activation changes. Default planning must not install tools, generate live payloads, or edit the target. A dedicated user-visible installation store owns machine payloads; source checkouts and temporary worktrees are not durable runtime locations for new installs.

Use versioned receipts per target/platform/scope/profile. Record selected IDs, dependency consumers, payload revisions/hashes, owned paths, exact owned settings/hook entries, backups where appropriate, and prior Git configuration. Do not record secret values, private session transcripts, or hook-trust approval as if it were transferable configuration.

Validate receipt contents and all derived paths before using them. Recheck relevant filesystem state at apply time; serialize operations that touch the same target, and stop on changed preconditions. Stage complete outputs before publishing them. If application fails partway, report completed operations and restore owned changes where safe; do not claim atomicity across unrelated files and external commands.

| Existing state | Apply/update/remove policy |
|---|---|
| Missing target | Create declared payload and receipt |
| Unchanged owned target | Update/remove only the selected ownership share |
| User-edited owned target | Preserve and report conflict; present a reviewable migration |
| Unowned collision | Preserve; never claim ownership merely from its filename or a forged receipt |
| Shared dependency still used elsewhere | Retain until the last consumer is removed |
| Previous settings value | Restore only if the current value is still what this installation wrote; otherwise preserve and report |
| Legacy installation without receipt | Inspect known layouts and content, propose adoption/migration, and preserve ambiguous content |

Record content expectations as well as names. Preserve the current recoverable archive behavior for managed migrations. Missing or malformed receipts cannot justify deletion. Avoid copying arbitrary existing settings into broadly readable backup files; scope backups to owned content and retain appropriate permissions.

### Source acquisition, activation and cost

Keep provenance independent from local classification: upstream repository, full reviewed revision, upstream path, local path, exact/adapted/local mode, approved resource inventory and notices. Generalize source support without removing the checks that protect current exact Markdown updates. Graphify and Archify need a reviewed executable/resource acquisition path; they must not masquerade as flat Markdown-only skills.

Treat provisioned, configured, invocable and running as distinct states. A Graphify package with all features does not automatically install Git hooks, start watchers, enable document-model calls, or expose a server in every project. Support those capabilities explicitly, with clear model/network/runtime requirements and removal behavior. Preserve the existing no-auto-memory policy; adopting a vendor's package does not enable optional session-memory features automatically. Existing Context7/Playwright snippets belong to the same integration contract.

Separate measured token samples from generated inventory so regeneration cannot erase measurements. Include workflow and tool-adapter discovery costs without duplicating underlying skill bodies.

## Ordered implementation slices

Each slice must leave the repository gate green and produce a reviewable local commit. Dependencies below are work prerequisites, not instructions to spawn agents or publish issues. No automatic graph runner is required for this refactor.

| ID | Deliverable and code seams | Blocked by | Acceptance evidence |
|---|---|---|---|
| M0 | Baseline fixture coverage and safety corrections: project manifest validation/removal ownership; exact hook ownership; generation preflight ordering. R2–R4. | None | Malformed manifests and linked roots preserve sentinels; same-named unrelated hooks survive; failed preflight leaves live/generated state unchanged |
| M1 | Versioned catalog, all 22 capability classifications, platform/scope selection, pure dependency planner and read-only list/plan. Existing source locations retained. R1/R8. | M0 | Selected closure correct; routes do not pull in everything; invalid IDs, cycles and unsupported selections rejected; dry-run writes nothing |
| M2 | First complete selective installation: one capability for one platform, staging/store, receipts, update/remove, and matching audit. R1–R3. | M1 | Single-skill lifecycle works in an isolated target; unrelated content preserved; repeat apply is a no-op; another selection remains usable after regeneration/removal |
| M3 | Global-only selected-platform setup through the same lifecycle core; guards and settings migration. R1/R4/R5. | M2 | Codex-only does not require/mutate Claude; exact owned hook replacement; shared policy retained; legacy configuration conflicts and failure recovery tested |
| M4 | Project-only setup, verification/CI options, domain/tracker contracts and project adapters with owned lifecycle. R3/R5/R7. | M2 | No machine writes; existing project verifier/settings preserved; shipped runtime self-contained; generated adapter drift checked by the selected gate; CI dependencies complete |
| M5 | Workflow installation and conditional requirements; router lists installed/available capabilities accurately. | M2 | Implementation workflow obtains required skills; routes stay optional; one discovery entry per ID; invocation metadata unchanged; missing project contracts use the documented fallback or explain prerequisites |
| M6 | Generalized provenance/resource acquisition and existing integration adapters; add Graphify and then Archify using the shared module interface. R6/R8. | M3, M4, M5 | Pinned sources/resources validated; vendor scripts cannot silently take ownership of shared settings; all Graphify capabilities exposed; install/query/activation/removal tested independently; no automatic agent memory |
| M7 | Logical architecture view and cost inventory generated from catalog/receipts; evaluate Graphify interchange. R9. | M3, M4, M5 | Global → platform → capability → source navigation; workflow/skill/tool edges visible; missing references fail validation; measured token data preserved; clearly distinguish planned, installed, and observed state |
| M8 | Full-profile migration rehearsal, optional source-folder moves, documentation and compatibility cleanup. R1–R10. | M6, M7 | Legacy full profile migrates without loss; no stale path references or broken links; all selected profiles and repository verification pass |

M3, M4 and M5 can progress independently after M2 if implementation work is intentionally divided. M7 does not need M6 to build a useful catalog view. A C# evaluation on Westcoast Cars is independent of these installer slices; it must not substitute for synthetic installation fixtures.

### Test matrix required before real installation

- Selections: single skill, workflow with dependencies, global-only, project-only, integration-only, full managed profile; Claude-only, Codex-only, both where supported.
- State: fresh, already applied, upgraded, removed, locally edited, unowned collision, missing dependency, malformed receipt and interrupted application.
- Paths: spaces, case variants, symlink/junction roots, stale links, filesystem aliases, traversal, and target changed after planning.
- Ownership: two consumers of one payload, overlapping platform/scopes, existing hooks and settings, prior `core.hooksPath`, legacy copies/links without receipts.
- Behavior: denied Git/secret/attribution paths remain denied; untouched selections remain usable; tools receive literal argument arrays and no accidental shell expansion.
- Platforms: run the portable process/installation tests on Windows and macOS/Linux; current Linux-only CI is not evidence of Windows execution.
- Verification: new tests are registered in the actual test runner; retain CI template scanning; generated project adapter checks run when selected; ignored tool caches are not mistaken for harness source.
- Isolation: use explicit fixture targets, fake tool commands and temporary directories; no developer-home writes or live skill relinking during tests.

Do not exhaustively test every Cartesian combination. Cover the listed risks at meaningful interfaces, with representative combinations and failure injection. Preserve existing security behavior and useful tests while replacing brittle path/source-string assertions where a behavior test is stronger.

## Remaining implementation choices

These are design tasks within the agreed scope, not missing product decisions: exact manifest schema and CLI syntax, stable installation-store layout, representation of per-setting ownership, and the minimal renderer/interchange format. Resolve them in the appropriate slice and document the chosen contract. Escalate only if evidence requires a product change such as another public module, changed default policy, or unavoidable loss of existing user configuration.

Physical source moves are optional and come last. Avoid a package-manager framework, plugin marketplace, remote service, custom-agent module or graph-execution framework unless a later requirement justifies one. Preserve the single canonical source of each skill/workflow.

## Fresh-task handoff

Copy this request into a fresh task attached to this repository:

> Implement the modular harness in `/Users/manuelalmeida/dev/ai-harness-template`. Read `docs/dev/harness-modularity-plan.md` in full, then `docs/dev/harness-modularity-review.md` and the living adoption checklist. The review baseline is `a31e26aa1a9d6fdec2f61ca33c50ba32187b307c`; inspect the current branch and changes because the planning commits are later than that baseline. The five agreed public modules are Global configuration, Project configuration, Skills, Workflows and Tool integrations, backed by an Installation core and Shared policy/runtime. Keep one repository, explicit dependencies, one canonical source per capability, user-selectable platform/scope, and the existing full managed profile. Graphify is adopted with all capabilities and user invocation; Archify is an agreed user-invoked trial. Westcoast Cars is selected for separate C# evaluation, but its location/commit/coverage are still unconfirmed. Follow slices M0–M8, beginning with the safety corrections and isolated fixtures before selective installation. Keep each completed slice verified and locally committed. Do not move source folders first, use a temporary worktree as the installed runtime, or apply test operations to the real user profile. Work on a human-named `feature/<topic>` branch, preserve unrelated changes, run `node scripts/verify.mjs` to completion, and never push a feature branch. Update the checklist with evidence after each slice. Carry unresolved details in these documents so the task needs no previous conversation context.
