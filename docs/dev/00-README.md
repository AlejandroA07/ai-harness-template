# Development documentation

Current state: M0–M8 are implemented and verified. PR #31 head `6503a3d`
passed the Windows portability, repository verification, security and CodeQL
checks before merge. The 2026-09-25 M8.1 hardening follow-up adds retained-state
removal, exact legacy-payload validation and aggregate target serialization.

| File | What it contains | Kind |
|---|---|---|
| `decisions.md` | Implementation decisions that should remain stable across changes. | living log |
| `harness-modularity-plan.md` | Agreed five-module direction: global configuration, project configuration, separate skills and workflows, and tool integrations; selective setup and architecture catalog plan. | implementation plan |
| `modularity-m2-installation.md` | Selective machine-skill commands, store and receipt ownership, update/removal, recovery and acceptance evidence. | implementation contract |
| `modularity-m5-workflows.md` | Canonical project Skills, workflow composition, routing status, prerequisites and M4 coexistence. | implementation contract |
| `modularity-m6-tool-integrations.md` | Pinned integration acquisition, executable runtime materialization, activation, ownership and removal. | implementation contract |
| `modularity-m7-architecture-cost.md` | Catalog-derived architecture navigation, receipt-backed state, cost inventory and Graphify interchange decision. | implementation contract |
| `modularity-m8-migration.md` | Full managed profile, exact legacy migration, compatibility boundary, recovery and acceptance evidence. | implementation contract |
| `modularity-foundation-review.md` | M0–M3 completion review, reproduced ownership/removal/activation defects and M4 receipt compatibility explanation. | source review |
| `receipt-migration.md` | Read-only receipt assessment and reviewed recovery without trusting older ownership claims. | recovery procedure |
| `modularity-foundation-follow-up-plan.md` | Prioritized foundation repairs and acceptance checks required before M5. | implementation plan |
| `harness-modularity-review.md` | Whole-repository ownership map, proposed classification of 22 capabilities, migration blockers R1–R10, and evidence supporting the implementation sequence. | source review |
| `graph-and-quality-adoption-roadmap.md` | Living eight-step checklist for learning, evaluations, project-local quality gates, and later harness decisions. | living roadmap |
| `2026-09-10-graphify-architecture-quality-follow-up.md` | Current conclusions, Graphify pilot evidence, Archify/Roslyn comparison, activation/token map, and decided-versus-open checklist. | dated report |
| `2026-08-19-graph-and-quality-tooling.md` | Teaching guide and disposition for graph engineering, Graphify, architecture viewing, CRAP, and agent quality gates. | dated report |
| `2026-08-17-macos-skill-link-paths.md` | macOS filesystem-alias compatibility fix for managed skill links. | dated report |
