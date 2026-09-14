# Receipt assessment and reviewed recovery

Current selective receipt formats are version 2 for M2 machine Skills and M3 global
configuration, and version 3 for M4 project configuration. M2/M3 retain scoped historical metadata
under the platform store's `evidence/<hash>.json`; M4 retains project payload
snapshots. Commit project evidence with its receipt. Machine evidence stays in the
target installation store. Evidence is retained on updates, removal and rollback.

A separate current-revision record binds the active receipt: `skills-current.json`
or `global-current.json` in the platform store, and `.harness/project-current.json`
for projects. It is published and rolled back with the receipt. Retained historical
evidence cannot authorize replay of an earlier receipt. Missing receipts with a
remaining current-revision record require recovery rather than fresh adoption.

Together these records detect receipt-only changes, missing evidence and inconsistent
history. They are not signatures against someone able to rewrite all artifacts.
Do not reconstruct evidence merely by hashing an untrusted old receipt.

## Read-only assessment

Run from the current checkout with an explicit target and platform:

```text
node scripts/assess-receipt-migration.mjs --target <absolute-home> --module skills --platform codex
node scripts/assess-receipt-migration.mjs --target <absolute-home> --module global-configuration --platform claude
node scripts/assess-receipt-migration.mjs --target <absolute-project> --module project-configuration --platform codex
```

The command does not modify the target, acquire a lock, run hooks or print settings
and prior values. `current` means the installed-state audit passes; it does not
prove live hook activation. `absent`, `review-required` and `conflict` exit nonzero.
Machine version 1 and project versions 1–2 always require review. Unsupported, malformed or incomplete evidence
cannot authorize recovery writes. There is deliberately no `--apply`/force mode.

## Recover an older installation without inventing ownership

1. Stop installation activity. If a lock/journal exists, first reconcile the
   interrupted operation using the matching lifecycle recovery documentation.
   Preserve competing edits. Never remove the lock merely to make setup proceed.
2. Make a private backup of the affected platform/project state, including the
   old receipt, current-revision record if present, live configuration, guidance,
   discovery entries and stored payloads.
   Preserve bytes, permissions and link targets. Backups may contain sensitive
   configuration: keep them local with owner-only permissions, outside discovery,
   and never upload them or commit machine settings. Verify the backup before
   changing live files.
3. Establish intended retained state from trusted pre-install backups, reviewed
   version-control history or an explicit owner decision. Treat the old receipt as
   a list of claims, not authorization. Compare every proposed change with live
   state and the trusted evidence. A current source template proves neither an
   old selection graph nor a prior setting value. If a value cannot be established,
   preserve it and ask the owner to choose the intended value; do not guess.
4. Produce and review a concrete reconciliation list. For M2, retire only verified
   discovery links for the reviewed selections, retaining all stored payloads and
   other consumers. For M3, retire only verified generated guidance and exact hook/
   deny additions; restore explicitly established prior values and preserve later
   unrelated settings. For M4, include shared consumers and all owned runtime/
   adapter files, while preserving local skill sources and borrowed documents.
   Move reviewed artifacts to the private backup rather than recursively deleting
   paths from the receipt. Keep the old receipt and any corresponding current-revision record archived
   together with that evidence.
5. After executing the reviewed reconciliation, run the current installer's normal
   read-only plan. Unowned leftovers remain conflicts: review each rather than
   adding hashes to a receipt or using the old unsafe remover. Apply only a plan
   with no unresolved conflicts. It creates current evidence from the actual
   retained state. Reassess and audit, run project verification where applicable,
   and separately review platform hook trust/activation.
6. Keep the backup until the new state has been verified. Repeating assessment and
   unchanged apply should be a no-op. On interruption, retain the lock, journal and
   backup and reconcile their actual state before resuming. There is no automatic
   journal replay or backup/payload cleanup.

The automated tests exercise assessment and a recovery rehearsal with a known
pre-install fixture baseline. They also check ambiguous/tampered/unsupported
states remain unchanged. They do not make unknown real-world prior values
recoverable. Full managed-profile migration remains M8.
