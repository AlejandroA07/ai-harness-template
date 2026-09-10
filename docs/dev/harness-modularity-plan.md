# Plan: make the harness understandable and selectively adoptable

- **Status:** five-module direction agreed; implementation pending in a separate task
- **Scope:** repository organization, selective installation, and a readable architecture map
- **Graphify decision:** adopt with all capabilities in Tool integrations, available across projects and invoked by the user. Watchers, Git hooks, semantic document processing, and MCP are supported configuration choices; availability does not automatically activate them everywhere.

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

> Implement `docs/dev/harness-modularity-plan.md` with five modules: Global configuration, Project configuration, Skills, Workflows, and Tool integrations. Keep one repository and shared setup machinery, with module-specific installation definitions and explicit dependencies. Start with the smallest working selective-installation foundation, preserve the full-harness profile, and then integrate Graphify with all capabilities and user invocation. Derive the architecture overview from reviewable declarations and verify any Graphify interchange mechanism before depending on it. Westcoast Cars is the selected C# evaluation repository; its baseline preparation is tracked separately.
