predicate: zizmor --pedantic .github/workflows/ >/dev/null 2>&1
born: 2026-07-09
source: 2026-07-09 hardening — workflows reached zero zizmor findings (SHA pins, persist-credentials, least privilege)
status: satisfied
last-pass: 2026-07-14
on-violation: a workflow edit (or new zizmor audit) regressed CI security; run `zizmor .github/workflows/` and fix findings, never suppress them (pedantic since 2026-07-14)
