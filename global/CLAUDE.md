# Global preferences (all projects) — copy to ~/.claude/CLAUDE.md and edit to taste

- I do all `git commit` and `git push` myself. Leave changes in the working tree, summarize them, and suggest a commit message if useful — never commit or push.
- Repos must not look AI-assisted: never commit AI tooling files (AGENTS.md, CLAUDE.md, .claude/, .mcp.json, .githooks/, AI docs). Keep them local via .gitignore or .git/info/exclude. Standard security/quality tooling (CodeQL, Dependabot, analyzers, tests) is fine to commit — it carries no AI signature.
- Security first: treat every endpoint/input as attacker-reachable; prefer the secure default; flag anything that weakens security instead of silently accepting it.
- Never read, print, or commit secrets (.env files, keys, tokens) — use the project's secret mechanism.
- Work on feature branches, never directly on main.
- I'm a .NET/C#/TypeScript developer who vibe-codes: verify your own work (build, tests, format, exercise the change) before calling it done, and explain AI-tooling concepts plainly when they come up.
