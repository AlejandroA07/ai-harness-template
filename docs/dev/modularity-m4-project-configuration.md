# M4: selected project configuration

M4 adds project-scoped plan/apply/update/audit/remove to `setup.mjs`. It uses the
shared target lock, file reader and staged publisher from M2/M3. Bootstrap remains
the compatibility entry point for its established full profile.

## Use

Replace `<project>` with an existing absolute project directory outside the
harness checkout. No platform CLI is needed for planning or installation.

```text
node scripts/setup.mjs plan --module project-configuration --platform codex --scope project --target <project>
node scripts/setup.mjs apply --module project-configuration --platform codex --scope project --target <project> --apply
node scripts/setup.mjs audit --module project-configuration --platform codex --scope project --target <project>
node scripts/setup.mjs remove --module project-configuration --platform codex --scope project --target <project> --apply
```

Use `claude` for Claude. Install the second platform with a separate apply.
Apply performs updates too. All commands are read-only unless apply/remove has
`--apply`; `--json` returns the plan. Do not combine this module with skill IDs or
other modules in one invocation. A new empty project needs a meaningful verifier
or a recognized stack before setup can be applied.

Plan/apply options are explicit, and omitted values reuse the receipt on updates:

| Option | Behavior |
|---|---|
| `--verification existing` | Preserve `scripts/verify.mjs` and run it through the new gate. Default when a verifier exists. |
| `--verification generated` | Create a verifier for detected npm and/or .NET projects. Default when no verifier exists. Rejects an existing unowned verifier and unsupported package managers. |
| `--ci none` | Default. Preserve existing workflows without adding CI. |
| `--ci github` | Add `.github/workflows/harness-project.yml` for generated verification with known dependencies. Requires a Node lockfile and a pinned .NET SDK when applicable. |
| `--tracker local` or `github` | Local Markdown is the initial default; GitHub is explicit. An existing contradictory/custom contract requires review. No remote tracker operation occurs. |
| `--domain-layout single` or `multi` | Reuse an existing recognized layout. Without one, simple projects default to single; structural multi-project signals require an explicit choice. |

Changing verifier ownership mode requires removal and a fresh installation.
Generated .NET verification passes the discovered solution or project path to
restore, build, format and test, including for nested projects. Multiple solutions,
or multiple projects without a solution, require an existing project verifier.
Existing/custom verifiers may depend on arbitrary tools; their CI remains
project-managed rather than guessing those dependencies. The generated CI path
supports the standard npm/.NET gate: Node 22, Python for Zizmor, Gitleaks, Zizmor,
and .NET from `global.json`. Action revisions and scanner versions come from the
existing pinned project workflow. It does not add CodeQL or Dependabot; those
remain separate project/full-profile choices.

## Verification and activation

The selected gate is `node scripts/verify-harness.mjs`. It validates owned
runtime/guidance files, scoped settings and generated adapter content before
running the project's `scripts/verify.mjs`. A nonzero result from that verifier
is propagated. Audit itself does not execute the project verifier, install
dependencies, run hooks, or prove platform activation.

Existing `AGENTS.md`, `CLAUDE.md`, domain/tracker documents and scanner config
are preserved. For existing guidance, review and add the gate/domain/tracker
pointers yourself where they belong. New guidance uses the selected gate.
Domain glossary and ADR files are never generated from guessed knowledge.

Only selected platform settings/adapters are installed. Claude receives the
project guard and disabled automatic memory/attribution. Codex receives its
project guard plus `features.hooks = true` and `features.memories = false`.
The existing project hook command templates resolve the project root at runtime;
the guard and its imports are copied into the project. Review platform trust and
effective layered settings after installation; Codex hook trust is not copied or
bypassed. Custom shell/version compatibility needs validation in that platform.

No machine configuration, machine skills, custom agents, environment variables,
Git hooks or `core.hooksPath` are changed. Existing Git hooks remain active. The
shared attribution checker is shipped for explicit use, but installation does
not attach a new pre-commit hook or silently change a project's commit policy.

## Ownership and project adapters

`.harness/project-installation.json` records the active platforms, configuration
options, file hashes and scoped prior settings. One project receipt owns shared
runtime/guidance once. Removing one platform preserves the other platform and
shared files; the last removal retires unchanged owned shared files. This receipt
contains relative project paths, so a checkout can move or be cloned with its
runtime. Commit the receipt, current-revision record, ownership payloads and generated runtime/adapters with
project changes.

Receipt version 3 points to a content-addressed snapshot under
`.harness/project-payloads/<hash>/`. The snapshot contains installer-produced owned
files and a manifest of scoped ownership/prior states. Planning and the installed
gate require the receipt to match this independently checked evidence. Editing a
receipt alone cannot claim a preserved file or rewrite prior settings ownership.
The separate `.harness/project-current.json` binds the active revision, preventing
replay of older receipts. It is published and restored with the receipt.
Missing or edited evidence blocks mutation. Version 1–2 receipts require the [read-only assessment and reviewed recovery
procedure](receipt-migration.md). Preserve ambiguous content; do not use the old
remover as a shortcut. Do not manually change a receipt
version or reconstruct ownership from existing file hashes.

Removal uses stored installed bytes and hook definitions; it does not regenerate
the remaining platform from current templates or unfinished local skill sources.
Ownership payloads remain after updates, removal and rollback. They contain scoped
prior values and installed content, not copies of arbitrary user configuration.
Review and retain them with recovery evidence before any manual cleanup. These
hashes detect inconsistency; they are not signatures or protection against an actor
who can replace both receipt and payload with the same filesystem authority.

Keep canonical project skills in named directories under `.harness/skills/`, with
optional `invocation-policy.json` using `userOnly`. Apply renders their documents
and resources into `.agents/skills/` for Codex and `.claude/skills/` for Claude.
It installs no skills from the reusable harness catalog. A project update refreshes
the shared runtime and adapters for all platforms recorded in this project receipt;
the preview lists those changes. Source changes must be followed by apply before
the gate can pass. There is no checkout-dependent generator at runtime.

Duplicate names, nested skill roots, unsafe source trees, unowned adapters and
additional files inside owned adapter directories block mutation. Existing
unrelated skills outside those owned directories remain intact. Empty directories
may remain after removal and do not prevent reinstallation. Project skill sources
are never removed by this module. The legacy `generated-skills.json` generator
uses separate ownership; migrate its existing adapters through review instead of
running both generators over the same entries.

Ordinary owned files require their recorded content to match before update or
removal. Editing a generated owned guide or runtime creates a conflict requiring
review, not permission to overwrite it. Existing borrowed files remain unowned.
Settings use exact hook matching and prior boolean states; unrelated values and
neighboring hook handlers survive removal. JSON formatting can normalize on a
change. Codex feature edits use the narrow TOML editor and its existing migration
restrictions.

`.gitignore` receives one marked block for local scratch, recovery staging and the
shared target lock. Removal retires only the added block, preserving other entries
and later additions. A preexisting exact block is not claimed. Ambiguous/edited
blocks require review.

## Safety, recovery and limits

The installer preflights sources, target files, ownership and parent identities
before writes, then rechecks under `.ai-harness-install.lock`. Publication checks
the observed files, source snapshots and adapter inventories at each checkpoint.
Unsafe links/hardlinks, path escapes, source overlap, malformed receipts, edited
owned files and unowned runtime/workflow collisions fail before publication.
Installation never executes the target's verifier or package scripts.

Private `.harness/.project-stage-*` directories hold staged outputs and moved
originals. On POSIX they are mode 0700, with new output/journal files mode 0600;
Windows follows target ACLs. Journals contain ordered relative file IDs and
before/after hashes. Staging can contain complete original settings, so never
upload it as diagnostic material. Same-filesystem hardlinks are required.

Caught failures restore originals when current files still match the published
state. Competing edits are preserved; ambiguous rollback and abrupt termination
retain the lock and staging. Confirm the old process has stopped, then reconcile
the journal's ordered entries with `N.old`/`N.new` files and live hashes before
restoring or completing the operation. Preserve competing files and individually
review any `.rollback` entries. Remove recovery state and the lock only after
reconciliation, then audit. There is no automatic expiry or force/adopt mode.

This is recoverable multi-file publication, not a crash-atomic transaction or
isolation against another process with the same filesystem authority. The target
must be under the user's control. The M8 full profile composes machine Skills and
Global configuration only; project configuration remains an explicit per-project
selection because a machine migration cannot infer its verification and CI choices.

## Evidence

The registered project lifecycle tests cover both platforms; untouched machine,
Git and unrelated project state; default read-only CLI behavior with no platform
tools; idempotence; moved-checkout execution; adapter metadata/resources, drift
and reinstall; exact settings ownership; optional CI dependencies; domain/tracker
conflicts; unsafe paths and malformed receipts; stale plans; injected rollback;
concurrent source edits; preserved competing edits; abrupt termination; project
verifier failure propagation; and actual guard/attribution denial.
Review regressions also cover forged ownership, missing/edited payload evidence,
legacy receipt rejection, nonblocking FIFO denial, retained-platform preservation
despite changed sources, explicit nested .NET paths and matcher-independent Claude
scalar ownership.

Security-checklist verdicts:

| Area | Verdict |
|---|---|
| Access and identity | Pass for the explicit local target: validated module/platform/scope and private in-process plans. Network identity controls are not applicable. |
| Input/output | Pass: constrained receipt paths/schema, fixed option enums and scoped ownership. Plans omit arbitrary configuration contents. |
| Injection and filesystem | Pass within the documented local authority boundary: known command arrays, reused platform hook templates, unsafe path/link denial and staged exclusive publication. |
| Browser/network | Not applicable to local installation; opt-in CI uses existing pinned actions with limited permissions. |
| Files and abuse | Pass: private staging, bounded structural discovery and tested conflict/recovery behavior. Upload/rate-limit controls are not applicable. |
| Dependencies and delivery | Pass: no new package dependencies; shipped imports are self-contained and generated CI installs its declared tools. |
| Regression evidence | Pass for isolated macOS execution. Live Windows/platform sessions and GitHub CodeQL remain separate validation. |

All installation experiments use temporary targets. The repository gate is
`node scripts/verify.mjs`; GitHub CodeQL must also pass before merging. This slice
does not add rule suppressions or exclude tests from analysis.

On 2026-09-13, `node scripts/verify.mjs` exited 0 after the review fixes: 146
tests, 144 passed and two Windows-only skips, followed by whitespace, Gitleaks,
Zizmor and syntax checks. No real project or machine profile was changed.
Live Windows execution and PR CodeQL are not established by this local result.
