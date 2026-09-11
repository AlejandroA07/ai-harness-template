# M0: safety corrections and preservation evidence

- Baseline: `c6a7589425ef13bcd902f475c098413cad615ccd`.
- Scope: M0 from the [modularity plan](harness-modularity-plan.md), addressing the immediate R2–R4 hazards from the [review](harness-modularity-review.md).
- Plan review: the five public modules, two internal owners, and M0–M8 order remain appropriate. No missing capability or prerequisite was found that blocks M0. Keep the full ownership map and all 22 capability classifications as the coverage contract for later slices.

## Changes and compatibility

Project generation validates the complete saved manifest before using any name as a path. Version 1 retains `generated` and adds `version: 1` and `hashes`, keyed by `claude`/`codex` and skill name, with SHA-256 content fingerprints. Unknown schema fields/versions, invalid or duplicate names, malformed hashes, linked roots, linked manifests, and nonregular adapter resources stop generation before live writes. Both platforms are rendered and preflighted before either is changed. Manifest and changed-adapter preconditions are checked again before application.

Existing adapters must match their saved fingerprints before replacement or removal. A legacy name-only manifest can be adopted only when its adapters exactly match the current canonical rendering. Edited adapters, unowned collisions, and ambiguous legacy removals require review and remain intact. `--check` remains read-only and accepts matching legacy adapters without rewriting their manifest. Repeated generation with unchanged content writes nothing.

Hook reconciliation deduplicates only the exact expected entry and group context, including matcher, Windows command, timeout and other metadata. Sibling hooks and unknown same-named commands survive. Old checkout paths or customized entries remain intact because no trusted historical ownership record exists yet; later migration must explicitly identify them. Machine audit uses the same exact comparison against the current templates instead of accepting a filename substring.

Machine synchronization discovers and preflights target roots, collisions and the archive before generation or live directory creation. Generation renders into a temporary sibling tree, then publishes to the existing stable output path. Publication failure restores the previous tree; a failed restoration retains the backup and reports its location. The command still generates the complete managed profile.

The command names, canonical source paths, full inventory/archive policy, invocation names, user-only settings, guard policy, upstream rules, and project verification/CI payloads are unchanged. No live machine setup or skill relinking was performed.

## Verification evidence

- Baseline gate: 63 tests, 61 passed, two Windows-only tests skipped; `node scripts/verify.mjs` exited 0.
- M0 gate: 75 tests, 73 passed, zero failed, two Windows-only tests skipped; `node scripts/verify.mjs` exited 0, including whitespace, full-history Gitleaks, Zizmor and syntax checks. Zizmor used its default offline mode.
- Complete output comparison: the baseline and revised generators produced identical content hashes for both platform trees across all 22 capabilities, including resources and invocation metadata. Both outputs were isolated temporary directories.
- `tests/project-skills.test.mjs`, registered in `tests/run.mjs`: fresh generation, idempotence, read-only checks, update/removal, resource/body/policy preservation, unrelated content, malformed manifests, legacy adoption/conflicts, edited adapters and linked project/source/platform/adapter/manifest paths.
- `tests/skill-sync.test.mjs`: existing full-profile archival, case-variant handling, stale links and audit fixtures retained; new snapshots prove failed apply preflight and dry-run do not mutate generated/live state or create absent discovery roots.
- `tests/skills.test.mjs`: staged rendering failure, linked output rejection and injected publication failure preserve previous payloads and installed links.
- `tests/configuration.test.mjs`: exact hook deduplication, idempotence, sibling preservation, same-filename collisions, changed group metadata and Windows commands.

## Remaining lifecycle work

M0 is a safety prerequisite, not completion of R2–R4's entire future lifecycle contract. M1/M2 still need the selection planner, durable installation store, authenticated ownership/adoption policy, consumer receipts, and preservation of payloads shared by separate selections. Content fingerprints detect drift; a project-writable manifest is not an authenticated receipt. Do not use this full-tree generator for selective profiles.

Concurrent writers, process termination during publication, and transactional recovery across project adapters/settings are not solved here. The project generator stages and preflights complete output but can still fail after some filesystem writes. The machine tree swap has a short interval between renames and is not an atomic transaction for readers. M2–M4 retain the plan's locking, failure recovery, settings migration and platform-selection requirements. Windows runtime execution remains unverified on this macOS host; the existing two platform-only tests remain skipped. No new dependency or CI action was introduced.

## Security review

| Area | Verdict | Evidence or remaining scope |
|---|---|---|
| Manifest/path input validation | Pass for M0 | Traversal, malformed manifests, linked roots/resources and sentinels covered |
| Content preservation during preflight | Pass for M0 | Edited/unowned adapters and unknown hooks preserved; generated/live snapshots unchanged on rejection |
| Hook configuration identity | Pass | Exact entry and group comparison shared by reconciliation and audit |
| Command injection and existing denied paths | Pass | Existing shell-free argument, Git, secret and attribution tests retained |
| Dependencies and delivery | Pass | No new dependencies or action changes; repository gate retained |
| Authenticated receipts and concurrent lifecycle operations | Fail for the future lifecycle contract | Explicitly retained for M2–M4; fingerprints do not authenticate manifests |
| Web authentication, browser/network services and uploads | Not applicable | Local generation/configuration work only |
