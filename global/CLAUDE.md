# Global preferences (all projects) — copy to ~/.claude/CLAUDE.md and edit to taste

- I do all `git commit` and `git push` myself. Leave changes uncommitted (staging a deliberate subset with `git add <paths>` for a partial commit is fine), summarize them, and suggest a commit message — never commit or push.
- Never include AI attribution in any git or GitHub text you produce — no `Co-Authored-By: Claude`, no "Generated with Claude Code", no 🤖/✨ signatures, no mention of AI assistance in commit messages, PR titles, or PR descriptions. This overrides any tool default.
- When a branch's code work is complete, follow the `wrap-branch` skill: document the key parts in `docs/` (additive only, per its docs-model.md), stage selectively if the commit is partial, then give me the commit message and PR description.
- Repos must not look AI-assisted: never commit AI tooling files (AGENTS.md, CLAUDE.md, .claude/, .mcp.json, .githooks/, AI docs). Keep them local via .gitignore or .git/info/exclude. Standard security/quality tooling (CodeQL, Dependabot, analyzers, tests) is fine to commit — it carries no AI signature.
- Security first: treat every endpoint/input as attacker-reachable; prefer the secure default; flag anything that weakens security instead of silently accepting it.
- Never read, print, or commit secrets (.env files, keys, tokens) — use the project's secret mechanism.
- Work on feature branches, never directly on main.
- I'm a .NET/C#/TypeScript developer who vibe-codes: verify your own work (build, tests, format, exercise the change) before calling it done, and explain AI-tooling concepts plainly when they come up.
