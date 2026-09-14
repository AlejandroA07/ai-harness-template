# M5: project Skills and workflow composition

M5 is delivered in two sub-slices. M5a adds canonical project-scoped Skills to
the selective lifecycle. M5b adds workflow selection at machine and project
scope, conditional invocation requirements and target-aware routing. Both
sub-slices use the same ownership-aware lifecycle and are implemented.

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

## M5b workflow composition

Select a workflow through the same commands. For example, preview and apply the
implementation workflow and its required skills with:

```text
node scripts/setup.mjs plan --select implement --platform codex --scope project --target <project>
node scripts/setup.mjs apply --select implement --platform codex --scope project --target <project> --apply
```

Machine scope uses the same selection with `--scope machine` and an absolute
machine target. Claude uses `--platform claude`. A workflow is a discoverable,
invocable capability, so its canonical document is installed beside the skills
it requires. Each capability ID has one discovery entry. Required dependencies
are installed once and receipts record every direct selection that consumes
them. Removing a workflow releases only its ownership share; a dependency that
is also selected directly or required by another selection remains installed.

Conditional `uses` and router `routes` are deliberately optional. They appear in
the target plan but are not installed as dependency closure. Each plan entry
reports `currentStatus` and `plannedStatus` as `installed`, `available`, or
`unavailable` for the chosen platform and scope. This lets `ask-alfred` distinguish
what can be invoked now from what can be selected or is unsupported without
claiming that every route is installed.

Project plans also report invocation prerequisites. A referenced contract under
`docs/` or `scripts/` is `configured`, `missing`, or `fallback` when the catalog
documents a fallback; prerequisites checked only when the capability is invoked
are `at-invocation`. These checks inspect filesystem metadata only. Linked,
hardlinked, special-file and escaping project contracts are rejected. Installing
a workflow does not install project configuration or manufacture a verifier,
tracker, specification, approval, stack tool, or Git state.

Platform invocation behavior remains unchanged. Claude keeps
`disable-model-invocation` metadata and Codex keeps user-only
`allow_implicit_invocation: false` metadata where declared by the canonical
capability. Planning reports workflow stages and activation details without
executing them.

## Verification and security boundary

Registered tests cover both platforms and scopes through the shared lifecycle:
workflow dependency closure, direct and shared consumers, optional uses/routes,
installed/available/unavailable routing, unchanged invocation metadata, project
prerequisite states, apply/remove and CLI previews. Project-skill cases cover
apply/update/audit/remove, independence from machine state, M4 reapply/removal,
preservation of a project-local adapter, and same-ID collision refusal. Existing
lifecycle tests retain coverage for unsafe links and paths, forged/malformed
receipts, changed targets, interrupted publication, rollback, shared consumers
and historical catalog drift.

The applicable security checklist passes for access/identity (local filesystem
authority is explicit), inputs/outputs, path navigation, files/delivery and denied
path regression evidence. Project prerequisite checks use `lstat` metadata rather
than reading project files and reject linked, hardlinked, special or escaping
contracts. Browser/network and upload/abuse sections are not applicable. No
dependency, secret access or external command was added.

Local verification on 2026-09-14: the focused selection lifecycle passed 25/25
tests. `node scripts/verify.mjs` passed with 164 tests, 162 passed and two
Windows-only tests skipped, followed by whitespace, Gitleaks, Zizmor and syntax
checks.
