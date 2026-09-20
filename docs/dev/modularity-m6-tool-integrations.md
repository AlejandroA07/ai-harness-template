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
node scripts/setup.mjs apply --module tool-integrations --select graphify --platform codex --scope project --target <project> --artifact graphify=<absolute-wheel> --apply
node scripts/setup.mjs audit --module tool-integrations --platform codex --scope project --target <project>
node scripts/setup.mjs remove --module tool-integrations --select graphify --platform codex --scope project --target <project> --apply
```

The first command is selection-only and performs no target inspection. The
second is target-aware but read-only. Apply and removal still preview unless
`--apply` is present. Audit inspects the complete receipt and therefore accepts
no selection, capability, or artifact inputs.

Artifacts live under the selected scope's
`installations/<platform>/integrations/artifacts/` store. Graphify and Archify
adapters are installed under `.agents/skills/` or `.claude/skills/`. MCP entries
are merged into `.codex/config.toml` or project `.mcp.json`. Claude MCP adapters
are project-scoped because its user-scoped registry shares a broader private
state file; Codex supports both scopes. The receipt owns only the exact MCP server entry or marked TOML
block. Existing entries with the same ID are conflicts, unrelated entries are
preserved, and removal refuses an edited owned entry. Vendor installers never
receive ownership of shared settings.

## State and activation contract

Plans report four fields independently:

- `provisioned`: the approved distribution artifact is present and verified;
- `configured`: the adapted discovery or MCP entry is installed;
- `invocable`: the installed boundary already supplies a direct invocation
  route; Graphify and Archify remain false until their distribution is
  explicitly materialized into the receipt's runtime location;
- `running`: always false in installation receipts because a receipt is not
  process evidence.

The M6 lifecycle deliberately does not execute a package manager, expand an
archive, start a process, contact a vendor, install a Git hook, or claim a
runtime is running. `planIntegrationAction` provides bounded literal argument
arrays for separately authorized invocation/activation and reports when runtime
materialization is still required. This is the reviewed acquisition boundary;
transitive dependency resolution and executable materialization cannot happen
silently during setup.

Graphify 0.9.58 exposes local code build, refresh, clustering, query, path,
explain, export and graph merge by default. Semantic/remote ingestion, database
connections, model-authored labels, repository cloning, PR/network features,
query logging, update checks, watch mode, Git hooks, MCP, cross-project graphs
and work memory are present but disabled. They require an explicit
`--enable graphify:<capability>` on apply. Enabling records authorization; it
does not start a watcher/server, edit Git configuration, contact a model
provider, or create memory. Query planning is separate from rebuild planning.

Archify 2.16.0 uses the same acquisition and removal contract for doctor,
validation, render and HTML delivery. Preview and update/network awareness stay
disabled unless explicitly selected. Its adapter labels authored, extracted and
inferred evidence separately and treats its output as a visualization, not proof
of source completeness.

## Provenance and resource policy

`catalog/integrations.json` records the adapted local boundary, upstream
repository/path, exact release, reviewed commit when the artifact publisher
exposes one, license notices, runtime minimum, immutable artifact URL, byte size,
format and digest. The artifact digest is the approved resource inventory for
the opaque wheel, npm tarball, or release archive. Adapter loading rejects links,
unsafe paths, package/version drift and ambiguous MCP ownership.

The current pins are Graphify `graphifyy==0.9.58`, Archify `v2.16.0`, Context7
MCP `3.2.5`, and Playwright MCP `0.0.78`. Context7's npm artifact is the review
authority because its registry metadata does not expose a full source commit;
the catalog records that absence as `null` instead of inventing provenance.

## Verification and security boundary

Registered tests cover exact and altered artifacts, linked inputs, unsafe
catalog URLs and paths, default-off memory/network/background features, both
platform MCP merge formats, edited owned settings, unowned collisions, receipt
audit, Graphify query/activation separation, Archify installation/removal, and
the shared CLI. Tests use temporary targets and fixture artifacts; they invoke
no vendor tool and write no developer profile.

Local verification on 2026-09-20 passed `node scripts/verify.mjs`: 177 tests
ran, 175 passed, and 2 Windows-only cases were skipped on macOS. The same gate
also passed the whitespace check, full-history Gitleaks scan, GitHub Actions
security audit, and JavaScript syntax checks.

Security checklist verdicts:

- Access and identity — **Pass**: every operation requires an explicit absolute
  target, platform, scope, integration ID and apply authorization; no remote
  identity surface is added.
- Inputs and outputs — **Pass**: schemas bound IDs, collections, strings, file
  sizes, formats, digests, receipt fields and action operands.
- Injection and navigation — **Pass**: target paths are constrained, linked and
  hard-linked files are rejected, and action commands are literal arrays with no
  shell interpolation.
- Browser and network boundaries — **Not applicable**: setup performs no browser
  or outbound request. Catalog URLs are HTTPS and host-allowlisted for the
  separate caller-controlled acquisition step.
- Files and abuse — **Pass**: caller-supplied artifacts have a 20 MB catalog cap,
  server-controlled target names, exact digest checks and no archive execution.
  Rate limiting is not applicable to this local lifecycle.
- Dependencies and delivery — **Pass**: no code dependency was added or executed;
  top-level third-party distributions are exact-version and integrity pinned,
  license-recorded, and remain opaque until a later explicit materialization
  step. No secret is read or stored.
- Regression evidence — **Pass**: positive lifecycle cases and denied linked,
  altered, edited, colliding and automatically activated cases are registered in
  the repository test runner.
