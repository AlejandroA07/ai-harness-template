# Plan: make the harness understandable and selectively adoptable

- **Status:** proposal for a separate implementation task
- **Scope:** repository organization, selective installation, and a readable architecture map
- **Graphify decision:** remains in discussion; this plan does not change its installation or activation policy

## Problem and current evidence

The current Graphify tree shows physical files and extracted symbols. It does not explain what a person can adopt, how instructions activate, or which configuration applies globally versus to one project.

The retained tree shows eight JSON property nodes under `global/claude-settings.json`, including nested keys flattened beneath the file. That total counts extracted nodes, not capabilities, tokens, or activations. Markdown guidance and `.template` configuration files were excluded from the code-only pilot, so the absence of Codex guidance is an extraction gap.

The repository already separates `global/`, `project/`, `skills/`, and `components/`. However, [machine setup](../../scripts/machine-setup.mjs) preflights and synchronizes the complete skill inventory while configuring both platforms. The [README](../../README.md) documents this exact-inventory policy. Selective adoption therefore requires installation and audit changes, not only new folders.

## Proposed user-facing modules

| Module | What someone chooses | Existing implementation |
|---|---|---|
| Global configuration | Machine-wide preferences and controls for Claude, Codex, or both | `global/` and machine setup/settings merge scripts |
| Project configuration | Repository guidance, local verification, and optional CI | `project/`, bootstrap and project-configuration scripts |
| Skills and workflows | Individual capabilities or a workflow such as plan → tickets → implement | `skills/`, invocation policy, generation and synchronization |
| Tool integrations | Optional external programs and MCP connections | `components/mcp/`; future integrations when adopted |

Shared guards, generation, installation, and audit machinery support these modules. Expose their required dependencies without making users select every internal helper.

Treat workflows as compositions of skills, with one canonical implementation. Add a separate agents category only when an actual reusable agent definition needs independent ownership.

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
├── Skills and workflows
│   ├── Individual skills
│   └── Workflow compositions
├── Tool integrations
└── Shared installation and audit machinery
```

This is a proposed logical view. These modules are not independently installable today.

## Implementation sequence

1. Inventory responsibilities: what each module provides, source files, dependencies, target scope, and activation mechanism. Distinguish instructions read by an agent from programs triggered by commands or hook events.
2. Define global-only, project-only, selected-skills, and full-harness installation contracts. Allow platform selection and specify required dependencies and uninstall ownership.
3. Resolve the inventory-policy change: selected-skills installation must preserve unrelated user skills. Retain exact-inventory behavior as an explicitly selected managed profile. Update preflight, synchronization, audit, and tests together.
4. Add a small declarative architecture catalog with stable IDs, human labels, source references, and explicit relationships: contains, depends-on, installs, and activates. Keep detailed prose in existing documents.
5. Generate an overview from that catalog: purpose → platform configuration → source file → individual setting. Include the command or event that activates each behavior.
6. Evaluate a documented Graphify import/export or merge interface for combining this catalog with extracted source evidence. Keep declared relationships distinguishable from extracted and inferred relationships. If interoperability is unsuitable, link the generated architecture view to the separate Graphify code view.
7. Move folders only where it improves ownership. Preserve canonical sources; migrate paths, scripts, tests, and documentation together. Keep Markdown as Markdown rather than converting it into code solely for the extractor.

A deterministic catalog renderer would use local compute to regenerate the overview. Authoring and maintaining the catalog still costs human or agent effort. The catalog describes structure and activation; it does not measure actual model reads or token usage.

## Completion checks

- Global-only installation can select a platform without installing unrelated skills.
- Selected-skills installation preserves unrelated user skills and resolves declared dependencies.
- Project-only installation changes only the selected repository and its declared configuration.
- Existing full-harness installation remains supported.
- Workflow instructions retain one canonical source.
- Catalog references resolve; missing files and invalid relationships fail validation.
- The overview explains a complete path from a request or hook event to the loaded skill or executing program.
- `node scripts/verify.mjs` exits with code 0.

## Handoff to another task

> Implement `docs/dev/harness-modularity-plan.md`. Begin with the responsibility catalog and selective-installation contract, then implement and test the smallest useful selection. Preserve the full-harness profile and derive the architecture overview from reviewable declarations. Treat Graphify integration as an independent decision and verify any interchange mechanism before depending on it.
