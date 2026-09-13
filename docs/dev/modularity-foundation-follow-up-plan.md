# Foundation repairs before M5

- **Status:** proposed implementation work; review complete, fixes not started.
- **Baseline:** `7599479622a4d7235f2dcc0a3b44df2c8000ad1b`.
- **Evidence:** [M0–M3 review](modularity-foundation-review.md).
- **Scope:** repair the delivered lifecycle contracts; preserve five public
  modules, canonical skill sources and the M0–M8 direction.

## R1 — Historical ownership evidence and receipt evolution

Address F1/F2 together at the contract level, then implement module-specific
changes in small reviewable commits. Bind M2's selected IDs and consumer graph,
and M3's prior scalar/feature values, owned denials/hooks and container flags,
to independently verified installed-state evidence. Revalidate it during audit,
apply, remove and publication, not only at initial parsing. Reuse appropriate
M4 mechanisms without assuming its project paths or settings model fit machines.

Specify protection against receipt-only edits and missing/altered evidence;
do not describe content hashes as signatures. Preserve immutable payloads and
unrelated content. Never resolve historical consumer ownership from today's
dependency declarations alone.

Before publishing another receipt version, provide a read-only migration
assessment and a documented, tested procedure for supported old schemas,
including M4 v1. List evidence and conflicts; preserve originals privately and
require explicit resolution of uncertain ownership/prior values. Do not make
running the old unsafe remover or changing a version number the default path.
If trustworthy history is unavailable, preserve the content and explain the
manual reconciliation rather than inventing prior state.

Acceptance:

- Well-formed edits to every ownership field fail audit/apply/remove without
  modifying the target; missing/edited evidence behaves the same way.
- Two selections sharing a dependency retain it until the verified final
  consumer is removed, even after the current graph changes.
- Removal restores the actual recorded pre-install values and retains borrowed
  hooks/denials, including during upgrade and rollback.
- Old-receipt fixtures cover clean, user-edited, tampered, missing-evidence and
  interrupted migration states. Successful migrations are idempotent and preserve
  unrelated bytes; ambiguous states remain reviewable and unchanged.

## R2 — Removal and audit use installed history

Address F3 after the evidence contract is established. Separate current source
resolution for apply from historical receipt/payload validation for audit/remove.
Retain strict path validation and supported receipt-version checks. Remove the
CLI's unconditional whole-catalog dependency where an installed-state operation
does not need current source content. Apply the rule consistently to M2/M3/M4.

Acceptance: install from revision A, then audit/remove using revision B after a
skill is retired, reclassified, given different supported scopes, or an unrelated
source becomes an invalid draft. Owned history must suffice for safe supported
removal. Bad stored paths/evidence still fail closed; an unsupported historical
schema produces migration guidance. Remaining selections retain installed bytes.

## R3 — Truthful activation state

Address F4. Detect known locally readable blockers such as `disableAllHooks` and
report them explicitly. Preserve the user's setting and require reconciliation
before declaring the configured guard ready. Choose and document whether apply
refuses or installs with an explicit blocked activation result; do not emit an
unqualified success message. Keep receipt integrity, local configuration readiness
and live platform trust/execution as separate results.

Acceptance: disabled-hook fixtures for selected global/project configuration,
unchanged unrelated settings, accurate plan/audit output, and denied-path guard
tests. Live activation remains unverified until exercised through the platform.

## R4 — Close the scope gap before specifying M5

Make the capability/platform/scope support matrix explicit. Assign canonical
project-scoped Skills installation to an M5 prerequisite or a named M5 sub-slice;
do not confuse it with rendering project-local skills. Specify collisions and
shared ownership with M4, dependency consumers across workflows and selections,
and how the router distinguishes installable, installed and unavailable entries.

Acceptance: the M5 implementation ticket covers both advertised scopes or
explicitly records which remain deferred and where. Unsupported operations are
reported honestly in catalog/CLI output. Existing invocation IDs and user-only
metadata remain unchanged; optional routes do not become required installations.

## R5 — Evidence and release gates

Add the reproduced cases to the registered test suites while fixing each issue.
Add Windows execution of portable filesystem/process/lifecycle tests, including
junctions, locks, rollback and literal hook paths. Keep POSIX-only FIFO cases
platform-specific. Pin supported runtime versions and record actual runner results.

Before M5 implementation, R1–R4 must pass their acceptance cases and
`node scripts/verify.mjs`; obtain the exact revision's Verify/CodeQL results before
merging. Before real installation, require Windows evidence for Windows support
and platform activation rehearsal for the selected environment. Do not treat the
two skipped Windows tests or synthetic command execution as that evidence.

## Work retained for later

Keep full managed-profile migration and its legacy generator limitations visible
for M8; M0 did not solve its complete concurrent/transactional lifecycle. Keep
broader integration acquisition in M6 and the architecture view in M7. Payload
cleanup/retention tooling can follow once recovery is stable; do not add automatic
garbage collection during these ownership repairs. No folder reorganization or
general installer framework is needed to address the confirmed defects.
