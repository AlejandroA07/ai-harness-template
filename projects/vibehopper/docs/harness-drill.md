# Harness Drill

Last updated: 2026-07-17

## Local-Only Installation

The harness was installed from `~/dev/ai-harness-template/`. These paths are excluded only through `.git/info/exclude` and must never be committed:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/`
- `.mcp.json`
- `.githooks/`
- `.harness/`
- `.codex/`
- `docs/`

The redundant committed `docs/` rule was removed from `.gitignore` after `.git/info/exclude` coverage was confirmed.

## Committed Project Guardrails

- Root gate: `./scripts/verify.sh`.
- Backend gate: `vibehopper_be/scripts/verify.sh`.
- Gradle wrapper is executable and Java 17 is selected on macOS when available.
- Spotless formats and checks Java sources.
- Gradle dependency locking is enabled.
- Tests fail verification if any JUnit XML report contains a skipped test.
- Testcontainers `1.21.4` starts one JVM-wide PostGIS container; Docker absence is a hard failure.
- CI, CodeQL, Gitleaks, and Dependabot are normal committed project automation with actions pinned to SHAs.

## Drill Results

- The pre-commit Gitleaks hook blocked test JWT strings that resembled real secrets. Test configuration was changed to a deterministic placeholder rather than weakening the scanner.
- Gitleaks PR scans initially failed with a 403; adding `pull-requests: read` fixed access to PR commit metadata.
- CodeQL initially used a Node 20 action; it was upgraded to pinned v4 on Node 24.
- After publication, CodeQL found one high-severity blanket-CSRF-disable alert. CSRF was enabled and GitHub marked the annotation fixed.
- `./scripts/verify.sh` passes with 72 tests and zero skips.
- Current-tree Gitleaks passes; the latest all-ref scan covered 34 commits with no leaks.
- `zizmor --pedantic .github/workflows/` reports no findings.
- `git diff --check` passes.
- Normal `git status --porcelain` contains no docs or harness paths.
- The local no-secret goal permits the committed placeholder `.env.example` but rejects real `.env` variants.

## Current Limitations

- Root verification currently delegates to the backend gate; Gitleaks, zizmor, and `git diff --check` are still run independently.
- `actionlint` is not installed locally.
- GitHub CLI is not authenticated in this checkout, so GitHub Actions log inspection uses supplied logs or public GitHub pages.
- Phase 2 must add wrapper validation, dependency verification, OSV, ArchUnit, and integrate security checks into the root gate.
- Phase 6 must extend verification with frontend install, generated-client drift, lint, typecheck, unit tests, build, and Playwright.

## Definition Of Done

- `./scripts/verify.sh` exits zero.
- All backend tests run with zero skips against real PostGIS.
- Spotless, Gitleaks, zizmor, and `git diff --check` pass.
- CodeQL has no open findings for the branch.
- No local docs, harness, Codex, or Claude files appear as committable changes.
