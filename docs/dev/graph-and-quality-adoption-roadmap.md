# Graph and quality tooling adoption roadmap

- **Kind:** living progress tracker
- **Last updated:** 2026-08-31
- **Current position:** Step 1 material is ready; the guided learning walkthrough is still pending. Step 2 has not started because no representative C# repository has been selected.
- **Next action:** work through Step 1 with the [research and teaching guide](2026-08-19-graph-and-quality-tooling.md#the-word-graph-hides-three-different-ideas), then record the C# repository selected for Step 2.

This file is the durable checklist for the graph-engineering, Graphify, architecture-viewer, CRAP, and hardening work. Update it after every completed step so progress does not depend on remembering a conversation.

## Status at a glance

| Step | Outcome | Status | Existing artifact or evidence |
|---|---|---|---|
| 1 | Learn the graph-engineering model | **Ready — walkthrough pending** | [Research and teaching guide](2026-08-19-graph-and-quality-tooling.md) |
| 2 | Select one representative C# repository | **Not started** | No repository selected |
| 3 | Run an isolated Graphify evaluation | **Waiting for Step 2 and separate approval** | [Evaluation procedure](2026-08-19-graph-and-quality-tooling.md#safe-non-installing-evaluation) |
| 4 | Evaluate Microsoft's CRAP skills | **Waiting for Steps 2–3** | [CRAP findings](2026-08-19-graph-and-quality-tooling.md#crap-a-metric-not-an-ai-reviewer) |
| 5 | Add project-local architecture tests where useful | **Waiting for Step 2** | [Architecture-enforcer findings](2026-08-19-graph-and-quality-tooling.md#architect-and-hardender-roles-not-magic-binaries) |
| 6 | Measure whether the quality tools improve decisions | **Waiting for Steps 3–5** | Measurement criteria below |
| 7 | Decide whether to start the C# architecture viewer | **Waiting for Graphify evidence** | [Separate-project Roslyn brief](2026-08-19-graph-and-quality-tooling.md#separate-project-handoff-c-architecture-viewer) |
| 8 | Decide whether any workflow belongs in the harness | **Waiting for all earlier evidence** | No harness change approved |

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

**Complete Step 1 when:** you can distinguish a workflow graph, a code knowledge graph, and an architecture graph; explain why real commands are stronger gates than model confidence; and identify when one agent loop is cheaper than a graph.

**Suggested next-chat request:**

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

This requires a separate explicit approval because it involves obtaining and running external software. Follow the full [safe, non-installing evaluation plan](2026-08-19-graph-and-quality-tooling.md#safe-non-installing-evaluation): review and pin the source first, use an isolated prototype, deny unnecessary network access, test a synthetic fixture before the representative repository, and do not install hooks or persistent harness instructions.

Capture the future result in a dated report under `docs/dev/`. The report should include:

- pinned Graphify version and licenses reviewed;
- filesystem and network observations;
- C# extraction accuracy against known examples;
- usefulness of HTML, CLI, and MCP navigation;
- handling of ignored files, generated code, partial classes, and ambiguous edges;
- runtime and artifact size; and
- a clear adopt, reject, or investigate-further decision.

**Complete Step 3 when:** the isolated evaluation report exists and contains evidence from both the controlled fixture and the selected representative repository.

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

## Progress update rule

Whenever a step advances:

1. update the status table and current-position line at the top;
2. add links to the evidence or report;
3. record the decision and any unresolved risk;
4. set one concrete next action; and
5. update the `Last updated` date.

This roadmap tracks progress. The dated [research and teaching guide](2026-08-19-graph-and-quality-tooling.md) remains the source for explanations, research findings, and the separate-project brief.
