# Global configuration review backlog

This document keeps the global harness review small and sequential. For each pending item, first explain the current behavior and evidence, then recommend a change, obtain a decision, document that decision when necessary, and only then implement it.

## Completed

1. **Branch publication authorization** — Completed. Written policy determines which branch families an agent may publish. The executable push guard now checks only safety properties such as the current branch, the `origin` remote, default-branch protection, and dangerous push forms.
2. **Repository verification** — Completed. `node scripts/verify.mjs` owns test selection and normally returns only `PASS`, concise warnings, or a bounded failure diagnostic. The decision and rationale are recorded in [ADR 0001](adr/0001-token-efficient-verification.md).
3. **Remote tracking of harness, agent, and documentation files** — Completed. These files use normal repository behavior. Redundant instructions to commit them were removed; only explicit local-state and secret ignore rules remain.
4. **Branch creation and commit authorization** — Completed. Branch naming is a short non-default-branch preference, not an executable restriction. The pre-commit hook no longer rejects branch families; verification, secret scanning, user-work protection, and push safety remain separate controls.
5. **Destructive Git restrictions** — Completed. Direct broad deletion of files, uncommitted work, stashes, and worktrees remains blocked. Recovery and cleanup operations such as `reset --merge`, `reset --keep`, and forced local branch deletion are allowed.
10. **Agent memory defaults** — Completed. The harness no longer instructs agents about memory or changes Claude or Codex memory settings.

## Pending review

6. **GitHub operation permissions** — Decide how much ordinary GitHub collaboration agents may perform. Review the current restrictions on pull-request merges, releases, workflow control, repository settings, authentication, secrets, and mutating API calls separately from the decision to track agent and harness files remotely.
7. **Secret-protection layers** — Review Claude permission denials, global command/read hooks, pre-commit checks, and Gitleaks. Preserve meaningful secret protection while removing duplication and false-positive behavior.
8. **Model/tool attribution restrictions** — Decide whether to retain the checks that reject model/tool authorship markers, commit trailers, selected phrases, and the robot emoji.
9. **Disabled built-in tools** — Review the current denials for scheduling, monitoring, worktrees, notifications, workflows, notebooks, file sending, and related Claude tools. Remove denials that no longer match the desired level of agent autonomy.
11. **Repeated global instructions** — Review duplication across global `AGENTS.md`, global `CLAUDE.md`, project guidance, skills, and documentation. Keep only duplication required by different platform entry points and move conditional detail behind concise pointers.
12. **Hook scope and overhead** — Review why the global hook runs for every shell command and protected file read. Reduce it to security-critical deterministic checks where broader policy can safely remain written guidance.
13. **Global versus project authority** — Clarify which rules must apply on every machine and which belong to a repository's root `AGENTS.md`. Project guidance should be the source of truth for project-specific commands and conventions.
14. **Installation, ownership, migration, and audit complexity** — After the policy review stabilizes, identify scripts, receipt fields, migrations, compatibility paths, and tests that no longer support wanted behavior and can be removed safely.

## Separate architecture follow-up

The earlier Graphify concern remains a separate review track:

- determine why Graphify emphasizes conceptual relationships rather than the five expected modules;
- verify whether the refactor created real module boundaries or mainly directory and configuration separation;
- improve context separation so each module can be reviewed independently.
