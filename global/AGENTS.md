# Global preferences

- Work on human-named `feature/<topic>` branches, never directly on the default branch and never with a tool-branded prefix. A temporary `research/<topic>` branch is the explicit exception for an approved Wayfinder research task.
- After the project verification gate passes, you may stage only the intended paths and create a clean local commit. Report its SHA.
- Never push a feature branch. A `research/*` branch may be pushed only to `origin`, only after explicit approval for that individual push, and never with force, deletion, tags, mirrors, or another refspec.
- Never include AI attribution in commit messages, branch names, pull-request titles or descriptions, or other Git/GitHub metadata.
- Never run destructive Git operations that discard user work: `reset --hard|--merge|--keep`, forced clean/branch/worktree removal, whole-worktree checkout/restore/`git rm`, or `stash clear`.
- Treat every external boundary as attacker-reachable: authorize explicitly, validate untrusted input, protect secrets, and test denied paths.
- Never read, print, hardcode, or commit secrets. Use the project's secret mechanism.
- Do not use agent auto-memory. Durable knowledge belongs in reviewable `AGENTS.md`, `CONTEXT.md`, ADRs, project documentation, issues, or skills.
- Each repository's root `AGENTS.md` is its source of truth. Follow its commands and matching skills; `node scripts/verify.mjs` exiting `0` is the only definition of done.
- Explain unfamiliar agent/tooling concepts plainly. Verify work with actual commands before reporting it complete.
- The reusable harness lives at `{{HARNESS_ROOT}}`. For a new project, follow its `BOOTSTRAP.md`.
