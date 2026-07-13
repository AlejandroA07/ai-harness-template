@AGENTS.md

## Claude-specific notes

- Use the project skills when they apply: `migrate` (EF Core migrations per module), `db` (read-only Postgres inspection), `security-checklist` (endpoint review), `retro` (weekly harness compost).
- Harness quick reference (mode switch, standing goals, inventory): `.claude/HARNESS.md`.
- Before finishing a nontrivial change, run `/verify`; before a PR, run `/code-review` and `/security-review`.
- The app can be driven end-to-end via the Playwright MCP server once it's running locally.
