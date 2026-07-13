@AGENTS.md

## Claude-specific notes

- Use the project skills when they apply: `migrate` (EF Core migrations), `new-feature` (vertical-slice scaffolding), `db` (read-only inspection), `deploy`, `security-checklist` (endpoint review), `retro` (weekly harness compost).
- Harness quick reference: `.claude/HARNESS.md`; full manual: `docs/ai-harness.md`.
- Before finishing a nontrivial change, run `/verify`; before a PR, run `/code-review` and `/security-review`.
- The app can be driven end-to-end via the Playwright MCP server against http://localhost:5002 once `docker compose up` is running.
