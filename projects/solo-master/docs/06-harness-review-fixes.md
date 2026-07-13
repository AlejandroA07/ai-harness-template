# Harness review fixes — 2026-07-12

A second review (Claude, from the alfred session) verified the earlier audit's findings against the live repo and applied fixes. Everything below is done and verified: `scripts/verify.sh` ALL GREEN, zizmor zero findings, all 4 standing goals hold, fake-secret pre-commit test blocks (exit 1), publish-guard deny/allow matrix tested.

## Fixes applied

| Finding | Fix |
|---|---|
| P1 — CI SDK band mismatch (`10.0.x` vs `latestPatch` 10.0.201) | `ci.yml` + `codeql.yml` now use `global-json-file: global.json` (alfred's pattern) |
| P1 — no local-only policy applied | `.git/info/exclude` now hides `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.codex/`, `.harness/`, `.githooks/`, `docs/`; `git status` shows only neutral files. This was never an open decision — the owner's global rule ("repos carry no AI signature") already answered it. |
| P1 — no mechanical commit/push guard for Codex | `.harness/hooks/guard-git-publish.sh` (PreToolUse, deny JSON) wired in `.codex/config.toml`; tested with 5 deny / 6 allow cases including `git -C <path> push` |
| P2 — stale/deprecated packages | Mvc.Testing → 10.0.9, Test.Sdk → 18.7.0, xunit.runner.visualstudio → 3.1.5 (all verified latest stable on NuGet); coverlet.collector **removed** (installed but nothing collected coverage — wire it or drop it; dropped for the lean baseline). xunit stays 2.9.3: moving to xunit.v3 is a real migration, propose separately. |
| P2 — no vulnerable-package gate | New `vulnerable-packages` CI job: locked restore + `dotnet list package --vulnerable --include-transitive`, fails on findings |
| P2 — missing Sonar layer | `SonarAnalyzer.CSharp` 10.29.0.143774 as `GlobalPackageReference`. It immediately found 5 real issues in the scaffold, all fixed in code (not suppressed): `await app.RunAsync()`; protected ctor on the partial `Program` marker; removed `[IgnoreAntiforgeryToken]` from ErrorModel (secure default); removed empty `OnGet()` methods. |
| P2 — one-time checks not durable | `.claude/goals/` + `verify-goals.sh` added (hooks-path-active, no-env-tracked, gitleaks-detects-secrets, workflows-zizmor-clean) |
| P3 — `.env.example` unintentionally ignored | `!.env.example` added to `.gitignore` |
| (new) — AI signature in committable README | README no longer mentions the Codex/Claude harness and no longer links to the local-only `docs/` files |

## Follow-up (approved later on 2026-07-12)

- **xunit v3 migration applied**: `xunit` 2.9.3 → `xunit.v3` 3.2.2 (runner 3.1.5 unchanged, supports v3). Its analyzers immediately required `TestContext.Current.CancellationToken` in the HTTP smoke test — fixed in code. `scripts/verify.sh` ALL GREEN after migration.
- Also added same day: `retro` skill and `.claude/harness-mode.sh` (AUTO/MANUAL dial, tested) for parity — see `~/dev/ai-harness-template/HARNESS-PARITY.md`.

## Still open (owner decisions)

- **First commit**: `git status` shows only neutral files (src, tests, scripts, .github, props, slnx, global.json, .gitignore, .editorconfig, README). Manuel commits himself.
- Lessons from the original bootstrap are generalized in the template: `~/dev/ai-harness-template/BOOTSTRAP.md` → "Lessons" section.
