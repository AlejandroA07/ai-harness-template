# macOS skill-link paths — feature/macos-skill-link-paths

- **Date:** 2026-08-17
- **Type:** fix

## Why

Skill reconciliation treated a stale managed link as user-owned on macOS when the temporary directory was spelled through `/var` but the running script resolved its repository through `/private/var`. The mismatch caused verification to fail and would archive a harness-owned link unnecessarily.

## What changed

- `scripts/skill-lib.mjs` now exposes an alias-aware path-containment check that also supports missing descendants.
- `scripts/sync-skills.mjs` uses the canonical containment result when deciding whether to replace or archive a stale link.
- `tests/skill-sync.test.mjs` covers aliased roots, missing descendants, outside paths, and the original stale-link reconciliation flow.

## Decisions

Containment resolves the deepest existing ancestor instead of calling `realpath` only on the complete target. Stale and broken links therefore remain classifiable without weakening the boundary around the generated skill tree.

## Verification

- `node --test tests/skill-sync.test.mjs` — 7 passed.
- `node scripts/verify.mjs` — 61 passed, 2 platform-specific tests skipped; whitespace, full-history secret scanning, workflow security, and syntax checks passed.
- `node scripts/audit.mjs` after machine reconciliation — 0 failures and 2 expected interactive-platform warnings.
- A follow-up dry run reported 22 skills per platform and 0 skill changes.

## Follow-ups

Codex hook trust remains an intentional interactive confirmation through `/hooks`. The Claude setting disables auto-memory; macOS does not provide an auditable environment-level lock through the setup script.
