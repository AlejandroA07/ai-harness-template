# Global configuration review backlog

This document keeps the global harness review small and sequential. For each pending item, first explain the current behavior and evidence, then recommend a change, obtain a decision, document that decision when necessary, and only then implement it.

## Completed

1. **Branch publication authorization** — Completed. Written policy determines which branch families an agent may publish. The executable push guard now checks only safety properties such as the current branch, the `origin` remote, default-branch protection, and dangerous push forms.
2. **Repository verification** — Completed. `node scripts/verify.mjs` owns test selection and normally returns only `PASS`, concise warnings, or a bounded failure diagnostic. The decision and rationale are recorded in [ADR 0001](adr/0001-token-efficient-verification.md).
3. **Remote tracking of harness, agent, and documentation files** — Completed. These files use normal repository behavior. Redundant instructions to commit them were removed; only explicit local-state and secret ignore rules remain.
4. **Branch creation and commit authorization** — Completed. Branch naming is a short non-default-branch preference, not an executable restriction. The pre-commit hook no longer rejects branch families; verification, secret scanning, user-work protection, and push safety remain separate controls.
5. **Destructive Git restrictions** — Completed. Direct broad deletion of files, uncommitted work, stashes, and worktrees remains blocked. Recovery and cleanup operations such as `reset --merge`, `reset --keep`, and forced local branch deletion are allowed.
6. **GitHub operation permissions** — Completed. Pull-request merges, release creation/editing, and workflow run/rerun/cancel actions are allowed when explicitly requested. Deletion, repository/security settings, credentials, forced operations, and unrestricted API mutations remain blocked.
7. **Secret-protection layers** — Completed. One canonical secret policy now supplies Claude denials, runtime path checks, and pre-commit filename checks. Harmless searches and text references are allowed, while real reads, redirections, commits, history scans, and CI scans remain protected.
8. **Model/tool attribution restrictions** — Completed. Claude's automatic co-author trailer remains disabled. Commit messages, PR titles/descriptions, and tool-branded branch prefixes are checked; ordinary source and documentation files are not scanned. Claude and Codex receive one short global preference to use plain text without emojis.
9. **Claude CLI tool selection** — Completed. Permission denials no longer pretend to reduce context. A configurable launcher passes the developer allowlist through Claude's native `--tools` option; settings retain only focused safety denials.
10. **Agent memory defaults** — Completed. The harness no longer instructs agents about memory or changes Claude or Codex memory settings.
11. **Repeated global instructions** — Completed. Claude and Codex retain their required global entry files. Project guidance now contains project-specific architecture, commands, security boundaries, workflow, and completion criteria without repeating global Git, branch, attribution, or user-work preferences.
12. **Hook scope and overhead** — Completed. Keep the silent deterministic hook for shell commands and protected reads because successful checks add no model context. The guard now covers destructive Git variants, common credential files, secret-like environment variables, bounded input, and bounded branch lookup while allowing targeted non-secret environment reads.
13. **Global versus project authority** — Completed. Machine setup owns universal Claude and Codex behavior: global guidance, command guards, secret-read denials, attribution preferences, and hook activation. Project setup owns only repository-specific guidance, skill adapters, domain/tracker contracts, Git hooks, and portable verification. It no longer creates or edits project-level Claude/Codex settings.

## Pending review

14. **Installation, ownership, migration, and audit complexity** — Completed. The obsolete project-policy migration, checkout-bound skill synchronizer, mixed machine/template audit, and their implementation-specific tests were removed. Project setup has one public command, `bootstrap.mjs`, and one audit/verification gate, `verify-harness.mjs`. Machine setup has one public receipt-backed command whose `audit` operation checks installed state. Repository verification remains `verify.mjs`.

## Separate architecture follow-up

The earlier Graphify concern remains a separate review track:

- determine why Graphify emphasizes conceptual relationships rather than the five expected modules;
- verify whether the refactor created real module boundaries or mainly directory and configuration separation;
- improve context separation so each module can be reviewed independently.
