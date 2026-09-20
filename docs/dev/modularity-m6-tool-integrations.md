# M6: provenance and tool integrations

M6 adds Tool integrations to the shared `setup.mjs` interface. Graphify,
Archify, Context7 MCP and Playwright MCP now have one validated catalog and one
ownership-aware target lifecycle. The lifecycle accepts a caller-supplied
distribution file, verifies its exact catalog size and SHA-256 or npm SHA-512
integrity, publishes it with the adapted discovery/configuration boundary, and
records independently verified ownership evidence.

## Use

Download the catalog URL separately, without credentials in the URL, then pass
the resulting absolute path to planning and apply. This keeps network access out
of target preflight and makes the exact bytes being authorized visible.

```text
node scripts/setup.mjs plan --module tool-integrations --select graphify --platform codex --scope project
node scripts/setup.mjs plan --module tool-integrations --select graphify --platform codex --scope project --target <project> --artifact graphify=<absolute-wheel>
node scripts/setup.mjs apply --module tool-integrations --select graphify --platform codex --scope project --target <project> --artifact graphify=<absolute-wheel> --materialize --allow-network --python <absolute-python-3.10+> --apply
node scripts/setup.mjs audit --module tool-integrations --platform codex --scope project --target <project>
node scripts/setup.mjs remove --module tool-integrations --select graphify --platform codex --scope project --target <project> --apply
```

The first command is selection-only and performs no target inspection. The
second is target-aware but read-only. Apply and removal still preview unless
`--apply` is present. Audit inspects the complete receipt and therefore accepts
no selection, capability, or artifact inputs.

`--materialize` is a separate explicit authorization. Graphify requires an
absolute Python 3.10+ interpreter and `--allow-network`; pip accepts binary
wheels only and verifies every dependency against reviewed requirement hashes.
Context7 and Playwright materialization likewise require `--allow-network`; npm
uses the committed package lock, ignores package scripts, and exposes an owned
local entry point instead of `npx`. Archify's reviewed archive is self-contained,
so its safe extraction needs no network flag.

Artifacts live under the selected scope's
`installations/<platform>/integrations/artifacts/` store. Graphify and Archify
adapters are installed under `.agents/skills/` or `.claude/skills/`. Executable
trees live under `integrations/runtime/`. MCP entries invoke those local trees
and are merged into `.codex/config.toml` or project `.mcp.json`. Claude MCP adapters
are project-scoped because its user-scoped registry shares a broader private
state file; Codex supports both scopes. The receipt owns only the exact MCP server entry or marked TOML
block. Existing entries with the same ID are conflicts, unrelated entries are
preserved, and removal refuses an edited owned entry. Vendor installers never
receive ownership of shared settings.

## State and activation contract

Plans report these fields independently:

- `provisioned`: the approved distribution artifact is present and verified;
- `configured`: the adapted discovery or MCP entry is installed;
- `invocable`: the owned runtime tree, interpreter and dependency profile satisfy
  the enabled capabilities;
- `plannedInvocable`: explicit materialization will make the selected runtime
  invocable when apply succeeds;
- `running`: always false in installation receipts because a receipt is not
  process evidence.

Ordinary planning remains read-only. Apply expands only validated archive paths.
Package managers run only for explicit materialization with explicit network
authorization, an isolated home/config, no npm lifecycle scripts, binary-only
Python dependencies, and committed integrity hashes. Materialization happens
under the target lock before publication; failure leaves no claimed runtime.
`planIntegrationAction` emits bounded literal argument arrays and never invokes
a shell. Installation and audit never infer that a watcher or server is running.

Graphify 0.9.58 exposes local code build, refresh, clustering, query, path,
explain, export and graph merge by default. Semantic/remote ingestion, database
connections, model-authored labels, repository cloning, PR/network features,
query logging, update checks, watch mode, Git hooks, MCP, cross-project graphs
and work memory are present but disabled. They require an explicit
`--enable graphify:<capability>` on apply. Capabilities needing optional Python
packages require an `all`-profile rematerialization. Enabling never starts a
watcher/server, contacts a model provider, or creates memory. Project-scoped
hook activation writes two exact harness-owned hooks with executable modes; the
vendor hook installer is never called, edited or colliding hooks fail closed,
and removal deletes only the recorded bytes. Query planning remains separate
from rebuild planning.

Archify 2.16.0 uses the same acquisition and removal contract for doctor,
validation, render and HTML delivery. Preview and update/network awareness stay
disabled unless explicitly selected. Its adapter labels authored, extracted and
inferred evidence separately and treats its output as a visualization, not proof
of source completeness.

## Provenance and resource policy

`catalog/integrations.json` records the adapted local boundary, upstream
repository/path, exact release, reviewed commit when the artifact publisher
exposes one, license notices, runtime minimum, immutable artifact URL, byte size,
format and digest. Runtime resources add base and optional M6 Graphify locks and
per-MCP npm package locks; catalog loading verifies their SHA-256 values before
planning. The Graphify optional profile covers every M6-declared capability but
intentionally excludes the unrelated DreamMaker and Chinese-tokenizer extras,
whose dependencies require source builds. Adapter loading rejects links, unsafe
paths, package/version drift and ambiguous MCP ownership.

The current pins are Graphify `graphifyy==0.9.58`, Archify `v2.16.0`, Context7
MCP `3.2.5`, and Playwright MCP `0.0.78`. Context7's npm artifact is the review
authority because its registry metadata does not expose a full source commit;
the catalog records that absence as `null` instead of inventing provenance.

## Verification and security boundary

Registered tests cover exact and altered artifacts, linked inputs, unsafe
catalog URLs and paths, default-off memory/network/background features, both
platform MCP merge formats, edited owned settings, unowned collisions, receipt
audit, safe archive extraction, explicit network denial, dependency-lock drift,
runtime tampering, a real installed Archify invocation, Graphify query/watch/MCP
argument contracts, lifecycle-owned hooks, removal, and the shared CLI. Tests
use temporary targets and fixture artifacts and write no developer profile.
The repository gate passes with 180 tests (178 passed and two Windows-only
resolution cases skipped on macOS), the full-history secret scan, the GitHub
Actions audit, whitespace checks and syntax checks. Separate release validation
materialized the exact Context7 and Playwright packages, Graphify's base and
optional profiles, and the Archify archive; the optional Graphify profile owns
21,730 files and passed its version probe.

Security checklist verdicts:

- Access and identity — **Pass**: every operation requires an explicit absolute
  target, platform, scope, integration ID and apply authorization; no remote
  identity surface is added.
- Inputs and outputs — **Pass**: schemas bound IDs, collections, strings, file
  sizes, formats, digests, receipt fields and action operands.
- Injection and navigation — **Pass**: target paths are constrained, linked and
  hard-linked files are rejected, and action commands are literal arrays with no
  shell interpolation.
- Browser and network boundaries — **Pass**: planning and archive-only apply are
  offline. Dependency acquisition requires both `--materialize` and
  `--allow-network`, uses fixed public registries, ignores user package-manager
  configuration and does not inherit credential-bearing environment variables.
- Files and abuse — **Pass**: caller-supplied artifacts have a 20 MB catalog cap,
  server-controlled target names, exact digest checks, bounded expansion, CRC
  checks, and traversal/link rejection. Rate limiting is not applicable to this
  local lifecycle.
- Dependencies and delivery — **Pass**: top-level distributions and transitive
  runtime dependencies are exact-version and integrity/hash locked. npm scripts
  and Python source builds are disabled. Runtime trees and executable hooks are
  receipt-owned and tamper-checked; no secret is read or stored.
- Regression evidence — **Pass**: positive lifecycle cases and denied linked,
  altered, edited, colliding and automatically activated cases are registered in
  the repository test runner.
