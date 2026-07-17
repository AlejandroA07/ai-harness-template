# Guide — Evidence-led application development planning

Status: reusable guide; adapt to the project's size, risk, and evidence
Research reviewed: 2026-07-15

## Purpose

Use this guide to turn an application idea into a development plan that is clear enough to execute and flexible enough to change when evidence changes.

This is not a prescribed process framework. It combines the most useful parts of product discovery, iterative delivery, requirements engineering, secure development, quality planning, and operations. A solo prototype should use a few short files; a public or regulated system should keep the same logic with more evidence and independent review.

The core loop is:

```text
frame the outcome
  -> expose assumptions and constraints
  -> test the highest risk cheaply
  -> plan the smallest usable increment
  -> build and verify it
  -> observe real use
  -> adapt or stop
```

Discovery, design, delivery, and operation overlap. The phases below are decision horizons, not a waterfall.

## The planning standard

A credible development plan answers eight questions:

1. **Why:** What problem is worth solving, for whom, and why now?
2. **Evidence:** What observable result would show that the problem is being solved?
3. **Scope:** What is the smallest coherent outcome, and what is explicitly excluded?
4. **Risk:** Which assumptions could invalidate the product, design, security, or delivery approach?
5. **Shape:** What user journey and technical boundaries support the outcome with the least irreversible complexity?
6. **Sequence:** What order produces learning and usable value earliest?
7. **Quality:** What must be true for each increment to be safe, accessible, operable, and done?
8. **Adaptation:** Who reviews evidence, when is the plan updated, and what can cause a stop or pivot?

If one of these answers is missing, record it as an open decision or risk. Do not disguise uncertainty as a feature list or precise date.

## Principles

### Plan outcomes, not output

A feature is a proposed intervention. The roadmap should describe the user or business outcome, its evidence, and the current best intervention. This keeps the team free to replace a feature that proves ineffective.

### Separate horizons

Keep three connected but distinct levels:

| Horizon | Question | Detail | Typical artifact |
|---|---|---|---|
| Product | Where are we going and why? | Stable outcome, flexible solution | Product brief and outcome roadmap |
| Milestone | What result will we prove next? | Ordered, evidence-based, dependency-aware | Milestone card |
| Delivery | What will we implement now? | Small, testable, actionable | Ordered backlog or iteration plan |

A roadmap is not a backlog. The roadmap communicates direction, priority, and evidence; the backlog decomposes the nearest milestone into work.

### Sequence by risk and learning

Build the item that most cheaply answers the most consequential unknown—not necessarily the most visible feature. Test product demand, usability, technical feasibility, security, and operational constraints before investing heavily in dependent work.

### Deliver vertical slices

A slice should cross the minimum necessary UI, behavior, data, and verification to produce an observable outcome. Avoid completing all database work, then all APIs, then all UI: that delays integration evidence and creates large batches.

### Make quality part of scope

Security, privacy, accessibility, testability, data lifecycle, observability, and recovery are product requirements. Each relevant slice includes them in its acceptance criteria and definition of done.

### Prefer reversible decisions

Delay expensive-to-reverse choices until the evidence exists, but do not postpone decisions that block learning. Record architecturally significant choices with context, alternatives, consequences, and a condition that would reopen the decision.

### Maintain one current plan

Historical research can remain for provenance, but label it clearly. Name one file or system as the current roadmap; otherwise multiple plausible plans become contradictory instructions.

## Choose the planning depth

Use the lightest process that still controls the real risk.

| Context | Minimum useful planning | Add when needed |
|---|---|---|
| Disposable experiment | One-page brief, hypothesis card, prototype, result note | Threat notes if it touches data, networks, files, or code execution |
| Solo/local application | Brief, current roadmap, milestone exits, quality gate, decision log | Data model, backup/restore, privacy model, architecture tests when boundaries appear |
| Team/public service | User research, outcome roadmap, release strategy, threat model, accessibility target, operational readiness | Service objectives, incident process, dependency and supply-chain controls |
| Regulated/high-impact system | Traceable requirements, formal risk ownership, evidence plan, independent reviews | Domain-specific assurance, audit records, safety or compliance cases |

The amount of ceremony scales; the reasoning model does not.

## Phase 1 — Frame the product

### Goal

Turn the proposed solution into a problem, user, outcome, and boundary.

### Work

- Identify the primary user and the job or outcome they are trying to achieve.
- Describe the current behavior or workaround and its cost or failure.
- State the product hypothesis in a falsifiable form.
- Define a baseline and one primary outcome measure.
- Choose two load-bearing product qualities that will judge structural decisions.
- List explicit non-goals and constraints.
- Identify stakeholders, decision owner, and affected data or people.

### Product brief template

```markdown
# Product brief

Owner:
Status / last reviewed:

## Problem
For [primary user], [current situation] causes [observable harm or limitation].

## Desired outcome
The user can [outcome], demonstrated by [measure/evidence].

## Product hypothesis
If we [intervention], then [user] will [observable change] because [reason].

## Baseline
Today, [measure or qualitative evidence].

## Load-bearing qualities
1. [quality and why]
2. [quality and why]

## In scope
- ...

## Not in scope
- ...

## Constraints
- legal, policy, budget, schedule, platform, skills, data, integration

## Stop or pivot signals
- ...
```

### Exit evidence

- The problem is stated without naming a mandatory solution.
- The primary user and success evidence are unambiguous.
- The project can stop if the hypothesis is not supported.
- Scope and non-scope fit the available capacity.

## Phase 2 — Discover needs, constraints, and risks

### Goal

Learn enough to decide whether to proceed and what must be tested first.

### Work

- Observe or interview representative users; for a personal tool, document the current workflow and pain with concrete examples.
- Map the end-to-end journey, including offline steps, failure paths, and support.
- Review existing alternatives and why they do not already solve the problem.
- Identify accessibility needs, data sensitivity, privacy expectations, abuse cases, and threat actors.
- Inventory hard constraints and soft assumptions.
- Identify integration, deployment, dependency, and operational constraints.
- Define how product and guardrail metrics will be collected without excessive data.
- Rank assumptions by impact and uncertainty.

### Assumption and risk register

Use one list for product, usability, technical, security, compliance, content, and delivery risk.

| ID | Assumption or risk | Type | Impact | Uncertainty / likelihood | Cheapest test | Owner | Decision date | Status |
|---|---|---|---|---|---|---|---|---|
| R-01 | ... | product | high | high | ... | ... | ... | open |

Prioritize high-impact, high-uncertainty items. A risk entry without a test, mitigation, acceptance decision, or owner is only a worry.

### Exit evidence

- There is evidence of a real need or a documented personal need.
- The baseline and major constraints are understood.
- The highest risks have cheap tests.
- Continuing is more valuable than stopping or using an existing solution.

## Phase 3 — Shape and de-risk the solution

### Goal

Test candidate solutions before committing to production-scale implementation.

### Work

- Sketch the smallest end-to-end user journey.
- Prototype interaction uncertainty at the lowest useful fidelity.
- Use technical spikes only for a named feasibility question; timebox them and record the answer.
- Threat-model new trust boundaries, sensitive data, imports, uploads, external calls, and code execution.
- Choose the simplest architecture consistent with the two load-bearing qualities.
- Draw the dependency direction and data ownership in one small diagram or table.
- Record significant decisions and their reopening conditions.
- Throw away prototype code unless it meets the production quality bar and reuse is an explicit decision.

### Hypothesis card

```markdown
## Hypothesis H-01 — [name]

We believe:
The consequence if false is:
Evidence currently supporting it:
Test:
Pass / fail threshold chosen before the test:
Time or cost limit:
Result:
Decision: proceed / change / stop
```

### Architecture decision record

```markdown
# ADR-NNN — [decision]

Status / date:
Context:
Decision drivers:
Options considered:
Decision:
Positive and negative consequences:
How the rule is enforced:
Reopen when:
```

### Exit evidence

- The most dangerous assumptions have evidence, not optimism.
- The chosen user flow is usable enough to build.
- Architecture and data ownership are understandable in a few sentences.
- Security and privacy constraints influence the design.
- The first production increment is small and coherent.

## Phase 4 — Build the outcome roadmap

### Goal

Sequence milestones that produce usable value or decisive evidence.

### Roadmap rules

- Give each milestone one outcome and one primary evidence set.
- Put dependencies and decision gates before the work they govern.
- Keep near-term detail high and distant detail low.
- Use ranges or relative size until historical throughput supports forecasts.
- Include research, migration, security, accessibility, operations, and retirement work where relevant.
- Mark completed, current, next, later, and explicitly deferred work.
- State who maintains the roadmap and when it is reviewed.

### Outcome roadmap template

| Milestone | Outcome | User evidence | Scope | Key risks retired | Dependencies / gates | Exit criteria | Confidence |
|---|---|---|---|---|---|---|---|
| M1 | ... | ... | ... | ... | ... | ... | high/medium/low |

### Milestone card

```markdown
## M1 — [outcome]

Why now:
Primary user result:
Evidence and decision rule:
In scope:
Out of scope:
Dependencies and approvals:
Security/privacy/accessibility implications:
Verification strategy:
Exit criteria:
Follow-on decision:
```

### Estimate honestly

Estimate the nearest milestone from decomposed work and current capacity. Use a range with an explicit confidence level and list the dominant unknowns. Reforecast after each increment. Do not add false precision to later milestones whose scope depends on earlier evidence.

## Phase 5 — Prepare the first delivery slice

### Goal

Turn only the next milestone into implementable work.

### Slice readiness checklist

A slice is ready when:

- it names the user outcome and parent milestone;
- acceptance examples cover success, boundary, and failure behavior;
- authorization or the reason for anonymous access is explicit;
- inputs, outputs, data changes, retention, and error behavior are known;
- security, privacy, and accessibility requirements are included;
- external dependencies and approvals are resolved;
- the verification approach is feasible and deterministic where possible;
- it is small enough to finish, integrate, and review as one coherent change.

Avoid treating “Definition of Ready” as a gate that requires complete certainty. Its purpose is to prevent avoidable ambiguity, not block learning.

### Acceptance example template

```gherkin
Given [relevant state]
When [user or system action]
Then [observable result]
And [important security, data, or error property]
```

### Backlog ordering

Order the nearest work by:

1. safety or compliance prerequisite;
2. experiment needed to validate the milestone;
3. thin end-to-end path;
4. failure and boundary behavior;
5. usability and accessibility completion;
6. hardening and operational readiness;
7. optional enhancements.

Do not create detailed tickets for speculative later phases. Keep those as milestone scope until they become next.

## Phase 6 — Deliver verified increments

### Goal

Produce small, usable changes and learn from each one.

For every slice:

1. Restate the outcome, acceptance evidence, and relevant risks.
2. Implement the smallest coherent vertical path.
3. Add meaningful automated tests and boundary checks with the behavior.
4. Exercise the real user journey, not only isolated units.
5. Run the repository's deterministic verification gate.
6. Review security, privacy, accessibility, data migration, and operations proportional to the change.
7. Demonstrate or use the increment and record what was learned.
8. Update risks, decisions, roadmap confidence, and next work.

### Project definition of done

Adapt this baseline:

- Acceptance examples pass through the appropriate real boundary.
- Automated tests cover meaningful behavior and important failures.
- Static analysis, formatting, build, tests, and security checks pass.
- Authorization, input validation, safe errors, and data exposure were reviewed.
- Accessibility was checked for changed journeys.
- Data migration, rollback/recovery, and compatibility were handled where relevant.
- Logging and metrics reveal failure without exposing secrets or private data.
- Documentation and decisions reflect changed behavior or architecture.
- No unrelated changes, secrets, generated outputs, or local data are included.
- The increment is usable, or explicitly an evidence-producing spike that will be removed or promoted.

The repository's verification script is the mechanical judge. “Done” also requires the promised product evidence; a green build alone does not prove usefulness.

## Phase 7 — Release, operate, and evolve

### Goal

Make the product safe to use and cheap to change.

Before a release:

- confirm scope and known limitations;
- test install/deploy, configuration, migration, rollback, backup, restore, and deletion where applicable;
- verify secure defaults, dependency state, and secret handling;
- complete accessibility checks against the selected target;
- define user-visible support and failure recovery;
- define service indicators/objectives if availability matters;
- capture product metrics and guardrail metrics with minimal data;
- rehearse the highest-impact failure or recovery path;
- document how to retire or export user data.

After release:

- combine usage data with qualitative research;
- inspect product outcome and delivery health, not activity alone;
- prioritize defects, security work, support, and learning alongside features;
- review incidents without blame and convert recurring failures into tests, automation, or clearer boundaries;
- update or stop the roadmap when the evidence changes.

Useful delivery-health signals include change lead time, deployment/release frequency, recovery time, change failure rate, and unplanned deployment rework. Use them to find constraints, not to rank individuals.

## Cross-cutting plans

Every project should answer these topics at the depth its risk requires.

### Requirements and traceability

- Give important requirements stable identifiers when traceability matters.
- Link outcome -> milestone -> slice -> acceptance evidence -> test/metric.
- Keep functional behavior separate from quality constraints.
- Version external standards referenced by requirement IDs.

### Security and privacy

- Identify trust boundaries and attacker-controlled inputs early.
- Choose secure defaults and least privilege.
- Define authentication, authorization, validation, retention, deletion, logging, and incident behavior.
- Maintain threat tests and security verification requirements with the affected slice.
- Integrate a secure-development checklist into every lifecycle rather than relying on the process framework to supply one.

### Accessibility and inclusive design

- Include disabled users and assistive technology needs in discovery.
- Select a conformance target; WCAG 2.2 AA is a common web baseline unless stronger requirements apply.
- Write testable acceptance criteria for keyboard use, focus, names/roles, error identification, contrast, zoom/reflow, and motion where relevant.
- Combine automated checks with keyboard, screen-reader, and user testing; automation cannot prove conformance alone.

### Quality attributes

Use a quality model as a completeness prompt, then select what is load-bearing for the product. Consider functional suitability, performance efficiency, compatibility, interaction capability/usability, reliability, security, maintainability, flexibility, and safety. Turn selected qualities into measurable scenarios rather than adjectives such as “fast” or “scalable.”

```text
When [stimulus] occurs under [condition],
the system shall [response],
measured by [threshold].
```

### Data lifecycle

Plan creation, classification, validation, storage, access, retention, export, backup, restoration, deletion, and migration. State the system of record and owner for each important data set.

### Dependencies and supply chain

Prefer existing platform capabilities, justify new production dependencies, lock versions, scan vulnerabilities, protect build/release systems, and define an update owner. A dependency saves implementation work but adds a continuing trust and maintenance obligation.

### Operations and observability

Define what the user experiences when dependencies, storage, networks, or background work fail. Logs, metrics, traces, alerts, and runbooks should answer a decision; avoid collecting sensitive data “just in case.”

## Planning cadence and ownership

For a solo project:

- **At the start of a slice:** confirm the outcome, risks, acceptance evidence, and scope.
- **At the end of a slice:** use the result, run the full gate, and update the roadmap.
- **Weekly or at each milestone:** review product evidence, risk register, dependencies, and plan confidence.
- **At a significant decision:** write or supersede an ADR.
- **After an incident or repeated failure:** add a test, tool rule, checklist item, or concise project instruction at the lowest effective layer.

For a team, assign one accountable product owner for roadmap decisions and named owners for risks and operations. Review with the people who build, secure, support, and use the product.

## Plan review checklist

### Product

- Is there one primary user, problem, product goal, and outcome measure?
- Is the baseline known?
- Are non-goals and stop conditions explicit?
- Does the first milestone test the core hypothesis?

### Roadmap

- Does every milestone produce user value or decisive evidence?
- Are dependencies, approvals, and risky assumptions sequenced first?
- Are roadmap outcomes distinct from backlog tasks?
- Is distant work less detailed and lower confidence?
- Is there exactly one current roadmap?

### Architecture and data

- Are the two load-bearing qualities stated?
- Is the simplest viable shape chosen?
- Can dependency direction and data ownership be stated simply?
- Do boundaries protect real changes rather than hypothetical ones?
- Are significant decisions recorded and enforceable?

### Quality and delivery

- Are security, privacy, accessibility, reliability, and recovery included where relevant?
- Is there one deterministic verification command?
- Does each change have meaningful tests and a real-journey check?
- Can the product release in small, reversible batches?
- Will operation produce enough evidence to improve the plan?

## Common failure modes

- **Solution-first planning:** a preferred technology or feature replaces a validated problem.
- **Feature-roadmap certainty:** distant output is scheduled precisely despite unresolved earlier risks.
- **Horizontal phases:** layers are built separately and integrate late.
- **Architecture for imagined scale:** boundaries and services precede evidence of the change they protect.
- **Security/accessibility hardening phase:** cross-cutting requirements are deferred until rework is expensive.
- **Prototype becomes production silently:** evidence code bypasses the production quality bar.
- **Activity metrics:** story points, commits, messages, streaks, or screen count stand in for outcomes.
- **Backlog as archive:** every idea becomes a ticket, making priority invisible.
- **Green-build fallacy:** technical verification is mistaken for product success.
- **Plan accumulation:** old proposals remain unlabeled and compete with the current roadmap.

## Research basis

This guide synthesizes, rather than copies, the following sources:

- The [GOV.UK discovery guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works) grounds problem framing, user/context research, constraints, success measures, and an explicit stop/proceed decision.
- The [GOV.UK alpha guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works) grounds risk-first prototyping and testing the minimum needed to choose a solution.
- The [GOV.UK roadmap guidance](https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap) distinguishes an adaptable outcome roadmap from a delivery backlog and asks each iteration to have a measurable objective.
- The [Agile Manifesto principles](https://agilemanifesto.org/principles) ground frequent working increments, technical excellence, simplicity, and adaptation.
- The official [Scrum Guide](https://scrumguides.org/scrum-guide.html) grounds transparent goals, an emergent ordered backlog, usable increments, review, adaptation, and a shared definition of done. Scrum adoption is not required to use those ideas.
- [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html), confirmed current in 2024 and marked for future revision, grounds lifecycle requirements engineering and required information quality.
- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) grounds the product-quality completeness check used above.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) grounds integrating secure-development practices into whichever lifecycle model a project uses.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) grounds testable web-application security requirements and versioned verification references.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) grounds testable, technology-independent web accessibility criteria.
- [DORA's software delivery performance guidance](https://dora.dev/guides/dora-metrics/) grounds small batches and balanced throughput/instability measures.
- The [Google SRE guidance on SLOs](https://sre.google/workbook/implementing-slos/) grounds using user-centered reliability targets to prioritize engineering work.
- The [GDS ADR guidance](https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html) grounds concise, supersedable records for architecturally significant choices.

Standards and frameworks do not replace judgment. Recheck current versions and legal or regulatory obligations when applying this guide to a real project.
