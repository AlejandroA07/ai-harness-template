# M0–M3 foundation review, 2026-09-13

**Historical findings:** these findings motivated the [implemented repair record](modularity-foundation-follow-up-plan.md#implementation-record). The reproductions below describe the review baseline.

**Decision at review:** retain the five-module architecture and M0–M8 sequence, but repair
M2/M3 before starting M5. Passing the current gate does not cover the semantic
ownership cases reproduced below. This review changes documentation only.

Reviewed milestone diff: `git diff c6a7589425ef13bcd902f475c098413cad615ccd...43e85cb`.
The baseline precedes M0; the endpoint includes M3's regex correction. Findings
were checked against current merged HEAD `7599479622a4d7235f2dcc0a3b44df2c8000ad1b`,
including M4's later corrections. The specifications are the modularity plan,
original ownership review, and M0–M3 milestone contracts. M5–M8 deliverables are
not counted as missing M0–M3 implementation.

## What the M4 compatibility note means

A receipt is the installer's saved record of what it installed and which previous
settings it should restore. M4 initially wrote version 1. Its ownership correction
introduced version 2 plus a stored payload containing installed bytes and scoped
ownership metadata. The new installer rejects old receipts instead of guessing
ownership. This is an M4 project-installation format change; it does not upgrade
M2's skill receipt or M3's global receipt.

A project installed using the initial M4 implementation cannot automatically
update, audit or remove through the new installer. Projects first installed with
the corrected M4 implementation already have version 2. Merely merging the PR
does not migrate an existing installation. The development evidence used temporary
targets; this review did not inspect real user installations or establish whether
any need migration.

The instruction to perform a "reviewed migration" is incomplete operational
guidance. There is no migration command or tested end-to-end v1-to-v2 procedure.
In particular, falling back to the old remover is not inherently safe: its receipt
trust problem motivated version 2. Do not manually change a version field or
manufacture ownership. A safe migration must preserve ambiguous files, recover
historical ownership from reviewable evidence, and explicitly resolve prior
settings that cannot be established. This gap should be addressed before another
receipt format is introduced.

## Milestone assessment

| Milestone | Assessment | Evidence and limits |
|---|---|---|
| M0 | Meets its bounded safety scope | Manifest schema/path checks, exact hook matching, preflight preservation and legacy output fixtures are present. Its documentation explicitly leaves authenticated historical ownership and transactional recovery incomplete in the legacy generator. Do not describe it as a fully hardened selective lifecycle. |
| M1 | Meets its catalog/planning scope | All 22 capabilities are classified; required dependencies are separate from routes and conditional uses; planning is read-only. No additional confirmed M1 defect in this review. |
| M2 | Implemented; corrections required | Payload/link checks and recovery exist, but consumer metadata can be altered independently and current catalog support can block historical removal. |
| M3 | Implemented; corrections required | Platform separation, scoped merges and recovery exist, but prior ownership metadata is not independently verified and known disabled-hook state is reported inaccurately. |
| Plan | Direction sound; acceptance gaps | Needs semantic ownership tests, receipt evolution, historical removal rules, explicit project-skill scope ownership and a visible portability release gate. |

## Standards

**F1 — P1: M3 trusts altered prior settings.**
[`global-installation.mjs:65`](../../scripts/global-installation.mjs#L65) checks
the shape/type of saved scalar values; line 182 restores them directly. The
runtime hash binds generated guidance and policy, not the prior values or
ownership flags. A temporary Claude installation started with
`autoMemoryEnabled: true`. Changing only its receipt's saved value to `false`
passed audit; removal restored `false`. Changing the prior bypass-mode value to
`enable` likewise succeeded. This violates the plan's forged-receipt preservation
rule and M3's promise to restore actual prior values. Audit/apply/remove must
validate historical ownership evidence, including scalars, added denials,
borrowed hooks and container flags. The reproduced attack changes the receipt
only; it is not a claim of protection against an actor controlling all files.

**Maintainability observation — ownership checks differ across modules.**
M2 binds payload bytes and links, M3 binds runtime/guidance, and M4 additionally
binds scoped ownership metadata. This divergence allowed the M4 correction to
leave the analogous M3 flaw intact. Establish common ownership invariants and
shared behavioral cases first; extract implementation helpers only where the
same behavior is actually required. A broad installer rewrite is not justified.

No additional independently reproduced M0/M1 correctness finding resulted from
this axis. M0's documented legacy limitations remain explicit follow-up work.

## Spec

**F1 — M3 restoration violates the ownership contract.** The Standards finding
also violates the installation contract at
[`harness-modularity-plan.md`](harness-modularity-plan.md#installation-lifecycle-and-receipts):
"never claim ownership ... from ... a forged receipt" and recorded prior state.
This is one defect reported on both axes, not two independent defects.

**F2 — P2: M2 accepts an incomplete historical consumer graph.**
[`selection-installation.mjs:59`](../../scripts/selection-installation.mjs#L59)
checks that consumers are selected IDs, but cannot establish that every original
consumer is retained. In a fixture, both `research` and `grilling` required
`security-checklist`. After installation, editing only the dependency's receipt
consumers from both IDs to `['research']` passed audit. Removing `research` then
removed the dependency's discovery link while `grilling` remained selected.
The payload itself was retained, but the remaining selection lost discovery of
its required dependency. This violates "Retain until the last consumer is
removed" and M2's remaining-selection acceptance check. Verify the historical
selection graph as well as payload hashes; do not substitute today's graph.

**F3 — P2: catalog changes can prevent removal of valid installations.**
[`selection-installation.mjs:122`](../../scripts/selection-installation.mjs#L122)
loads and resolves current installability even for removal. After installing a
skill, changing its catalog scopes to project-only caused machine removal to fail
with `Unsupported platform/scope selection`. Receipt loading also restricts IDs
to today's Skills inventory. M2 promises historical consumer-based removal.
Audit/removal should validate stored IDs, paths and historical ownership without
requiring that those IDs remain installable today. Applying new versions still
requires current source/catalog validation. This finding does not imply that
management can run without the installer program itself.

**F4 — P2: M3 reports guard activation despite an explicit local blocker.**
[`global-installation.mjs:230`](../../scripts/global-installation.mjs#L230)
reports that configuration enables the guard. A fixture containing
`disableAllHooks: true` remained disabled after successful apply; audit also
reported `applicable: true`. The local option was preserved, but not disclosed as
a blocker. The plan requires activation changes to be visible and distinguishes
configuration from execution. Report known blockers without silently changing
user preferences; do not imply live hook activation. M4 already recognizes this
local setting, so the handling is inconsistent across modules.

No justified scope-creep finding. M5–M8 remain deferred appropriately, subject to
the prerequisite repairs and scope clarification below.

## Gaps in the plan itself

1. **Receipt evolution lacks a concrete acceptance contract.** Versioned schemas
   were required, but transitions, fallback behavior and evidence needed for
   adoption were not assigned a tested procedure. M4 demonstrates the consequence.
   Whole-profile migration can remain M8; format changes in already delivered
   selective installers need their own migration acceptance now.
2. **Tampering tests emphasize syntax and paths over meaning.** Add well-formed
   but altered consumer graphs, prior settings and ownership flags. State the
   boundary precisely: independent local evidence detects receipt-only changes;
   hashes do not authenticate all artifacts against a same-authority writer.
3. **Historical lifecycle needs an explicit source-evolution rule.** Test retired
   IDs, changed classification/scope/dependencies and unrelated draft source
   failures. Stored ownership should govern removal; present source governs new
   installation. Bound version compatibility rather than promising indefinite
   support implicitly.
4. **Project-scoped canonical skill selection is unassigned.** The contract allows
   skills/workflows at machine and project scope, and the catalog advertises both.
   M2 implements machine Skills; M4 renders local project sources but does not
   install selected canonical catalog skills. M5's deliverable does not explicitly
   close that gap. Assign it a named slice and cover ownership when project-local
   adapters, selected skills and workflows coexist.
5. **Evidence must distinguish local, CI and live activation.** Windows execution
   is already required by the plan but remains outstanding. No Windows job exists
   in the repository Verify workflow. Add a portable installation test job and
   retain platform trust/activation rehearsal as a separate pre-live-install gate.
   CodeQL must be checked on the exact candidate revision; it does not replace
   behavioral ownership tests.

## Verification and limits

`node scripts/verify.mjs` exited 0 on the reviewed code: 146 tests, 144 passed,
two Windows-only skips; whitespace, Gitleaks, Zizmor and syntax checks passed.
Independent temporary-target probes reproduced F1–F4 without changing production
code, platform profiles or live skill discovery. The consumer and scope-change
probes used a copied catalog and source tree. F1 was also independently reproduced
on both review axes. Passing existing tests therefore does not resolve these gaps.

GitHub CI/CodeQL status was not verified: the network lookup failed and automatic
approval review rejected the network retry because the account usage limit had
been reached. No conclusion about current remote check success is made.

See the [repair and acceptance plan](modularity-foundation-follow-up-plan.md).
Standards: one confirmed hard finding plus one maintainability observation;
worst P1. Spec: four confirmed findings, including the overlapping F1; worst P1.
