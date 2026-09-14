# M3: selected global configuration

M3 adds a receipt-backed global configuration lifecycle for one platform at a
time, with the coexistence policy established by M2. It shares file inspection,
hashing and the target lock with selective skill installation. Global settings
use a staged regular-file publisher; skills retain their discovery-link
publisher. The existing full managed profile remains available separately.

## Commands and scope

Run from the harness checkout, substituting an absolute intended home directory
for `<target>`. Use an isolated temporary target for rehearsal.

```text
node scripts/setup.mjs plan --module global-configuration --platform codex --scope machine --target <target>
node scripts/setup.mjs apply --module global-configuration --platform codex --scope machine --target <target>
node scripts/setup.mjs apply --module global-configuration --platform codex --scope machine --target <target> --apply
node scripts/setup.mjs audit --module global-configuration --platform codex --scope machine --target <target>
node scripts/setup.mjs remove --module global-configuration --platform codex --scope machine --target <target> --apply
```

Replace `codex` with `claude` for Claude. Add `--json` for a structured report.
`plan`, `audit`, and apply/remove without `--apply` are read-only. Apply also
performs updates; an unchanged installation is a no-op. Audit reports receipt
and owned-content consistency, not whether a running platform executed a hook.
Audit with no receipt reports an absent installation, not successful activation.

An explicit local `disableAllHooks: true` blocks apply/audit readiness and is
reported without changing that preference. Owned removal remains available.
Configuration readiness does not prove live platform execution or trust.

Only `--scope machine` and one explicit platform are accepted. Selecting both
platforms requires two operations; global and skill selections cannot be mixed
in one transaction. No skills, custom agents, MCP configuration, project files,
Git configuration or machine environment variables are installed by this module.
Codex-only setup neither invokes Claude nor modifies its platform directory.

Setup itself requires Node and local filesystem access. Hook commands retain
the absolute Node executable used at installation; Git is needed by the guard
when evaluating a proposed push. Updating after a Node relocation replaces the
exact historical hook using the executable recorded with its runtime revision.
No platform CLI or external package installation occurs during setup.

## Owned state

| Platform | Files and owned settings |
|---|---|
| Codex | `.codex/AGENTS.md`; exact `PreToolUse` entry in `.codex/hooks.json`; `features.hooks = true` and `features.memories = false` in `.codex/config.toml` |
| Claude | `.claude/CLAUDE.md`; exact `PreToolUse` entry, disabled automatic memory/attribution, disabled bypass mode and canonical permission denials in `.claude/settings.json` |
| Shared | `.ai-harness/runtime/<content-hash>/` with the guard, its policy, both rendered guidance files and a policy manifest |
| Per platform | `.ai-harness/installations/<platform>/global.json`, separate from M2's `receipt.json` |

Guidance is owned as a complete file. Runtime revisions are verified by content
hash and retained after upgrades and removal, including revisions used by the
other platform. The guard runs from this store after the checkout moves. The
guidance's maintenance/bootstrap pointer still refers to the source checkout;
rerun apply from its new location to update that pointer. Lifecycle operations
continue to require a harness checkout.

Version 2 receipts bind all prior values, consumer-independent ownership flags
and added-denial metadata to retained `evidence/<hash>.json` records in the
platform installation store. Audit, apply, remove and publication require matching
evidence. The separate `global-current.json` binds the active revision so an older
valid receipt cannot be replayed. It publishes and rolls back with the receipt.
Old version 1 receipts require [assessment and reviewed recovery](receipt-migration.md).
Audit/removal use the installed runtime and policy, without reading current global
templates or the full catalog. These records detect receipt-only edits, not an
actor rewriting every same-user artifact.

Settings ownership is narrower than file ownership. The receipt records prior
boolean/enum states, newly added deny entries, exact hook ownership and whether
specific containers already existed. It never records unrelated settings.
Upgrades remove only the exact owned old hook and preserve neighboring handlers,
even in the same matcher group. Denial revisions retire only previously added
owned entries. Removal restores prior owned values and retains later unrelated
settings and hooks. Edited owned values, missing required entries, altered
runtime content and malformed receipts block the whole operation.

JSON formatting is normalized on a settings change; unrelated values survive.
The Codex TOML editor preserves unrelated statement bytes and comments. It edits
only ordinary boolean assignments under an explicit `[features]` table and can
add that table when absent. Quoted keys and multiline unrelated values are
covered. Root dotted/inline `features` definitions, duplicate owned keys, the
deprecated `codex_hooks` alias and incompatible types require migration first.
This is a narrow editor, not a general TOML validator; platform config validation
remains necessary for unrelated syntax and layered settings.

## Legacy configuration and activation

Existing guidance without a receipt is a conflict, including a legacy harness
copy. Known checkout-based hooks are identified by their exact command, including
the supplied and canonical checkout path spellings. A similarly named user hook
is preserved. There is no automatic ownership adoption or replace-guidance flag.

To migrate a legacy target, review the conflicting paths reported by the plan,
compare its guidance with the current template, and preserve the original in a
user-chosen backup. Reconcile user additions explicitly and retire only a reviewed
legacy hook before planning again. Do not manufacture a receipt to bypass this
review. A full-profile migration command/rehearsal remains M8 work. M3 provides
safe refusal for ambiguous legacy state and reversible upgrades for owned state.

Codex requires review and trust of each new or changed non-managed hook definition
through `/hooks`; setup does not transfer or bypass trust. A configuration audit
does not prove hook activation. Managed requirements and higher-priority settings
can also prevent activation. See the [Codex hooks guide](https://learn.chatgpt.com/docs/hooks)
and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference#configtoml).

Claude uses its documented executable-plus-argument-array hook form, avoiding
shell interpolation. See the [Claude hook reference](https://code.claude.com/docs/en/hooks).
Codex commands quote literal absolute paths for a POSIX-compatible shell or the
default Windows command processor. Windows paths containing quotes, percent
signs, exclamation marks or newlines are rejected. Custom hook shells need a
separate compatibility review. The [Codex command runner](https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/command_runner.rs)
documents the upstream shell dispatch; shipped versions may differ.

The installed guard preserves the current command/secret rules. Attribution
guidance and Claude's attribution setting are configured, but the repository's
pre-commit attribution scanner remains a separate project/full-profile control.
Hooks supplement platform controls; M3 does not make them an operating-system
security boundary or guarantee coverage of every tool.

## Failure handling and recovery

M2 and M3 serialize mutations with `<target>/.ai-harness-install.lock`. Plans
keep private before/after bytes in process memory and recheck their preconditions
under that lock. Linked roots/ancestors, linked or hardlinked files, source
overlaps and changed ownership are rejected. Reads open a regular file first,
validate its descriptor and path identity, and read through that descriptor.

Global changes stage beneath `.ai-harness/installations/<platform>/.global-stage-*`.
The directory is created with mode 0700 and staged outputs/journal with mode 0600
on POSIX; Windows protection follows the target's ACLs. Publication moves original
files into private staging, validates their contents and publishes replacements
with exclusive hardlinks. This requires local same-filesystem hardlink support.
Replacement settings are mode 0600 on POSIX; rollback restores original files.
Private staging can temporarily contain complete settings files, so it must not
be uploaded or included in issue reports. Only scoped receipts and hashes are in
`transaction.json`.

Caught failures roll back owned changes when current bytes still match. Competing
edits are retained. Ambiguous rollback and abrupt process termination leave the
lock and recovery staging rather than claiming a healthy installation. Empty
directories and unused immutable runtime revisions may remain after rollback.
There is no automatic lock expiry, recovery replay, or garbage collection.

For an interrupted operation:

1. Confirm the original process has stopped. Preserve the lock and staging while
   reviewing recovery; do not rerun a forceful install.
2. Use the journal's ordered `changes` entries to map index `N` to the fixed file
   role (`guidance`, `settings`, `config`, `ownership`, `receipt`). `ownership` is
   `global-current.json`; reconcile it with the receipt as one state. `N.old` contains a moved
   original, `N.new` an unpublished output. Compare file hashes with the journal
   before choosing restoration or completion. Preserve any competing user file.
3. Restore a coherent set of settings, guidance and receipt from the reviewed
   state. Remove the empty lock only after reconciliation, then run the matching
   read-only audit and plan. Retire private recovery copies only after confirming
   the outcome. A `.rollback` file indicates a race during rollback and requires
   individual review rather than inference from its index.

The transaction is recoverable, not a crash-atomic multi-file operation. The
portable Node APIs do not supply descriptor-relative path operations; path and
identity checks reduce races but are not isolation against a malicious process
with the same filesystem authority. Use a target under the user's control and
do not modify its parents during installation.

## Evidence and security review

The registered `tests/global-installation.test.mjs` suite covers both platforms,
read-only/default behavior, idempotence, exact replacement, unrelated values,
shared revisions, denial upgrades, guard execution after moving the checkout,
legacy conflicts, malformed ownership, links/hardlinks, stale plans, competing
edits, rollback, abrupt termination, M2/M3 serialization and an absent target.
The CLI fixture has an empty tool PATH and an untouched other-platform sentinel.
A POSIX shell test executes a hook from a path containing spaces, apostrophes,
dollar signs and backticks without expansion.

Security-checklist verdicts:

| Area | Verdict and evidence |
|---|---|
| Access and identity | Pass for local scope: explicit target/platform and in-process plan authority; malformed target/receipt tests. Sessions/tokens are not applicable. |
| Inputs and outputs | Pass: fixed ownership fields, schema/path checks, private plan bytes, scoped journal and no unrelated settings in reports. |
| Injection and paths | Pass within the documented local authority boundary: argument arrays or strict path quoting; linked/hardlinked and source-overlap denial tests. Same-authority concurrent path replacement remains a portability limitation. |
| Browser/network | Not applicable: no browser, service, webhook or network installation boundary. |
| Files and abuse | Pass for private staging, exclusive publication and preserved recovery; upload/rate-limit controls are not applicable. |
| Dependencies and delivery | Pass: no new packages or CI permissions; runtime source is copied from the checkout and hashed. |
| Regression evidence | Pass for isolated local lifecycle and denied-path tests; Windows execution and GitHub CodeQL remain separate validation. |

All execution evidence for this slice was collected on macOS in temporary targets.
On 2026-09-12, `node scripts/verify.mjs` exited 0: 123 tests, 121 passed and two
Windows-only skips, followed by whitespace, Gitleaks, Zizmor and syntax checks.
Windows-specific existing tests skip on this host, and M3 has not been applied to
a real profile or exercised through live platform sessions. The repository gate
is `node scripts/verify.mjs`; CodeQL runs separately in GitHub and must be checked
before merge. No rule suppression or test exclusion is part of this change.

### CodeQL #10 follow-up

The PR scan found exponential backtracking in the TOML assignment regex: a
repeated group could partition the same bare-key characters many ways when no
assignment separator followed. The original functional fixtures did not test
that failure shape, and the local gate does not run CodeQL.

Assignment separation now scans once for an unquoted `=`, stopping before a
comment, and delegates key validation to the existing key parser. The nested
assignment regex has been removed. A child-process regression test bounds the
runtime for long malformed keys, including 100,000 hyphens, while also accepting
a long valid key. It timed out at three seconds before the fix and completed in
about 32 ms locally after it. Additional fixtures preserve quoted equals signs,
escaped quotes and comments. The child timeout prevents a future regression
from hanging the whole test runner; it is not a production input timeout.
On 2026-09-13 the full `node scripts/verify.mjs` gate exited 0 with 125 tests:
123 passed and two Windows-only skips. PR CodeQL must rerun to confirm closure.

Prefer explicit scanners for quoted/structured configuration boundaries and
include malformed near-matches in parser tests. This closes the demonstrated
case; it does not replace the separate PR CodeQL analysis or imply that every
future security finding is preventable by ordinary functional tests.
