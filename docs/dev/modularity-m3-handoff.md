# M3 resume record

The work paused on 2026-09-12 was resumed and completed on
`feature/selective-global-configuration`, from M2 merge commit
`fe93b257bf5e53b2285f4f4bcde6deb56910e47d`. The original draft handoff is superseded
by the [M3 contract and evidence](modularity-m3-global-configuration.md).

The implementation now connects the global module to plan/apply/audit/remove,
extracts shared lifecycle helpers from M2, tracks per-setting ownership, stores
an independent guard runtime and preserves ambiguous recovery state. The actual
repository gate passed: 123 tests, 121 passed and two Windows-only skips, plus
the whitespace, Gitleaks, Zizmor and syntax checks. No real-home installation or
feature-branch push was performed.

The gathered findings, resolved draft questions and remaining limitations live
in the M3 guide: exact hook matching, legacy conflicts, TOML support, private
backups, interrupted-operation recovery, Node relocation, source maintenance
pointers, interactive Codex trust and the portable filesystem authority boundary.
No CodeQL exclusion or suppression was added. GitHub's CodeQL result must still
be checked before merging, and live Windows/platform-session validation remains
separate from the macOS fixture evidence.

Continue with M4 project-only setup or M5 workflow lifecycle according to the
[modularity plan](harness-modularity-plan.md) and
[living roadmap](graph-and-quality-adoption-roadmap.md). Full-profile migration
rehearsal remains M8. Inspect branch/status before beginning the next slice;
preserve existing work, use isolated targets, run `node scripts/verify.mjs` before
claiming completion and never push a feature branch.
