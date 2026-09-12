# M2: selective machine skill lifecycle

M2 adds target preflight, apply/update, removal and installed-state audit to the shared setup interface. It supports explicit Skills selections on one machine platform per command, with coexistence as the only profile. Required skill dependencies are resolved and tracked per selection. Workflow installation remains M5; global configuration, project configuration and integrations remain M3, M4 and M6 respectively.

## Commands

Use an absolute path for the target home directory. Its installation store and discovery paths must be outside the source checkout; a home containing a checkout under `dev/` is supported. The final target directory may be absent if its parent exists. Examples use an isolated target; substitute the intended home directory only when ready to install there.

```sh
node scripts/setup.mjs plan --select research --platform codex --scope machine --target /absolute/fixture-home
node scripts/setup.mjs apply --select research --platform codex --scope machine --target /absolute/fixture-home
node scripts/setup.mjs apply --select research --platform codex --scope machine --target /absolute/fixture-home --apply
node scripts/setup.mjs audit --platform codex --scope machine --target /absolute/fixture-home
node scripts/setup.mjs remove --select research --platform codex --scope machine --target /absolute/fixture-home
node scripts/setup.mjs remove --select research --platform codex --scope machine --target /absolute/fixture-home --apply
```

`apply` and `remove` preview by default; only `--apply` permits writes. `plan --target` performs the same read-only installation preflight as an apply preview. Repeat `--select` for several skills and use `--json` for structured results. Run `apply` again to update the named selections from the current canonical source. Identical content and selections produce a true no-op, including unchanged file and directory modification times.

`audit` checks the entire receipt for the chosen platform, reports whether an installation is recorded, and exits nonzero for conflicts. It checks installed integrity, not whether a newer source revision exists; an apply preview shows available updates. Unknown options, absent target/platform/scope, project scope, `both`, modules and workflow selections are rejected by lifecycle commands. The original target-free `list` and `plan` retain their M1 behavior, including previews of workflows and both scopes/platforms.

No external tool, network request, platform CLI, settings merge, hook change, full-tree generation or real-home default is involved. Existing machine setup, bootstrap, synchronization and audit commands retain their full-profile behavior. Do not run the legacy exact-inventory profile over a selected installation unless deliberately migrating: ownership-aware full-profile migration remains M8.

## Store and receipt

For each target, the installer owns these locations:

```text
<target>/.ai-harness/installations/<platform>/
  receipt.json
  payloads/<skill-id>/<content-hash>/
<target>/.ai-harness-install.lock/
```

Discovery links live at `<target>/.agents/skills/<id>` for Codex or `<target>/.claude/skills/<id>` for Claude. They point to complete, versioned payload directories in the target's installation store. Windows uses directory junctions. Regeneration, deletion of `.generated`, or moving the source checkout does not break installed skills. Installation management still requires a valid harness checkout.

The version 1 receipt binds the canonical target, platform, machine scope and coexistence profile. It records explicitly selected IDs and entries containing stable capability IDs, SHA-256 payload revisions and the explicit selections consuming each payload. Hashes include relative filenames and file bytes. Paths are derived from validated IDs and hashes; receipts cannot supply arbitrary paths. Runtime documents use the same renderer as the legacy generator, preserving platform-specific invocation metadata. Only resources declared by the catalog are copied, with the established README/platform-metadata exclusions.

Adding another selection preserves installed revisions outside the requested dependency closures. Updating a shared dependency updates its one discovery entry for all recorded consumers. Removing a selection releases its ownership share; a required payload remains discoverable until its final consumer is removed. Removal uses the receipt's historical consumer graph, so a changed dependency declaration does not silently strand or remove another selection. Removing an ID that is not explicitly selected is a no-op.

## Ownership and preservation

Receipt files are untrusted: reject unsupported schemas, unknown IDs, unsafe hashes, target/profile mismatches, duplicate selections, invalid consumers and linked/hardlinked receipt files. A receipt alone is insufficient to overwrite or remove a discovery entry. The exact link must point to its derived store revision, and the stored file tree must match the recorded content hash. Unowned directories, legacy links, case-variant collisions, missing links and edited or unsafe payloads are conflicts. No automatic adoption is attempted.

Update/removal retire verified discovery links and write the receipt. Old payload revisions are deliberately retained. The installer never recursively deletes an installed payload based on a receipt, and it never overwrites an existing content-addressed revision. This bounds the effect of a forged receipt: it cannot authorize deleting an arbitrary directory or adopting an unrelated copy. Receipts are local ownership evidence, not signatures against an attacker who can rewrite all of the same user's files.

Store and discovery ancestors must be real directories. The explicit target cannot be a symlink/junction; OS aliases above it are canonicalized. Payload and receipt reads reject symlinks, special files and hardlinks. Case-colliding discovery names fail on case-sensitive systems too. Private staging and receipt files use restrictive permissions; only generated skill content and installation metadata are retained, with no copies of settings, credentials or sessions.

## Publication and recovery

An actionable plan captures source rendering, receipt content, relevant discovery state, owned content hashes and parent directory identities. It creates no directories or files. Apply accepts only an in-process plan and re-derives its authority from private state, ignoring caller edits to the displayed plan. It rebuilds preflight before and after acquiring the exclusive target lock, which serializes operations across both platforms. Changed preconditions stop the operation.

Complete payloads, the next receipt and a recovery journal are staged under a private `.stage-*` directory. Existing immutable revisions are verified and reused. Discovery links publish after staging and the receipt publishes last. Relevant roots, links, payloads and receipt content are checked again around publication. No atomicity is claimed across all files or against every possible same-user filesystem race.

Caught failures report completed discovery operations and restore previous links and receipt content when the current state still matches the operation's writes. Published immutable payloads and empty created parent directories may remain. If a concurrent change makes rollback ambiguous, preserve that change, the staging directory, old links and the target lock, and report that recovery is required.

Abrupt termination also leaves the lock and staging journal. Locks are never expired or removed automatically. Recovery requires confirming that no installer is running, then inspecting `.stage-*/transaction.json`, the current receipt, the discovery links and any `<id>.old` staged links. The journal records previous and intended receipts plus the planned link changes. Restore only verified operation-owned links/receipt state, or reconcile a fully published receipt, before removing the reviewed staging directory and lock and rerunning audit. Preserve any ambiguous content for review. There is no automatic journal replay or payload garbage collector in M2.

## Acceptance evidence

`tests/selection-installation.test.mjs` is registered in the actual repository runner. Its isolated fixtures cover:

- Fresh and absent targets, paths with spaces, both platform adapters, user-only metadata and resource copying.
- Install, content/resource updates, removal, audit, identical repeat apply and absent-selection removal.
- Shared dependencies, concurrent consumers, platform isolation, retained unrelated selections and independence from generated/source paths.
- Read-only CLI previews, strict selection/scope/target checks, and successful commands with an empty external-tool PATH.
- Unowned copies, legacy links, case collisions, edited/extra payload files, missing/replaced links, forged/malformed receipts, traversal and target mismatch.
- Linked roots/resources/receipts, hardlinked receipts, serialized or mutated plans, changes after planning/staging and replacement at the discovery rename boundary.
- Exclusive locking, failures at staging/discovery/receipt publication, safe rollback, ambiguous rollback and actual child-process termination with retained recovery evidence.

All test mutations use explicit temporary targets. No installed developer profile is changed. Verification on 2026-09-12: `node scripts/verify.mjs` exited 0 with 101 tests, 99 passed, zero failed and two existing Windows-only skips. The repository gate is `node scripts/verify.mjs`; it includes the existing full-profile, catalog, guard, attribution, provenance and generated project tests, whitespace checks, full-history Gitleaks, Zizmor and syntax checks. Local evidence covers macOS; Windows-specific tests remain skipped here, and portable junction/rename behavior still needs Windows execution. Existing CI supplies Linux coverage when run; local tests do not claim that CI has executed this change.

## Security-checklist verdicts

| Section | Verdict | Evidence or boundary |
|---|---|---|
| Access and identity | Pass | Explicit target/platform/scope and `--apply`; receipt target binding and exact link/content checks; no service identities |
| Inputs and outputs | Pass | Strict CLI/catalog/receipt validation, derived paths, denied fixtures; output excludes payload/settings content |
| Injection and navigation | Pass | No subprocesses in the lifecycle; constrained filesystem paths, safe file reads and linked-root rejection |
| Browser and network boundaries | Not applicable | No browser, network, server, webhook or session handling |
| Files and abuse | Pass for local installation | Private staging, exclusive lock, content verification, collision preservation and recoverable publication; no upload endpoint |
| Dependencies and delivery | Pass | No packages or CI permissions added; existing provenance and security gates retained |
| Regression evidence | Pass for the tested local boundary | Lifecycle and denied-path fixtures registered in the gate; Windows execution remains pending |

M3, M4 and M5 can build on this lifecycle boundary. They must add their own settings/project/workflow contracts rather than widening the M2 payload renderer to accept arbitrary vendor executables or receipts as write authority.
