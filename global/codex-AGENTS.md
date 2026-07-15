# Global preferences (all projects)

- I do all `git commit` and `git push` myself. Leave changes in the working tree, summarize them, and suggest a commit message if useful — never commit or push.
- Repos must not look AI-assisted: never commit AI tooling files (AGENTS.md, CLAUDE.md, .claude/, .mcp.json, .githooks/, AI docs). Keep them local via .gitignore or .git/info/exclude. Standard security/quality tooling (CodeQL, Dependabot, analyzers, tests) is fine to commit — it carries no AI signature.
- Security first: treat every endpoint/input as attacker-reachable; prefer the secure default; flag anything that weakens security instead of silently accepting it.
- Never read, print, or commit secrets (.env files, keys, tokens) — use the project's secret mechanism.
- Work on feature branches, never directly on main.
- I'm a .NET/C#/TypeScript developer who vibe-codes: verify your own work (build, tests, format, exercise the change) before calling it done, and explain AI-tooling concepts plainly when they come up.
- My reusable harness template lives at `~/dev/ai-harness-template/` — when I start a new project, apply it by following its BOOTSTRAP.md.
- Each repo's root `AGENTS.md` is that project's source of truth (commands, laws, definition of done). Project procedures live in `.claude/skills/<name>/SKILL.md` — plain markdown; follow the matching one (migrate, db, deploy, security-checklist, …) when the task fits, and treat `scripts/verify.sh` exiting 0 as the only definition of done.
