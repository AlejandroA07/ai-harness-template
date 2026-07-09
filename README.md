# AI Harness Template

Portable starter kit for the AI coding harness: context files (AGENTS.md), guardrails (permissions, hooks, secret scanning), and verification (CI security, analyzers, architecture tests). Tool-agnostic where possible — works with Claude Code today, adaptable to Codex or others (see the mapping table in `reference-implementation.md`).

| Read this | When |
|---|---|
| `MACHINE-SETUP.md` | New machine — tools, global Claude config, carrying this template around |
| `BOOTSTRAP.md` | New (or existing) project — step-by-step, executable by a human or an AI agent |
| `reference-implementation.md` | The full write-up of the original implementation: component inventory, on/off toggle table, Claude↔Codex mapping, roadmap |

Contents:

```
project/            # copy into a repo root, then follow BOOTSTRAP.md
  .claude/          #   agent permissions, format-on-stop hook, security-checklist skill
  .githooks/        #   gitleaks pre-commit (modern `gitleaks git` syntax)
  .mcp.json         #   Playwright + Context7 MCP servers
  .github/          #   CodeQL, Dependabot, secret-scan job (committed — no AI signature)
  AGENTS.md.template
  CLAUDE.md
dotnet-extras/      # analyzers snippet + architecture-tests example (.NET projects)
global/             # ~/.claude machine-wide settings + personal CLAUDE.md template
```

Golden rule of the whole harness: **you don't review every line an AI writes, so the harness has to** — context teaches the agent, guardrails are enforced by tooling not trust, and verification (tests, scanners, CI) is the judge.
