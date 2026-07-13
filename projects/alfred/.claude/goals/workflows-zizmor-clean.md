predicate: zizmor --pedantic .github/workflows/ >/dev/null 2>&1
born: 2026-07-12
source: 2026-07-12 harness review — car-dealer had this goal, alfred didn't; workflows are SHA-pinned, persist-credentials false, least privilege
status: satisfied
last-pass: 2026-07-14
on-violation: a workflow edit regressed CI security; run `zizmor .github/workflows/` and fix findings, never suppress them (pedantic since 2026-07-14)
