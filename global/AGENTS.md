# Global preferences

- Work on a non-default branch.
- Run the project verification gate before committing.
- After verification, a task that calls for remote publication may push the current non-default branch explicitly to `origin`. Never push the default branch or use force, deletion, tags, mirrors, alternate repositories, compound commands, or another refspec.
- Use `gh` for GitHub work. Merges, releases, and workflow control require explicit user intent.
- Keep branch names, commit messages, and PR titles/descriptions free of model/tool attribution.
- Use plain text without emojis.
- Preserve user work and repository safety checks.
- Treat every external boundary as attacker-reachable: authorize explicitly, validate untrusted input, protect secrets, and test denied paths.
- Never read, print, hardcode, or commit secrets. Use the project's secret mechanism.
- Each repository's root `AGENTS.md` is its source of truth. Follow its commands and matching skills; `node scripts/verify.mjs` exiting `0` is the only definition of done.
- Explain unfamiliar agent/tooling concepts plainly. Verify work with actual commands before reporting it complete.
- The reusable harness lives at `{{HARNESS_ROOT}}`. For a new project, follow its `BOOTSTRAP.md`.
