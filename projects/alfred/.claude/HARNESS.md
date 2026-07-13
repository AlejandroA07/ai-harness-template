# Alfred — harness operating card (local-only, never committed)

One page: what this repo's harness consists of and how to operate it. Concepts and full write-ups live in `~/dev/ai-harness-template/` (start with `README.md`; per-project state matrix in `HARNESS-PARITY.md`). Last synced: 2026-07-14.

## Inventory

| Piece | Where | Notes |
|---|---|---|
| Source of truth | `AGENTS.md` (+ thin `CLAUDE.md`) | architecture, commands, laws, definition of done |
| Final vote | `scripts/verify.sh` | locked restore → build → format/lint → tests → frontend build |
| Standing goals (5) | `.claude/goals/` | hooks-path, no-env-tracked, gitleaks self-test, zizmor-clean, architecture-rules |
| Project skills | `.claude/skills/` | `migrate`, `db`, `security-checklist`, `retro`, `git` (dormant) (role skills are global in `~/.claude/skills/`) |
| Guards | `.claude/settings.json` + `~/.claude/settings.json` | deny: `.env*` reads, all `git commit`/`git push`; format-on-stop hook; gitleaks pre-commit (`core.hooksPath .githooks`) |
| Git autonomy (dormant) | `.claude/git-autonomy.sh` + `.claude/skills/git/` | default **OFF** (Manuel commits/pushes himself); levels off→commit→push→pr, only Manuel flips; activation also needs the global deny removed (script prints the edit) |
| OS sandbox (dormant) | `.claude/sandbox-mode.sh` | default **OFF**; `on` = Seatbelt confinement per tiers doc (docker excluded, ssh/aws denied) — prerequisite for any Tier 2 loop/schedule |
| CI | `.github/workflows/` | format gate, locked restore, build, tests + coverage report/PR comment, vuln-package gate, gitleaks history scan, CodeQL, Dependabot; zizmor-clean |
| Analyzers | `Directory.*.props` | `latest-recommended` + SonarAnalyzer, `TreatWarningsAsErrors` solution-wide |
| Mutation testing | `dotnet stryker` | on demand only — slow, never in verify.sh/CI |
| MCP | `.mcp.json` | Playwright (drive the real app), Context7 (current library docs) |

## Operating it

```bash
.claude/harness-mode.sh auto|manual|status   # autonomy dial (deny rules never affected)
.claude/git-autonomy.sh off|commit|push|pr|status   # dormant git system — default OFF, Manuel-only switch
.claude/sandbox-mode.sh on|off|status        # dormant OS sandbox — default OFF, Manuel-only switch
./.claude/verify-goals.sh                    # re-verify standing goals (ledger: .claude/goals/ledger.tsv)
./scripts/verify.sh                          # the definition of done
```

Workflow: plan mode first → feature branch → `/verify` → `/code-review` + `/security-review` before PR → CI is the judge → agent gets something wrong twice ⇒ one sentence in AGENTS.md (the `retro` skill mines this weekly-ish).

## Local-only policy

AI files (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.mcp.json`, `.githooks/`, `docs/`) are hidden via `.git/info/exclude` — `git status` must never show them. Committed files (CI, analyzers, tests, scripts) carry no AI signature. Manuel does all commits and pushes himself — also mechanically denied for agents (unless he personally raises the dormant `git-autonomy.sh` level, default OFF).
