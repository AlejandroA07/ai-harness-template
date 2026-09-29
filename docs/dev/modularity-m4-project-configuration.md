# M4: project configuration lifecycle

`bootstrap.mjs` is the single public project-configuration command. It uses the
receipt-backed project installer, shared target lock, safe file reader and staged
publisher from M2/M3. The lower-level lifecycle remains an implementation and
recovery boundary, not a second user interface.

## Use

Replace `<project>` with an existing project directory outside the harness checkout.
No Claude or Codex CLI is needed.

```text
node scripts/bootstrap.mjs <project>
node scripts/bootstrap.mjs <project> --apply
node <project>/scripts/verify-harness.mjs
```

The first command is always read-only. `--apply` installs or updates both Codex
and Claude project guidance and adapters, then activates `.githooks` in the target
Git repository. A new empty project needs a meaningful verifier or a recognized
stack before setup can be applied.

Bootstrap selects the smallest deterministic configuration it can establish:

- it preserves an existing `scripts/verify.mjs`; otherwise it generates one for a supported npm or .NET project;
- it detects GitHub from `gh` or the `origin` remote, with `--github` as an explicit override;
- it adds GitHub verification CI only for a generated verifier whose dependencies are known;
- it reuses the receipt's choices on later updates;
- it accepts `--domain-layout=single` or `--domain-layout=multi` when structural evidence needs a human decision.

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

The project gate is `node scripts/verify-harness.mjs`. It validates required
project contracts, owned runtime/guidance files, ignore state, generated adapter
content, executable hook files and `core.hooksPath=.githooks` before running the
project's `scripts/verify.mjs`. A nonzero result from that verifier is propagated.
It does not install dependencies or execute the hooks. Generated CI activates the
same repository hook path before invoking this gate; existing project CI must do
the same.

Existing `AGENTS.md`, `CLAUDE.md`, domain/tracker documents and scanner config
are preserved. For existing guidance, review and add the gate/domain/tracker
pointers yourself where they belong. New guidance uses the selected gate.
Domain glossary and ADR files are never generated from guessed knowledge.

Both platform guidance files and any project skill adapters are installed together.
Universal Claude and Codex behavior belongs to machine setup: this lifecycle does not create
or edit `.claude/settings.json`, `.codex/hooks.json`, or `.codex/config.toml`.
Receipts from the earlier project-policy design are rejected without mutation.

No machine configuration, machine skills, custom agents or environment variables
are changed. Bootstrap installs repository hooks and sets
`core.hooksPath=.githooks`; an existing unowned hook path is not overwritten by
the receipt lifecycle.

## Ownership and project adapters

`.harness/project-installation.json` records the active platforms, configuration
options, file hashes and ignore-block ownership. One project receipt owns shared
runtime/guidance once. Removing one platform preserves the other platform and
shared files; the last removal retires unchanged owned shared files. This receipt
contains relative project paths, so a checkout can move or be cloned with its
runtime.

Receipt version 4 points to a content-addressed snapshot under
`.harness/project-payloads/<hash>/`. The snapshot contains installer-produced owned
files and a manifest of scoped ownership/prior states. Planning and the installed
gate require the receipt to match this independently checked evidence. Editing a
receipt alone cannot claim a preserved file or rewrite ownership.
The separate `.harness/project-current.json` binds the active revision, preventing
replay of older receipts. It is published and restored with the receipt.
Missing or edited evidence blocks mutation. Version 1–3 receipts require the [read-only assessment and reviewed recovery
procedure](receipt-migration.md). Preserve ambiguous content; do not use the old
remover as a shortcut. Do not manually change a receipt
version or reconstruct ownership from existing file hashes.

Removal uses stored installed bytes; it does not regenerate
the remaining platform from current templates or unfinished local skill sources.
Ownership payloads remain after updates, removal and rollback. They contain
installed content, not copies of arbitrary user configuration.
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
before/after hashes. Staging can contain complete original files, so never upload
it as diagnostic material. Same-filesystem hardlinks are required.

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
agent settings, Git and unrelated project state; default read-only CLI behavior
with no platform tools; idempotence; moved-checkout execution; adapter
metadata/resources, drift and reinstall; optional CI dependencies; domain/tracker
conflicts; unsafe paths and malformed receipts; stale plans; injected rollback;
concurrent source edits; preserved competing edits; abrupt termination; project
verifier failure propagation; and legacy receipt rejection.
Review regressions also cover forged ownership, missing/edited payload evidence,
legacy receipt rejection, nonblocking FIFO denial, retained-platform preservation
despite changed sources, and explicit nested .NET paths.

Security-checklist verdicts:

| Area | Verdict |
|---|---|
| Access and identity | Pass for the explicit local target: validated module/platform/scope and private in-process plans. Network identity controls are not applicable. |
| Input/output | Pass: constrained receipt paths/schema, fixed option enums and scoped ownership. Plans omit arbitrary configuration contents. |
| Injection and filesystem | Pass within the documented local authority boundary: known command arrays, unsafe path/link denial and staged exclusive publication. |
| Browser/network | Not applicable to local installation; opt-in CI uses existing pinned actions with limited permissions. |
| Files and abuse | Pass: private staging, bounded structural discovery and tested conflict/recovery behavior. Upload/rate-limit controls are not applicable. |
| Dependencies and delivery | Pass: no new package dependencies; shipped imports are self-contained and generated CI installs its declared tools. |
| Regression evidence | Pass for isolated macOS execution. Live Windows/platform sessions and GitHub CodeQL remain separate validation. |

All installation experiments use temporary targets. The repository gate is
`node scripts/verify.mjs`; GitHub CodeQL must also pass before merging. This slice
does not add rule suppressions or exclude tests from analysis.

The current change must pass `node scripts/verify.mjs` before completion. Live
Windows execution and PR CodeQL remain separate validation.
