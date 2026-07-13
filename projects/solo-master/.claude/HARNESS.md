# Solo Master — harness operating card (local-only, never committed)

One page: what this repo's harness consists of and how to operate it. Full history in `docs/04` (integration plan) and `docs/06` (review fixes); concepts in `~/dev/ai-harness-template/` (state matrix: `HARNESS-PARITY.md`). Last synced: 2026-07-14.

## Inventory

| Piece | Where | Notes |
|---|---|---|
| Source of truth | `AGENTS.md` (+ thin `CLAUDE.md`) | Codex reads AGENTS.md natively |
| Final vote | `scripts/verify.sh` | locked restore → Release build → format gates → tests |
| Standing goals (4) | `.claude/goals/` | hooks-path, no-env-tracked, gitleaks self-test, zizmor-clean (architecture goal deferred until boundaries exist) |
| Project skills | `.claude/skills/` | `security-checklist`, `retro`, `git` (dormant) (role skills global in `~/.claude/skills/`) |
| Git autonomy (dormant) | `.claude/git-autonomy.sh` + `.claude/skills/git/` | default **OFF** (added 2026-07-14); levels off→commit→push→pr, only Manuel flips; Claude-side only — the Codex publish guard stays on regardless |
| OS sandbox (dormant) | `.claude/sandbox-mode.sh` | default **OFF** (added 2026-07-14); prerequisite for any Tier 2 loop/schedule |
| Guards — Claude | `.claude/settings.json` + `~/.claude/settings.json` | deny: `.env*` reads, all `git commit`/`git push` |
| Guards — Codex | `.codex/config.toml` → `.harness/hooks/guard-git-publish.sh` | **best-effort** PreToolUse guard denies commit/push (tested, incl. full-path `…/git`; shell-quoting tricks can still evade it — it stops accidents, not adversaries); Stop hook formats changed C# |
| Secret scan | `.githooks/pre-commit` (gitleaks) | `core.hooksPath .githooks`; self-test is a standing goal |
| CI | `.github/workflows/` | verify.sh job, vuln-package gate, gitleaks history scan, CodeQL; SDK pinned via `global-json-file`; zizmor-clean |
| Analyzers | `Directory.Build.props` / `Directory.Packages.props` | `latest-recommended` + SonarAnalyzer, `TreatWarningsAsErrors`; tests on xunit.v3 |

## Operating it

```bash
.claude/harness-mode.sh auto|manual|status   # Claude autonomy dial (Codex autonomy = its own approval/sandbox settings)
.claude/git-autonomy.sh off|commit|push|pr|status   # dormant git system — default OFF, Manuel-only switch
.claude/sandbox-mode.sh on|off|status        # dormant OS sandbox — default OFF, Manuel-only switch
./.claude/verify-goals.sh                    # re-verify standing goals
./scripts/verify.sh                          # the definition of done
```

## Deferred on purpose (add when the trigger arrives — see docs/04)

Architecture tests (first extracted layer) · migrate/db skills + Playwright MCP (first DB / first real UI flow) · deploy skill (first deployment) · coverage/mutation (meaningful suite).

## Local-only policy

`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.codex/`, `.harness/`, `.githooks/`, `docs/` are hidden via `.git/info/exclude`. Committable tree is AI-neutral (src, tests, scripts, .github, props, README). Manuel does all commits and pushes himself — also mechanically denied for both agents (Claude: deny rules + dormant git-autonomy at OFF; Codex: publish guard).
