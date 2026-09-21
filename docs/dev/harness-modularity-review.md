# Harness modularity review

- **Baseline:** `a31e26aa1a9d6fdec2f61ca33c50ba32187b307c`
- **Scope:** all 117 tracked paths mapped by responsibility; targeted source review of setup, generation, synchronization, audit, verification, policies, skill relationships, upstream updates, and tests
- **Outcome:** retain five public modules; introduce explicit internal ownership for shared policy/runtime and installation machinery; resolve the blockers below before selective installation
- **Implementation:** [modularity plan](harness-modularity-plan.md); progress: [adoption checklist](graph-and-quality-adoption-roadmap.md)

This is a source-based migration review. It does not claim exhaustive defect detection, a live installation rehearsal, or Windows execution. No live machine setup, project bootstrap, external integration, or application change was performed for this review.

## Do the five modules cover the repository?

Yes, provided public choices are distinguished from shared implementation and repository maintenance. Neither every folder nor every reusable helper needs to become an installation choice.

| Public module | Owns | Important seam |
|---|---|---|
| Global configuration | Shared preferences and machine-scoped Claude/Codex settings/guidance | Selected platform configuration; depends on the shared guard runtime when installing guard hooks |
| Project configuration | Repository guidance, domain/tracker contracts, verification, Git checks, optional CI | Project-local configuration and gates; no dependence on a machine installation |
| Skills | Individual reusable capabilities and their resources | Stable capability ID; platform packaging generated once |
| Workflows | Coordination, routing, sequencing, handoffs, and gates | Declared required/conditional capabilities and external contracts |
| Tool integrations | External programs and connections, including Graphify and existing MCP snippets | Provisioning/configuration, invocation, update, audit, and removal ownership |

Two internal modules need explicit ownership in the plan:

- **Installation core:** catalog validation, dependency resolution, plan/apply, receipts, conflict detection, platform adapters, generation, and audit. All public modules use its interface; it does not depend on any installed module being present.
- **Shared policy/runtime:** existing command/secret guards, attribution checks, and portable process execution. Global and Project configuration consume these implementations; rules must not be duplicated into separate implementations.

Verification/security remain a visible submodule of Project configuration, with shared policy implementation below it. CI is its deployment adapter. Promote either to a sixth public module only if someone actually needs independent adoption that these options cannot express. Platform adapters are internal; custom agents remain excluded from the existing full profile. Cost reports and repository maintenance are not user installation modules.

## Whole-repository ownership map

The groups below cover the tracked baseline. A path can have one implementation owner and several consumers. Source payloads, generated output, and installed state must remain separate concepts.

| Paths / family | Owner | Consumers and migration treatment |
|---|---|---|
| `global/AGENTS.md`, `global/CLAUDE.md` | Global configuration | Shared policy expressed through two platform outputs; preserve both effective behaviors and avoid text drift |
| `global/claude-settings.json`, `global/codex-hooks/` | Global configuration | Platform settings with shared guard dependencies; absolute source-checkout references need lifecycle handling |
| `project/AGENTS.md.template`, `project/CLAUDE.md` | Project configuration | Human-tailored project guidance; preserve local edits |
| `project/.claude/`, `project/.codex/` | Project configuration | Selected platform adapters; both currently installed together |
| `project/.githooks/`, `project/.gitleaks.toml` | Project configuration / verification | Consume shared policy/runtime; own specific installed paths and Git configuration |
| `project/.github/`, `project/scripts/verify.mjs.template` | Project configuration / verification and CI | Preserve gate ordering, pinned actions, least privilege, conditional runtime provisioning |
| `components/guard-policy.mjs`, `guard-git.mjs`, `attribution-policy.mjs`, `check-attribution.mjs`, `pre-commit.mjs`, `claude-tool-policy.mjs` | Shared policy/runtime | Global configuration, project copies, this repository's Git hooks and CI |
| `components/mcp/` | Tool integrations | Existing Context7/Playwright adapters; keep separate from the agent command guards |
| `scripts/machine-setup.mjs`, `bootstrap.mjs` | Installation core entry points | Preserve legacy full-profile commands while adding explicit selection |
| `scripts/config-merge.mjs`, `skill-lib.mjs`, `sync-skills.mjs`, `generate-skills.mjs`, `generate-project-skills.mjs` | Installation core | Generation and owned installation state for Skills, Workflows, and integration adapters |
| `scripts/project-configuration.mjs`, `project-verification.mjs` | Project configuration | Separate tracker, domain-layout, stack and hosting decisions from installation plumbing |
| `scripts/windows-cli.mjs` | Shared runtime | Setup/audit and copied project verifier; retain shell-free command execution |
| `scripts/audit.mjs` | Installation core | Validate catalog independently, then only selected installed profiles/targets |
| `scripts/upstream-skills.mjs`, `skills/upstream-sources.json` | Source provenance/update maintenance | Skills, Workflows, future vendor integrations; local source path must become independent of upstream path |
| `scripts/token-costs.mjs`, `TOKEN-COSTS.md` | Repository maintenance / observability | Report cost by selected capabilities without turning all documentation into startup context |
| `scripts/verify.mjs`, `tests/` including fixtures and lockfile | Repository maintenance / verification | Verify the harness as a product; separate from the verifier it installs into applications |
| `skills/engineering/`, `skills/productivity/`, including Markdown references and diagnostic scripts | Skills and Workflows, classified below | Keep each capability's resources together; logical classification precedes moving source paths |
| `skills/invocation-policy.json` | Capability invocation metadata | Used by both Skills and Workflows; classification must not silently alter user-only behavior |
| Root `.githooks/`, `.github/`, `.gitleaks.toml`, `.gitleaksignore`, `.gitignore` | Repository maintenance | This repository's controls, distinct from portable project payloads; maintain shared policy/pin consistency |
| `README.md`, `MACHINE-SETUP.md`, `BOOTSTRAP.md`, `POCOCK-SKILLS-COMPARISON.md`, `docs/` | Documentation | Entry points, operating contracts, source provenance and historical findings; dated reports do not override living decisions |

Ignored `.generated/` contains generated platform payloads, some referenced by active user links. Ignored `.scratch/` contains local artifacts such as Graphify outputs. User settings, generated project adapters, installed tool environments, hook trust, and archives live outside the tracked source and need their own installation receipts. None is made disposable merely by being generated or ignored.

## Initial classification of all 22 capabilities

This is a migration proposal, not a change to invocation names or upstream text. A skill can have internal steps; classify it as a workflow when coordinating separate capabilities or phases is its main interface.

| Destination | Existing names |
|---|---|
| Skills (13) | `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grilling`, `prototype`, `research`, `security-checklist`, `tdd`, `handoff`, `to-questionnaire`, `wait-what`, `writing-for-agents` |
| Workflows (9) | `ask-alfred`, `grill-me`, `grill-with-docs`, `implement`, `improve-codebase-architecture`, `to-spec`, `to-tickets`, `wayfinder`, `teach` |

`ask-alfred` is a router and `grill-me` is a thin entry point; preserve those useful names. `teach` coordinates a learning workspace across sessions. `to-spec` and `to-tickets` coordinate publication phases. These annotations can live outside exact upstream files. Reclassification must not force every mentioned skill to be installed.

| Relationship type | Existing example | Installation meaning |
|---|---|---|
| Required dependency | `grill-with-docs` invokes `grilling` and `domain-modeling`; `implement` invokes `tdd` and `code-review` | Resolve and install the required capability closure |
| Conditional use | `implement` calls `security-checklist` for relevant changes; TDD consults design vocabulary when needed | Declare condition and availability; make invocation conditional; fail clearly or offer the missing capability when needed |
| Routing recommendation | `ask-alfred` recommends many entry points | Show availability; do not install the entire inventory merely because it is mentioned |
| Artifact/contract dependency | Planning flows consume `docs/agents/issue-tracker.md`; domain work consults glossary/ADR contracts | Check at invocation; support existing documented fallback without installing the whole Project module |
| Platform packaging | Workflow rendered as a platform skill | One discovery entry for a stable name, not duplicate Skills and Workflows entries |

Required installation dependencies must be acyclic. Workflow execution may later contain loops; this is a different graph. The proposed refactor does not install a graph execution framework.

## Findings that affect migration

### R1 — Selected installation conflicts with current reconciliation and audit (blocking)

[Machine setup](../../scripts/machine-setup.mjs) preflights all skills, requires both CLIs and GitHub/security tools, configures both platforms, and enables this repository's Git hooks. [Skill synchronization](../../scripts/sync-skills.mjs) archives visible directories outside the full inventory. [Audit](../../scripts/audit.mjs) requires 22 canonical skills, both platforms, and no custom Claude agents. The [test](../../tests/skills.test.mjs) also hard-codes 22.

These are deliberate current full-profile rules, but incompatible with installing one skill or only Codex configuration. Make requirements, mutation scope, and audit derive from the same selection. Preserve the legacy managed profile explicitly. A tool-only selection must not alter unrelated skills or global policy.

### R2 — Regeneration can invalidate installed links before preflight completes (blocking)

[generateSkillTree](../../scripts/skill-lib.mjs) deletes the whole output root; [sync --apply](../../scripts/sync-skills.mjs) calls it before validating target conflicts. Machine skills link into this shared tree. Generating a subset into the same root would erase unselected payloads, and changing branches or moving the source checkout can affect live installations.

Generate to a staging location, validate, then publish owned payloads without deleting files used by other selections. Keep live installation paths stable or explicitly migrate them using receipts. Do not repoint the user's installation to a temporary refactor worktree.

### R3 — Saved project manifest can select removal paths outside the skill directory (blocking)

[Project generation](../../scripts/generate-project-skills.mjs) parses `previous.generated` and passes its members into recursive removal paths at lines 87–95 without validating names or containment. A pure path check demonstrated that joining `/fixture/.agents/skills` with `../../outside` resolves to `/fixture/outside`. No deletion was executed.

Treat receipts and manifests as untrusted input: validate schema, IDs, platform/scope, normalized containment and links before mutation. A name in a manifest is not sufficient evidence of ownership. Add an isolated sentinel test proving malformed manifests cannot delete outside the owned tree, and tests preserving edited generated adapters.

### R4 — Hook ownership is inferred from a filename substring (blocking)

[replaceHarnessHook](../../scripts/config-merge.mjs) filters any command containing `guard-git.mjs`. A direct pure-function check using `/company/guard-git.mjs` confirmed that this unrelated hook is removed when adding `/harness/guard-git.mjs`. Existing tests cover different filenames, not this collision.

Track the exact installed hook entry and target identity. Migrate known legacy entries conservatively. Preserve unknown hooks; do not use an ID or filename alone as permission to overwrite user content. Audit should verify the expected hook configuration and runtime, not just search for the filename.

### R5 — Bootstrap mixes preservation and unconditional overwrites (blocking for lifecycle work)

[Bootstrap](../../scripts/bootstrap.mjs) preserves guidance and an existing verifier, but overwrites Git hook files, Gitleaks configuration, copied runtime and CI payloads, and sets `core.hooksPath` at lines 180–214. It writes some files before validating later settings/commands. There is no general installation receipt, uninstall contract, or complete rollback.

Plan all changes first, validate targets, then apply with owned receipts and recoverable backups. Retain human-tailored guidance and verifier behavior. On upgrade, distinguish unchanged owned content, user-edited owned content, and unowned collisions. Restore a previous Git setting only if its current value is still the value this installation wrote. Do not blindly overwrite an existing hooks directory or chain unknown executable hooks.

### R6 — New vendors and source moves do not fit the upstream updater (blocking before vendor integration)

[Upstream validation](../../scripts/upstream-skills.mjs) permits one repository and specific source-path shapes. Local destinations are derived from the upstream engineering/productivity bucket at lines 166 and 181. Exact updates allow only flat Markdown resources. This is suitable for the existing reviewed inventory, not a generic Graphify/Archify acquisition path.

Separate local capability IDs/paths from upstream repository/path/revision. Preserve exact/adapted/local modes. Define a reviewed resource policy for executable vendor packages, hashes and notices rather than weakening the existing Markdown-only updater globally. Test resource-only changes and retain invocation policy across updates.

### R7 — Portable verification and domain/tracker contracts need explicit ownership (required)

[Project configuration](../../scripts/project-configuration.mjs) owns both tracker and domain contracts; workflows consume them. [Project verification](../../scripts/project-verification.mjs) adds Gitleaks and conditional workflow scanning. Generated CI expects a verifier and runtime payload; a partial install must not leave imports or commands pointing at missing files.

Model verification as a Project submodule with required runtime/check dependencies, and CI as an optional adapter. Keep the harness's own gate separate. An existing project verifier needs deliberate integration; copying the default over it is not acceptable. Check generated project-adapter drift in the selected project's gate where adapters are installed; the current generated verifier does not automatically call their `--check` path.

### R8 — Settings and generated metadata would drift if split mechanically (required)

Global guidance is duplicated for the two platforms; global/project policy settings also overlap. Generation omits selected upstream metadata/resources such as an `agents/` directory and rebuilds platform metadata. Moving a workflow into a new folder without updating source discovery, upstream ownership, invocation policy, cost reporting, tests, and installed links would break consumers.

Classify capabilities first while retaining physical paths. Reuse policy and platform renderers. When adding richer vendor packages, explicitly preserve required runtime resources, licenses and metadata; one general-purpose skill renderer is not automatically suitable for every package.

### R9 — Cost measurement and verification discovery need migration coverage (required)

[token-costs --write](../../scripts/token-costs.mjs) replaces the entire ledger from a template containing fixed historical measurements. New manually recorded samples could be lost. [Repository verification](../../scripts/verify.mjs) scans all `.mjs` files outside `.git` and `.generated`, including `.scratch` or future vendor runtime directories; tests are also explicitly enumerated in [tests/run.mjs](../../tests/run.mjs).

Separate measured data from generated inventories, and make new tests run through the actual gate. Define owned source/resource validation rather than accidentally syntax-checking every downloaded tool or ignored experiment. Preserve scanning of shipped CI templates. Reconcile the documented Node minimum with the runtime features used by tests and the Node version exercised in CI.

### R10 — Tests protect today's full profile, not yet the proposed combinations (required)

The suite contains useful executable guard/link/configuration tests, but many integrity assertions match source strings and paths. Some proposed guarantees, such as complete update recovery, concurrent profile generation, individual platform installation and uninstall ownership, are not covered.

Add behavioral installation tests with isolated target directories and fake external commands. Keep existing branch, secret, attribution, symlink and Windows argument-handling tests. A green current suite establishes a baseline; it does not prove the future selection/lifecycle contracts.

## Relevant security-checklist verdicts

| Area | Verdict for the reviewed migration surfaces | Evidence |
|---|---|---|
| Input/path validation | Fail | R3: saved generated names reach removal paths without validation |
| Ownership and configuration preservation | Fail | R4–R5: substring ownership and unconditional writes |
| Command argument handling | Pass for inspected process helpers | Existing argument arrays and Windows shim helper; preserve and regression-test |
| Dependency provenance | Pass for the current narrow updater; insufficient for new vendors | R6; generalization requires a separate reviewed policy |
| Regression evidence | Partial: fail for the new lifecycle contract | R10; existing tests do not cover the proposed feature matrix |
| Authentication, web sessions, uploads, deployed browser/network service | Not applicable | This review concerns local source/configuration and planning; no new service was exposed |

The policy findings are recorded for implementation; they were not silently fixed during this review.

## Recommended next action

Start the implementation in a fresh task using the self-contained handoff in [the plan](harness-modularity-plan.md#fresh-task-handoff). Work in independently verified slices, with the lifecycle blockers resolved before applying modular configuration to a real machine. Westcoast Cars is a separate tool-evaluation target, not the first installer test fixture.
