# Harness parity — alfred vs car-dealer vs solo-master

Last full audit: **2026-07-15** (previous: 2026-07-14, 2026-07-12). Audits are now partially executable: `./audit-harness.sh` checks most guardrail rows mechanically.

> **2026-07-15 audit (external Codex review verified & applied):** MANUAL mode made honest everywhere — stable `settings.json` allow-lists emptied (alfred + solo-master had drifted from the car-dealer design; the mode-managed local file is the only allow source) and MANUAL now writes `"ask": ["Bash"]` for literal every-command visibility. Codex parity closed: machine-wide publish guard in `~/.codex/config.toml` + `~/.codex/hooks/` (covers alfred/car-dealer/new repos; solo-master keeps its project guard too); `.agents/skills` bridges created in all three repos + user level as **real dirs with per-skill symlinks** (dir-level symlink hits openai/codex#11314 — solo-master's old link replaced); solo-master's duplicate `.codex/hooks.json` removed (TOML is the single representation; the JSON copy used `$CLAUDE_PROJECT_DIR`, which is empty under Codex). Supply chain: MCP servers pinned (playwright 0.0.78, context7 3.2.3) in both repos + template; ReportGenerator pinned 5.5.10 + `--output-version 1` on vulnerable-package JSON in alfred/car-dealer CI. Privacy: `~/.claude`, `~/.codex`, `~/.agents` now 700 (the directory is the boundary; state files Codex recreates as 644 inside are an accepted, audit-documented exception). Backup became a recovery system: captures `.git/info/exclude` + `core.hooksPath`, missing gitleaks is fatal, `restore-project.sh` (dry-run default, exclusions-before-files) added; template repo itself now has gitleaks pre-commit (tested) + secret-scan CI. car-dealer: `deploy` skill owner-invoked only (`disable-model-invocation`), broad `/*.md` exclude replaced with explicit list, ratchet documented as stateful. Codex discovery live-tested same day in fresh isolated sessions: all project + global skills appear.

> **2026-07-14 audit — fixes leveled in the same session:** the format-on-stop hook ran plain `dotnet format`, which applies analyzer *code-fixes* beyond the whitespace+style gates — observed live renaming test methods (CA1707) in car-dealer, and pending the same rename of alfred's architecture-test methods. All four copies (template, alfred, car-dealer, solo-master `.harness/`) now run `dotnet format whitespace` + `dotnet format style --severity info` only, matching verify.sh exactly (re-tested live in alfred and car-dealer: fixes whitespace, no renames, 5–8 s). Also: `harness-mode.sh auto` now preserves MCP-server approval (`enabledMcpjsonServers`) instead of clobbering it on every mode flip (template + alfred + car-dealer); solo-master's Codex-side retro skill pointed at a nonexistent `.Codex/goals/` path (fixed to `.claude/goals/`); solo-master's `.agents/` was visible to `git status` (now in `.git/info/exclude`); template now ships the `workflows-zizmor-clean` goal (fourth stack-agnostic goal) and BOOTSTRAP chmods `verify-goals.sh`.
>
> **Second pass, same day (external review adopted):** pre-commit leveled to fail-closed everywhere; git-autonomy + sandbox switches installed in car-dealer and solo-master (stamped OFF); car-dealer's AI-file hiding moved from committed `.gitignore` to `.git/info/exclude`; `no-env-tracked` goal strengthened to reject every `.env*` (committed examples are now named `env.example`, no leading dot — deny rules have no negation, so `.env.example` could never be agent-readable); zizmor goal raised to `--pedantic` and all workflows (3 repos + template) made pedantic-clean (concurrency, job names, permission comments); vulnerable-package CI gates parse `--format json` instead of grepping an English sentence; Codex publish guard hardened against full-path `…/git` and relabeled best-effort; solo-master `.agents/skills` is now a symlink to `.claude/skills`; alfred verify.sh gained `pnpm install --frozen-lockfile` for true CI parity; project harness state now backed up into this repo via `./backup-projects.sh` → `projects/<name>/`. Answers one question per component: *if a project lacks it, is that a gap to level, or a justified difference?* The rule: **guardrails and verification level up everywhere; context (skills, docs) follows each project's real workflows; heavyweight verification is earned by the code it verifies.**

Legend: ✅ present · ➖ justified absence (reason given) · 📋 proposed, needs Manuel's approval.

## Context layer

| Component | alfred | car-dealer | solo-master | Verdict |
|---|---|---|---|---|
| AGENTS.md (verified commands) + thin CLAUDE.md | ✅ | ✅ | ✅ | level everywhere — done |
| `security-checklist` skill | ✅ | ✅ | ✅ (as docs/05 + skill) | done |
| `retro` skill | ✅ | ✅ | ✅ (added 2026-07-12) | leveled — it's generic |
| `migrate` skill | ✅ (added 2026-07-12, commands verified live) | ✅ | ➖ no DB yet — add with EF Core |
| `db` skill | ✅ (added 2026-07-12, queries verified live) | ✅ | ➖ same |
| `deploy` skill | ➖ no deployment exists yet | ✅ | ➖ same | write from the real deploy when it exists |
| `new-feature` skill | ➖ AGENTS.md's module pattern + Identity reference covers it | ✅ | ➖ no domain yet | justified — don't restate |
| Global role skills (web-designer, backend-engineer, fullstack-engineer, devops, architecture-designer) | ✅ shared via `~/.claude/skills/` | ✅ | ✅ | machine-level, all projects |

## Guardrails layer — **always level; a rule enforced in one repo and not another is not a rule**

| Component | alfred | car-dealer | solo-master | Verdict |
|---|---|---|---|---|
| Deny: secrets reads (`.env`, `.env.*`) | ✅ | ✅ (+dpkeys) | ✅ | leveled 2026-07-12 (+ global `~/.claude` covers keys/ssh/aws) |
| Deny: `git commit` / `git push` (Claude) | ✅ | ✅ | ✅ | leveled 2026-07-12, **also now global** |
| Codex PreToolUse publish guard | ✅ via global `~/.codex/config.toml` (2026-07-15) | ✅ same | ✅ global + project (tested) | leveled machine-wide — Codex now operates across all repos, so the old "no Codex here" assumption expired |
| Codex skill discovery (`.agents/skills`, per-skill links) | ✅ (2026-07-15) | ✅ | ✅ (dir-symlink replaced) | leveled + user-level `~/.agents/skills`; **discovery verified in fresh isolated Codex sessions same day** (all project skills + 5 global skills appeared) |
| MCP versions pinned (no `@latest`) | ✅ 2026-07-15 | ✅ | ➖ no .mcp.json | supply-chain parity with locked NuGet/pnpm |
| MANUAL mode honest (`allow` only in mode-managed file + `ask: ["Bash"]`) | ✅ 2026-07-15 | ✅ | ✅ | audit-harness.sh enforces |
| gitleaks pre-commit + self-test goal | ✅ | ✅ | ✅ | done; leveled to fail-closed (missing gitleaks blocks the commit) everywhere 2026-07-14 |
| Format-on-stop hook | ✅ | ✅ | ✅ (.harness, shared Codex/Claude) | done |
| AUTO/MANUAL harness-mode switch | ✅ | ✅ | ✅ (added 2026-07-12, tested) | leveled |
| Git-autonomy switch + `git` skill (dormant, default OFF — tiers §2.8) | ✅ (added 2026-07-13, tested) | ✅ (added 2026-07-14, stamped OFF) | ✅ same | leveled everywhere; only Manuel flips the level |
| OS-sandbox switch (dormant, default OFF — tiers Tier 1 hardening) | ✅ (added 2026-07-13, tested) | ✅ (added 2026-07-14) | ✅ same | leveled everywhere; prerequisite for any Tier 2 activation |
| Global: `disableBypassPermissionsMode` | ✅ machine-wide (added 2026-07-12) | — | — | user-level, covers all |

## Verification layer

| Component | alfred | car-dealer | solo-master | Verdict |
|---|---|---|---|---|
| `scripts/verify.sh` incl. locked restore | ✅ (restore added 2026-07-12) | ✅ (ratchet variant) | ✅ | done |
| TreatWarningsAsErrors | ✅ | ➖ ~200 legacy warnings → **ratchet** instead; promote to TWE when baseline ≈ 0 (roadmapped) | ✅ | justified difference |
| Warning ratchet | ➖ TWE is stronger | ✅ | ➖ TWE | justified |
| SonarAnalyzer.CSharp | ✅ | ✅ | ✅ (added 2026-07-12; caught 5 real findings) | leveled |
| Architecture tests | ✅ (16 tests) | ✅ (5 tests) | ➖ single project, no boundaries yet — add with the first extracted layer | justified |
| Standing goals + verify-goals.sh | ✅ 5 goals | ✅ 5 goals | ✅ 4 goals (no architecture goal — see above) | leveled |
| CI: format gate, build, tests | ✅ | ✅ | ✅ | done |
| CI: vulnerable-package gate | ✅ (added 2026-07-12) | ✅ | ✅ (added 2026-07-12) | leveled |
| CI: gitleaks history scan | ✅ | ✅ | ✅ | done |
| CodeQL + Dependabot | ✅ | ✅ | ✅ | done |
| zizmor-clean workflows (+goal) | ✅ | ✅ | ✅ | leveled |
| SDK pinned to global.json in CI | ✅ | ➖ deliberate `latestFeature` + `10.0.x` (consistent pair) | ✅ (fixed 2026-07-12) | done |
| Coverage collection + report | ✅ (approved & wired 2026-07-12: CI collect + ReportGenerator + summary + PR comment) | ✅ (full report + PR comment) | ➖ 1 smoke test — pointless | leveled |
| Stryker.NET (mutation, on-demand) | ✅ (approved & installed 2026-07-12, 4.16.0, run verified; `dotnet stryker` in AGENTS.md) | ✅ | ➖ no meaningful suite | leveled |
| Playwright + Context7 MCP | ✅ | ✅ | ➖ no real UI flow yet — add with the first Learn flow | justified |
| pnpm supply-chain rules (blocked scripts, `minimumReleaseAge`) | ✅ | ➖ no frontend package tree | ➖ same | justified |

## Proposals — all three approved and applied 2026-07-12

1. **alfred coverage** ✅ — CI collects XPlat coverage, merges with ReportGenerator, posts job summary + sticky PR comment (job-scoped `pull-requests: write`). Test packages bumped to current (coverlet 10.0.1, Test.Sdk 18.7.0, runner 3.1.5, Sonar 10.29). Verify + zizmor green.
2. **alfred Stryker.NET** ✅ — local tool 4.16.0 (`dotnet-tools.json`), run verified against the solution, documented in AGENTS.md as on-demand only.
3. **solo-master xunit.v3** ✅ — migrated to xunit.v3 3.2.2; its analyzers immediately enforced `TestContext.Current.CancellationToken` in the HTTP test (fixed in code). Gate green.

Remaining future item: **alfred xunit v2 → v3** — same migration as solo-master, propose when convenient (its suite is bigger; do it as its own change).

## The leveling principle (for future audits)

- **Guardrails**: identical everywhere, always. These protect against the same failure modes regardless of project type. Any new deny rule/hook/guard added to one repo gets added to the other two + the template in the same session.
- **Verification**: the *gates* (verify.sh, vuln check, secret scan, zizmor, analyzers) level everywhere; the *heavyweights* (architecture tests, coverage, mutation, E2E) are earned by the code they verify — a gate with nothing to gate is noise.
- **Context**: skills follow real workflows per project. Copying car-dealer's `deploy` skill into a project that doesn't deploy would poison sessions with false facts — the worst harness failure mode.
- Priority when time is scarce: **alfred first** (most important), then whichever project the current work touches.
