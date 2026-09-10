# Graph and quality tooling adoption roadmap

- **Kind:** living progress tracker
- **Last updated:** 2026-09-10
- **Current position:** Step 1 is complete. A bounded Graphify pilot on this JavaScript harness passed with limitations; the representative C# repository for Step 2 is still not selected.
- **Next action:** design the user-only Graphify interface and pin Archify for a canonical skill trial, then select the C# repository needed for the remaining evidence.

This file is the durable checklist for the graph-engineering, Graphify, architecture-viewer, CRAP, and hardening work. Update it after every completed step so progress does not depend on remembering a conversation.

## Where everything lives

| Need | Open this |
|---|---|
| Learn the concepts and C# example | [Original teaching guide](2026-08-19-graph-and-quality-tooling.md) |
| Read the current conclusions and detailed comparisons | [2026-09-10 follow-up guide](2026-09-10-graphify-architecture-quality-follow-up.md) |
| See what is done and what is next | This roadmap |
| Inspect the current harness relationship graph | [Graphify relationship view](../../.scratch/graphify-harness-2026-09-10/graph.html) |
| Browse the current harness by directory and symbol | [Graphify tree view](../../.scratch/graphify-harness-2026-09-10/GRAPH_TREE.html) |
| Understand model-context and token accounting | [Token-cost ledger](../../TOKEN-COSTS.md) |

The Graphify artifacts are local, Git-ignored, and regenerable. The Markdown guides and roadmap are the durable source of truth.

## Status at a glance

| Step | Outcome | Status | Existing artifact or evidence |
|---|---|---|---|
| 1 | Learn the graph-engineering model | **Complete** | [Research and teaching guide](2026-08-19-graph-and-quality-tooling.md); user confirmed it was read |
| 2 | Select one representative C# repository | **Not started** | No repository selected |
| 3 | Run isolated Graphify evaluations | **In progress — harness pilot complete; C# pilot waiting** | [2026-09-10 pilot evidence](2026-09-10-graphify-architecture-quality-follow-up.md#completed-harness-pilot) |
| 4 | Evaluate Microsoft's CRAP skills | **Waiting for Steps 2–3** | [CRAP findings](2026-08-19-graph-and-quality-tooling.md#crap-a-metric-not-an-ai-reviewer) |
| 5 | Add project-local architecture tests where useful | **Waiting for Step 2** | [Architecture-enforcer findings](2026-08-19-graph-and-quality-tooling.md#architect-and-hardender-roles-not-magic-binaries) |
| 6 | Measure whether the quality tools improve decisions | **Waiting for Steps 3–5** | Measurement criteria below |
| 7 | Decide whether to start the C# architecture viewer | **In progress — Graphify/Archify comparison pending** | [Tool comparison](2026-09-10-graphify-architecture-quality-follow-up.md#3-archify-compared-with-graphify-uncle-bobs-viewer-roslyn-and-archunitnet) |
| 8 | Decide whether any workflow belongs in the harness | **In progress — provisional decisions recorded** | [Decision matrix](2026-09-10-graphify-architecture-quality-follow-up.md#11-decision-matrix-and-checklist) |

Status meanings:

- **Ready:** the instructions or prerequisites exist, but the work has not been completed.
- **In progress:** an approved experiment or learning session is underway.
- **Complete:** the stated evidence exists and the completion check passed.
- **Waiting:** a prerequisite or explicit approval is missing.

## Step 1 — Learn the graph-engineering model

Start with these sections of the teaching guide:

1. [The three different graphs](2026-08-19-graph-and-quality-tooling.md#the-word-graph-hides-three-different-ideas)
2. [Graph engineering in plain language](2026-08-19-graph-and-quality-tooling.md#graph-engineering-in-plain-language)
3. [The C# order-cancellation example](2026-08-19-graph-and-quality-tooling.md#worked-example-a-small-c-order-cancellation-change)
4. [Failure modes](2026-08-19-graph-and-quality-tooling.md#failure-modes-to-design-for)

The core model is:

```text
scope
  → architecture discovery + risk analysis in parallel
  → plan
  → implementation
  → real test gate
  → independent reviews
  → human decision
```

**Completion recorded 2026-09-10:** the guide was read and the follow-up questions correctly distinguished Graphify's code knowledge graph from graph-engineered execution and an architecture viewer. The remaining questions are answered in the [follow-up guide](2026-09-10-graphify-architecture-quality-follow-up.md).

**Optional refresher request:**

> Teach me Step 1 from `docs/dev/graph-and-quality-adoption-roadmap.md`. Use the C# order-cancellation example, pause for my questions, and check that I understand the three graph types and when graph engineering is worth the cost.

## Step 2 — Select one representative C# repository

Choose a repository that is safe to inspect and representative of the work the harness normally performs. Prefer one that:

- contains a solution with several projects or meaningful namespaces;
- has real tests and can produce coverage;
- has enough dependencies to make architecture analysis useful;
- is small enough that a human can verify Graphify's results;
- contains no customer data or unreviewed secrets in the evaluation copy; and
- has a stable commit that can be recorded for reproducibility.

Record the choice here when made:

- **Repository:** not selected
- **Commit:** not selected
- **Why representative:** not recorded
- **Verification command:** not recorded

**Complete Step 2 when:** the repository, exact commit, verification command, data-safety decision, and reason for choosing it are recorded here.

## Step 3 — Evaluate Graphify safely

The JavaScript harness pilot is complete. It used `graphifyy==0.9.56` in a temporary runtime, code-only extraction, and no installer, hooks, watcher, MCP registration, global graph, or tracked artifacts. It found 273 nodes and 416 edges, reported zero model tokens for extraction, and estimated a 6.0× query reduction. The result was only a qualified pass: Markdown instructions were omitted, 122 symbols were weakly connected, and one 1,000-token query was still broad and truncated. See the [full pilot evidence](2026-09-10-graphify-architecture-quality-follow-up.md#completed-harness-pilot).

The C# evaluation remains pending and still requires a selected repository. Follow the full [safe, non-installing evaluation plan](2026-08-19-graph-and-quality-tooling.md#safe-non-installing-evaluation): review and pin the source first, use an isolated runtime, deny unnecessary network access, and do not install hooks or persistent harness instructions.

Capture the future result in a dated report under `docs/dev/`. The report should include:

- pinned Graphify version and licenses reviewed;
- filesystem and network observations;
- C# extraction accuracy against known examples;
- usefulness of HTML, CLI, and MCP navigation;
- handling of ignored files, generated code, partial classes, and ambiguous edges;
- runtime and artifact size; and
- a clear adopt, reject, or investigate-further decision.

**Complete Step 3 when:** the report also contains five known-answer C# questions, extraction-accuracy checks, and measured source-read/token evidence from the representative repository.

## Step 4 — Evaluate CRAP for C#

Evaluate Microsoft's existing `coverage-analysis` and `crap-score` skills before considering a new tool. Use real Cobertura coverage; never estimate it from source or test names.

Record:

- baseline CRAP distribution;
- the worst changed methods;
- chosen thresholds and why they fit this repository;
- missing or stale coverage behavior; and
- whether the results changed a test or refactoring decision.

**Complete Step 4 when:** a reproducible report shows CRAP calculated from real coverage and states whether the existing skills are sufficient. Do not start `crap4net` unless this evidence demonstrates a missing deterministic JSON/SARIF capability.

## Step 5 — Add project-local architecture tests where useful

Architecture policy belongs to the selected project because that project knows its legitimate dependency direction. Identify a small number of valuable rules—for example, Domain must not depend on Infrastructure—and implement them with ordinary tests, Roslyn, or ArchUnitNET as appropriate.

The harness may later discover and invoke the project's architecture gate, but it should not own the project's layer names or rules.

**Complete Step 5 when:** the project documents its intended dependency direction, executable tests detect at least one deliberate violation, and the normal project verification command runs them.

## Step 6 — Measure whether hardening improves decisions

Run CRAP, mutation testing, and duplication detection on a bounded change or module. Compare their cost with the useful decisions they produced.

Track at least:

| Measure | Question |
|---|---|
| Actionable findings | Did the tool reveal a defect, weak test, risky method, or harmful duplication? |
| False positives | How many findings required investigation but no change? |
| Runtime | Is the check suitable for every change, only before release, or only on request? |
| Decision impact | Did a human change implementation, tests, or architecture because of the evidence? |
| Maintenance cost | What configuration, exclusions, baselines, and upgrades are required? |

**Complete Step 6 when:** the comparison supports keeping, rejecting, or limiting each tool to a specific workflow profile.

## Step 7 — Decide on the architecture-viewer project

First compare Graphify's result with the desired hierarchy:

```text
solution → project → logical module → namespace → type → member → source
```

If Graphify provides accurate, usable drill-down, do not build another tool. If it cannot provide the deliberate hierarchy or compiler-resolved evidence, start a separate project using the [C# Roslyn viewer brief](2026-08-19-graph-and-quality-tooling.md#separate-project-handoff-c-architecture-viewer).

**Complete Step 7 when:** a written decision either accepts Graphify for this need or authorizes a separate viewer project with a defined MVP. The viewer remains a separate deep module; the harness would only call its narrow read-only CLI/MCP interface.

## Step 8 — Decide what belongs in the harness

Do not add graph orchestration or hardening profiles merely because the tools exist. Review evidence from the earlier steps and decide separately for each capability:

- Is it common across projects?
- Does it improve reliability or decisions measurably?
- Is its cost appropriate for the proposed frequency?
- Can the harness expose it through a small interface without owning project policy?
- Is an on-demand skill or external tool simpler than a permanent workflow?

Record durable harness decisions in [`decisions.md`](decisions.md), including rejected options and the evidence that would justify reconsideration.

**Complete Step 8 when:** each proposed integration has an explicit adopt, reject, or defer decision. Until then, the harness remains unchanged.

## Decisions already made

- [x] Learn the three graph types from the teaching guide.
- [x] Reject `geng`; the existing prototype skill already covers prototype work.
- [x] Keep graph engineering optional and user-invoked; begin without loops.
- [x] Accept Graphify for a controlled integration trial.
- [x] Accept `tt-a1i/archify` for a controlled user-invoked skill trial.
- [x] Keep the C# Roslyn viewer deferred until Graphify plus Archify is tested.
- [x] Trial Microsoft's CRAP workflows from real Cobertura evidence before any permanent skill installation.
- [x] Keep architecture rules project-owned rather than universal harness policy.
- [x] Treat ArchUnitNET as conditional; add it only where named C# dependency rules are currently unenforced.
- [x] Record that Stryker.NET is not active in this template; inspect the chosen C# repository separately.
- [x] Treat jscpd as an optional deterministic duplication check, not an LLM tool.
- [x] Keep acceptance tests project-owned and keep human review as the final pre-push decision.
- [x] Keep hardening an optional profile, not a standalone product.
- [x] Treat “video-only claims” as an evidence label, not a tool.

## Decisions still open

- [ ] Graphify refresh control: manual build only, or manual build plus an agent-requested refresh that requires confirmation?
- [ ] Graphify query surface: CLI only first, or also a read-only MCP interface after the CLI trial?
- [ ] Graphify persistence: project-local ignored cache, checked-in graph, or external per-user cache?
- [ ] Archify retention: keep it after the direct-read versus Graphify-fed comparison only if its diagrams improve human understanding enough to justify agent context cost.
- [ ] C# project: choose a representative repository for Graphify, CRAP, Stryker, and architecture-rule evidence.
- [ ] Graph runtime: remain a documented no-loop workflow, or prototype LangGraph.js only after persisted state, pause/resume, or reusable branching becomes necessary?

## Progress update rule

Whenever a step advances:

1. update the status table and current-position line at the top;
2. add links to the evidence or report;
3. record the decision and any unresolved risk;
4. set one concrete next action; and
5. update the `Last updated` date.

This roadmap tracks progress. The dated [research and teaching guide](2026-08-19-graph-and-quality-tooling.md) remains the source for explanations, research findings, and the separate-project brief.
