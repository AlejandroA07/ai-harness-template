# M5: project Skills and workflow composition

M5 is delivered in two sub-slices. M5a adds canonical project-scoped Skills to
the selective lifecycle. M5b will add workflow selection at machine and project
scope, conditional invocation requirements and installed-state routing. This
record describes the implemented M5a boundary and keeps M5b limits explicit.

## M5a use

Replace `<project>` with an absolute project directory outside this harness
checkout. Use `claude` instead of `codex` for Claude discovery.

```text
node scripts/setup.mjs plan --select research --platform codex --scope project --target <project>
node scripts/setup.mjs apply --select research --platform codex --scope project --target <project> --apply
node scripts/setup.mjs audit --platform codex --scope project --target <project>
node scripts/setup.mjs remove --select research --platform codex --scope project --target <project> --apply
```

Apply also updates a selected skill from its current canonical source. Planning,
apply and removal have the same read-only/default and explicit `--apply` behavior
as machine Skills. Audit inspects the whole receipt for one platform and scope,
so it does not accept `--select`.

Project payloads are rendered into the content-addressed store at
`.harness/installations/<platform>/payloads/`. Discovery entries under
`.agents/skills/` or `.claude/skills/` link to that project-owned store, never to
the harness checkout. The receipt and independently checked evidence live beside
the payloads. The receipt records scope `project`, explicit selections, dependency
consumers and payload hashes. Historical audit/removal uses this installed record
without loading the current catalog.

The existing target lock is shared with M4. M4 project configuration and M5a
therefore cannot publish concurrently. Their receipts and payload stores remain
separate: M4 owns `.harness/project-installation.json`, project runtime/settings
and adapters rendered from `.harness/skills/`; M5a owns only its selected
canonical payloads, receipt, evidence and discovery links.

Unrelated discovery entries and project-local adapter directories are preserved.
If M4 or a user already provides the same discovery ID, M5a reports an unowned
collision and makes no changes. It does not borrow, replace or claim that entry.
M4 likewise ignores M5a sibling entries that it does not own. Removing either
lifecycle leaves the other's installed content usable. Empty discovery directories
may remain after M4 removes its files.

Project scope does not write machine settings, machine receipts, machine skills,
hooks, Git configuration, processes or network state. Provisioning a discovery
entry is distinct from live platform activation.

## Verification and security boundary

Registered tests cover both platforms through the shared lifecycle plus the new
project cases: apply/update/audit/remove, CLI previews, independence from machine
state, M4 reapply/removal, preservation of a project-local adapter, and same-ID
collision refusal. Existing lifecycle tests retain coverage for unsafe links and
paths, forged/malformed receipts, changed targets, interrupted publication,
rollback, shared consumers and historical catalog drift.

The applicable security checklist passes for access/identity (local filesystem
authority is explicit), inputs/outputs, path navigation, files/delivery and denied
path regression evidence. Browser/network and upload/abuse sections are not
applicable. No dependency, secret access or external command was added.

Local verification on 2026-09-14: the focused selection lifecycle passed 21/21
tests. `node scripts/verify.mjs` passed with 160 tests, 158 passed and two
Windows-only tests skipped, followed by whitespace, Gitleaks, Zizmor and syntax
checks.

## M5b remains pending

The lifecycle still accepts Skills only. Selecting a catalog workflow at a live
target fails before writes. M5b must deliberately widen that boundary so workflow
dependencies are installed once, direct workflow consumers remain recorded, and
optional `uses` and `routes` never become installation dependencies.

M5b must also report whether routed capabilities are installed in the selected
receipt, merely available from the catalog, or unavailable for the selected
platform/scope. It must preserve one discovery entry per ID, the existing
invocation names and user-only metadata. Invocation prerequisites that refer to
project domain/tracker/verification contracts must use the documented fallback or
explain the missing prerequisite; installing a workflow must not silently install
the complete Project configuration module.
