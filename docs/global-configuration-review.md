# Global configuration review backlog

This document keeps the global harness review small and sequential. For each pending item, first explain the current behavior and evidence, then recommend a change, obtain a decision, document that decision when necessary, and only then implement it.

## Completed

1. **Branch publication authorization** — Completed. Written policy determines which branch families an agent may publish. The executable push guard now checks only safety properties such as the current branch, the `origin` remote, default-branch protection, and dangerous push forms.
2. **Repository verification** — Completed. `node scripts/verify.mjs` owns test selection and normally returns only `PASS`, concise warnings, or a bounded failure diagnostic. The decision and rationale are recorded in [ADR 0001](adr/0001-token-efficient-verification.md).

## Pending review

3. **Remote tracking of harness and agent artifacts** — Requested direction: stable, portable, secret-free harness and agent files should be committed and publishable to the repository remote. A file must not remain local merely because it belongs to an agent or the harness. Audit `.gitignore`, bootstrap, selective project installation, generated adapters, receipts, documentation, and CI so this is consistent for files such as `AGENTS.md`, `CLAUDE.md`, `.harness/` sources and runtime, `.agents/skills/`, `.claude/skills/`, hooks, verification scripts, and durable agent documentation. Secrets, credentials, caches, transcripts, temporary files, approval/session state, and absolute machine-specific state remain local. Current bootstrap documentation already says to commit portable harness files and generated skill adapters, so this item is partly an audit for contradictions or older behavior rather than an assumption that everything is currently local.
4. **Branch creation and commit authorization** — Decide whether executable code should prevent commits outside `feature/*`, `research/*`, and `prototype/*`, or whether branch-family selection should be written guidance while the hook protects only user work and irreversible operations.
5. **Destructive Git restrictions** — Review every blocked reset, clean, checkout, restore, stash, branch, and worktree operation. Keep protections that prevent unrecoverable loss and remove restrictions that unnecessarily block safe recovery or normal work.
6. **GitHub operation permissions** — Decide how much ordinary GitHub collaboration agents may perform. Review the current restrictions on pull-request merges, releases, workflow control, repository settings, authentication, secrets, and mutating API calls separately from the decision to track agent and harness files remotely.
7. **Secret-protection layers** — Review Claude permission denials, global command/read hooks, pre-commit checks, and Gitleaks. Preserve meaningful secret protection while removing duplication and false-positive behavior.
8. **Model/tool attribution restrictions** — Decide whether to retain the checks that reject model/tool authorship markers, commit trailers, selected phrases, and the robot emoji.
9. **Disabled built-in tools** — Review the current denials for scheduling, monitoring, worktrees, notifications, workflows, notebooks, file sending, and related Claude tools. Remove denials that no longer match the desired level of agent autonomy.
10. **Auto-memory policy** — Confirm whether automatic agent memory should remain disabled and whether durable knowledge should continue to live only in reviewable repository artifacts.
11. **Repeated global instructions** — Review duplication across global `AGENTS.md`, global `CLAUDE.md`, project guidance, skills, and documentation. Keep only duplication required by different platform entry points and move conditional detail behind concise pointers.
12. **Hook scope and overhead** — Review why the global hook runs for every shell command and protected file read. Reduce it to security-critical deterministic checks where broader policy can safely remain written guidance.
13. **Global versus project authority** — Clarify which rules must apply on every machine and which belong to a repository's root `AGENTS.md`. Project guidance should be the source of truth for project-specific commands and conventions.
14. **Installation, ownership, migration, and audit complexity** — After the policy review stabilizes, identify scripts, receipt fields, migrations, compatibility paths, and tests that no longer support wanted behavior and can be removed safely.

## Separate architecture follow-up

The earlier Graphify concern remains a separate review track:

- determine why Graphify emphasizes conceptual relationships rather than the five expected modules;
- verify whether the refactor created real module boundaries or mainly directory and configuration separation;
- improve context separation so each module can be reviewed independently.
