# Solo Master — Current Development Roadmap

Status: **current plan**
Owner: Manuel Almeida
Created: 2026-07-15
Review cadence: at every milestone exit, or whenever evidence changes a product, security, or architecture decision

## Document authority

This is the current execution roadmap for Solo Master. It supersedes the implementation sequencing and unresolved delivery recommendations in `01-original-research-and-plan.md` and `02-research-refresh-and-proposed-plan.md`; those files remain valuable research and decision history.

The document set now has these roles:

| Document | Role |
|---|---|
| `01-original-research-and-plan.md` | Historical product concept and original seven-stage proposal |
| `02-research-refresh-and-proposed-plan.md` | Learning-product research refresh and improved proposal |
| `03-initial-commit-plan.md` | Completed foundation plan; historical |
| `04-harness-integration-plan.md` | Superseded harness proposal; historical |
| `05-security-checklist.md` | Required review for affected changes |
| `06-harness-review-fixes.md` | Completed harness correction record |
| `07-development-roadmap.md` | Current product and development plan |

The planning method is adapted from `~/dev/ai-harness-template/GUIDE-app-development-planning.md`.

## Executive direction

Build Solo Master as a private, local-first mastery coach for Manuel learning C# and .NET. Validate one claim before broadening the product:

> After learning a small C# topic with Solo Master, Manuel can solve and explain a fresh problem several days later without AI assistance better than with his current notes/tutorial workflow.

The first useful product is therefore not an AI roadmap generator. It is a trustworthy, non-AI learning loop with curated content, explicit aided-versus-unaided evidence, targeted correction, and a delayed fresh check.

The order is:

```text
experiment contract and prototype
  -> one non-AI artifact end to end
  -> loops-and-boundaries pilot with delayed review
  -> deterministic C# evidence
  -> constrained AI tutoring
  -> reviewed authoring/import/roadmap generation
  -> V1 hardening and release
```

Each milestone must earn the next one. If the learning loop is not useful, change or stop it before investing in AI, generalized curriculum, multiple providers, badges, or arbitrary document ingestion.

## Review of the existing plan

### What is strong and retained

- Retrieval before explanation and feedback.
- Mastery based on evidence across explanation, production, diagnosis, refactoring, tradeoffs, and recognition.
- Targeted retries instead of restarting a topic.
- Separation of an artifact (what is learned), an exercise (how evidence is elicited), and an attempt (what the learner did).
- Delayed, fresh, unaided checks rather than treating immediate success as permanent mastery.
- Curated C# seed content before generalized AI curriculum generation.
- Deterministic evidence taking precedence over model judgment.
- Human review before AI-generated content becomes approved curriculum.
- Razor Pages, SQLite, a single deployable application, and no speculative distributed architecture.
- Provider-independent application behavior, with `IChatClient` only at the AI infrastructure boundary when AI arrives.
- A no-AI path and editable content.
- The current deterministic verification gate and security-first harness.

These choices are consistent with current evidence: retrieval practice supports longer-term retention; scaffolded self-explanation is more active than reading worked examples; structured AI tutoring can help; and unrestricted generative-AI help can improve practice performance while harming later unaided performance. The product must therefore measure assistance and protect assessment integrity, not reward AI-assisted completion.

### What needed correction

| Existing issue | Roadmap correction |
|---|---|
| Several documents could be read as the active plan | This file is the single current roadmap; earlier plans are explicitly historical or research inputs |
| The seven concepts were sometimes seven mandatory screens | They are evidence dimensions selected and weighted per artifact; sessions use the smallest useful set |
| `Learned` could imply permanent mastery | Visible state is `New`, `Learning`, `Review due`, or `Mastered`, with dated evidence and freshness |
| Phase 0 and foundation tasks were still listed as future work | The verified .NET foundation is milestone M0 and is complete |
| Broad AI roadmap generation appeared too early | It moves after the learning loop, deterministic evidence, and constrained AI tutor |
| Provider and code-runner choices were open dependencies | Each gets an explicit evaluation/security gate before implementation |
| Roadmap phases mostly listed activities | Every milestone below has a user outcome, evidence, exclusions, dependencies, and exit criteria |
| Security and accessibility were not consistently part of each slice | They are cross-cutting acceptance requirements from the first user journey |
| No baseline or decision rule existed for the product hypothesis | M1 defines the baseline, matched comparison tasks, and go/change/stop rule before the pilot |
| Distant features had similar certainty to near-term work | M1–M3 are detailed; later milestones remain gated and lower confidence |

## Current state

### Complete

- .NET 10 Razor Pages application shell.
- One real-pipeline home-page integration test.
- Locked dependency restore, Release build, warnings-as-errors, analyzers, formatting checks, and deterministic tests.
- `scripts/verify.sh` as the local definition of done.
- CI, CodeQL, dependency updates, vulnerable-package checking, secret scanning, and hardened local harness controls.
- Current code has no database, domain model, learning flow, AI integration, import flow, or code runner.

### Immediate implication

The next change should not scaffold empty layers or install the whole proposed stack. M1 produces the experiment contract and usable flow design. M2 introduces only the domain and persistence needed by the first real learning slice, with package approval before EF Core is added.

## Product contract

### Primary user

Manuel, learning C# and .NET deeply enough to explain, produce, diagnose, refactor, and judge code without depending on AI.

V1 may be understandable to another learner, but multi-user needs, public onboarding, accounts, social features, and a course marketplace are not design constraints.

### Desired outcome

Manuel retains and transfers a small C# skill after a delay, using less assistance over time and without mistaking AI-supported performance for independent mastery.

### Baseline

The current baseline is ordinary notes/tutorial study. M1 must record performance on matched fresh tasks before defining the pilot threshold. With one learner and a small sample, results are directional product evidence, not a general scientific claim.

### Primary measure

Delayed unaided success on a fresh task that requires both:

1. producing or correcting C# code; and
2. explaining the relevant reasoning or boundary.

### Supporting measures

- Transfer success on a new example.
- Highest hint level used.
- Misconception recurrence.
- Correction success after feedback.
- Time to first meaningful attempt.
- Abandonment by exercise type.
- Confidence before feedback and calibration against the result.
- AI/user grade disagreement rate after AI exists.

Lesson completions, messages, XP, badges, and streaks are not primary success measures.

### Load-bearing qualities

1. **Private and local-first:** learning history and imported material stay on the machine by default; disclosure to an AI provider is explicit and minimal.
2. **Trustworthy mastery evidence:** the application distinguishes aided from unaided work, fresh from repeated questions, and deterministic from subjective evaluation; AI cannot grant mastery.

Architecture, scope, and provider choices are judged primarily against these qualities.

### Working product decisions

| Decision | Current choice | Reopen when |
|---|---|---|
| Initial learner | Manuel only | Another real user is invited into a pilot |
| Core experiment | Learning loop before content generation | The non-AI loop is proven unusable without generated breadth |
| Default session promise | A focused session of about 10 minutes | Observed completion/abandonment shows a different natural length |
| Seven mastery ideas | Configurable evidence dimensions, not mandatory screens | Pilot evidence shows a fixed flow produces better retention without unacceptable burden |
| Initial content | Curated loops and boundaries | The practice loop works and broader content is the binding constraint |
| AI | No AI in the first vertical slice | M3 proves tutoring feedback is now the highest-value constraint |
| First provider | Select after a fixture-based evaluation | M5 gate; do not choose by brand or free tier alone |
| Code execution | Not in the first vertical slice | M3 shows code-production evidence is the next constraint and M4 threat model is acceptable |
| Authentication | No accounts for a loopback-only personal app | Any non-loopback or shared deployment is proposed |
| Accessibility target | WCAG 2.2 AA for implemented web journeys | A stronger legal or product requirement applies |

## Scope

### V1 includes

- Single local user.
- One reviewed C# learning path centered on loops and boundaries.
- Learn, Practice, and Mastery Check modes, introduced incrementally.
- Retrieval-first prompts, progressive assistance, correction, and fresh unaided checks.
- Per-dimension aided/unaided evidence and dated mastery health.
- Targeted retries and a due-review queue.
- Deterministic C# evidence, but only after the runner/evaluator security gate.
- One constrained AI provider after fixture evaluation, with manual/no-AI fallback.
- Manual artifact authoring and editing.
- Markdown and pasted-text import after the core loop is proven.
- AI-produced roadmap/artifact drafts that require explicit approval.
- Progress focused on evidence rather than activity.
- Export/backup and deletion for local learner data.

### Explicitly later

- Arbitrary subjects or broad “learn anything” behavior.
- Multiple provider marketplace or simultaneous provider support.
- PDF ingestion, arbitrary web scraping, or large RAG pipelines.
- Public deployment, accounts, teams, social learning, course marketplace, or mobile apps.
- General-purpose IDE or unrestricted code execution.
- Complex gamification, broad badge trees, leaderboards, or advanced analytics.
- Vector database, embeddings, microservices, event bus, CQRS, mediator, or generic repository abstractions.

## Architecture direction

### Shape

Keep one deployable modular monolith. Today that is one Web project. The first real mastery state transitions in M2 earn one small domain boundary; no other layer is pre-created.

Expected shape after M2:

| Path | Responsibility |
|---|---|
| `src/SoloMaster.Domain` | Pure mastery, attempt, evidence, and review-scheduling rules; no web, EF, AI, file, or provider references |
| `src/SoloMaster.Web` | Razor Pages, composition, application use cases, EF Core/SQLite persistence, local configuration, and adapters still too small to extract |
| `tests/SoloMaster.Domain.Tests` | Fast unit tests for domain rules and state transitions |
| `tests/SoloMaster.IntegrationTests` | Real ASP.NET Core pipeline, persistence, page/handler, authorization decision, and answer-leak tests |

Dependency sentence:

> `SoloMaster.Web` may depend on `SoloMaster.Domain`; the domain depends on no project or external technology, and test projects reference only the production project they exercise.

When that dependency rule appears, add a cheap architecture test in the normal suite. Do not add a separate Application or Infrastructure project until two real call sites or a genuine isolation need make the boundary useful.

### Data ownership

The local application owns one SQLite database. Learning content and learner evidence are separate concepts even if they share the database. Initial tables are owned by the learning slice; no cross-module foreign-key or schema scheme is needed before modules exist.

Minimum concepts, refined during M2 rather than generated upfront:

```text
Artifact
  MasteryRequirement
  Exercise

LearningSession
  Attempt
    AssistanceLevel
    EvidenceResult
    Misconception

ReviewSchedule
```

Do not collapse deterministic correctness and subjective rubric evidence into one average score. A mastery decision is made by application-owned rules over qualifying evidence.

### External boundaries

- Persistence: EF Core/SQLite remains in Web initially.
- AI: task-specific application services use one `IChatClient` adapter; raw provider chat does not enter the domain.
- Code evaluation: a separate process boundary, never in the web process; added only after M4.
- Imported content: untrusted data with provenance, size limits, and explicit approval before activation.

### ADR triggers

Write an ADR when introducing the domain project, selecting the persistence model, choosing the code-evaluation isolation approach, selecting the first AI provider, or changing local-only exposure. Every ADR states how the choice is enforced and when it should be reopened.

## Roadmap overview

| Milestone | Outcome | Evidence | Depends on | Confidence |
|---|---|---|---|---|
| M0 — Verified foundation | Safe, reproducible empty application | `scripts/verify.sh` exits zero; real-pipeline smoke test | none | complete |
| M1 — Experiment contract and prototype | The first learning experiment is testable before feature code | Baseline protocol, reviewed artifact/rubric, accessible flow prototype, predeclared decision rule | M0 | high |
| M2 — One-artifact non-AI slice | One artifact can be learned and scheduled end to end without AI | Real journey, persisted aided/unaided evidence, integration/domain tests, security review | M1 and EF package approval | high |
| M3 — Loops-and-boundaries pilot | The product can test delayed retention over a small coherent path | Two or more delayed review cycles, primary/supporting metrics, pilot decision report | M2 | medium |
| M4 — Deterministic C# evidence | Code evidence is evaluated mechanically within an accepted security boundary | Threat model, selected approach, limits/failure tests, no AI correctness authority | M3 gate | medium-low |
| M5 — Constrained AI tutor | AI improves feedback without weakening mastery integrity or privacy | Fixture evaluation, structured-output tests, adversarial cases, safe failure, consented real-provider smoke test | M3; M4 where code feedback needs it | low |
| M6 — Reviewed authoring and roadmap drafting | New source material can become editable draft curriculum safely | Manual authoring, import validation, provenance, approval workflow, branch edits | M3 and M5 | low |
| M7 — V1 hardening and local release | A recoverable, accessible personal product can be used continuously | Install/run, backup/restore/export/delete, accessibility review, recovery checks, full gate | M4–M6 accepted scope | low |

No calendar promise is assigned beyond the next milestone. Estimate M1 and then M2 from decomposed work; reforecast from observed solo throughput. Later milestones depend on product and security evidence and would be false precision today.

## M0 — Verified foundation — complete

### Outcome

A small .NET 10 Razor Pages application can be restored, built, formatted, analyzed, and tested deterministically.

### Exit evidence

- Current `scripts/verify.sh` exits zero.
- The home-page test exercises the real ASP.NET Core pipeline.
- CI and security tooling are configured.
- No empty domain/application/infrastructure projects or speculative product packages exist.

## M1 — Experiment contract and experience prototype — now

### Why now

The highest risk is not whether Razor Pages or SQLite work. It is whether the learning loop is useful and measurable without becoming exhausting or leaking answers into assessment.

### Outcome

One loops-and-boundaries artifact has reviewed learning content, evidence requirements, matched exercises, and a usable flow that can test the product hypothesis.

### In scope

1. Record a small baseline using the current notes/tutorial workflow and fresh loop-boundary tasks.
2. Author one canonical artifact, recommended: `for` loop boundaries and off-by-one errors.
3. Choose required evidence dimensions and explicit rubric criteria for this artifact.
4. Create at least three distinct exercise variants: guided learning, immediate unaided check, and delayed transfer check.
5. Define assistance levels: none, nudge, conceptual hint, worked step, explanation.
6. Define what qualifies as unaided evidence and what invalidates a mastery check.
7. Sketch/prototype the smallest journey: Home -> artifact -> attempt -> help/feedback -> correction -> immediate check -> scheduled review -> progress.
8. Test keyboard order, focus, labels, error presentation, reflow, and answer concealment in the prototype.
9. Choose the pilot's pass/change/stop rule before seeing its results.
10. Draft M2 acceptance examples, data lifecycle notes, and the anonymous/loopback security decision.

### Out of scope

- Production persistence or domain code.
- AI feedback.
- Code execution.
- Full loops curriculum.
- Visual polish beyond proving the flow.

### Exit criteria

- The baseline protocol and result are recorded without pretending one-person evidence generalizes.
- The artifact, rubric, canonical content, misconceptions, and exercise variants are manually reviewed.
- The prototype can complete the journey without requiring AI.
- The delayed task is genuinely fresh and inaccessible during learning.
- The pilot decision rule and minimum observation window are written before M2.
- M2 is decomposed into small vertical slices with acceptance evidence.

### Follow-on decision

Proceed to M2 only if the flow is short enough to use and the delayed outcome can be measured credibly. Otherwise revise the method before adding persistence.

## M2 — One-artifact non-AI vertical slice — next

### Outcome

Manuel can complete one curated artifact, receive fixed/rubric feedback, correct mistakes, pass an immediate fresh check, close the app, and later see the review due—with all evidence persisted accurately.

### Dependency gate

Propose the exact EF Core SQLite production packages and current versions, explain why framework-only storage is insufficient, and wait for Manuel's approval before adding them. Commit lock-file and migration changes intentionally.

### In scope

- Extract `SoloMaster.Domain` with the first pure mastery/evidence rules and add domain tests in the same change.
- Add EF Core/SQLite persistence and the documented migration procedure.
- Seed the single approved artifact as versioned reviewed content.
- Implement a thin Learn flow with retrieval first and fixed progressive hints.
- Record attempt text/code, assistance level, confidence, exercise version, rubric/deterministic result type, correction, and timestamps.
- Implement an immediate fresh check and schedule a delayed review.
- Implement a minimal progress/evidence view.
- Preserve canonical answers and hints server-side; never include them in mastery-check HTML, hidden fields, or client assets.
- Keep modifying handlers antiforgery-protected.
- Bind the personal application to loopback by default and document why pages are anonymous.
- Validate input length and enum/identifier choices; return safe errors.
- Add integration tests through the real pipeline and relational persistence tests using SQLite.
- Add an architecture rule test when the Domain project is introduced.

### Out of scope

- AI, imported content, arbitrary code execution, scheduling optimization, badges, and broad roadmap navigation.

### Exit criteria

- The complete one-artifact journey works after an application restart.
- Domain tests prove invalid transitions cannot grant `Mastered` and aided evidence cannot count as unaided.
- Integration tests prove mastery answers/hints are absent from unaided-check responses.
- Persistence tests use SQLite where relational behavior matters.
- The security checklist records pass/fail/not-applicable for the new input and endpoints.
- Keyboard and narrow-viewport checks pass for the implemented journey.
- A migration can be applied to a fresh database with documented commands.
- `scripts/verify.sh` exits zero.

### Follow-on decision

If one artifact is too burdensome or the evidence model is confusing, change it before multiplying content in M3.

## M3 — Loops-and-boundaries pilot

### Outcome

Solo Master can run a small personal learning experiment across enough related skills to exercise targeted practice, spacing, and transfer.

### In scope

- Expand to a reviewed path of roughly 8–12 artifacts covering loop choice, `while`, `do/while`, `for`, `foreach`, `break`/`continue`, counters, nesting, and off-by-one boundaries.
- Assign required evidence dimensions and prerequisites per artifact; do not require all dimensions uniformly.
- Add Practice and Mastery Check modes.
- Implement a simple transparent scheduler before considering an optimized algorithm.
- Mix due artifacts and target known misconceptions.
- Add dated mastery health and `New`, `Learning`, `Review due`, `Mastered` display states.
- Capture the primary and supporting measures defined above with the minimum private data.
- Run the predeclared personal pilot for at least two delayed review opportunities, including fresh transfer tasks.
- Produce a short result note: evidence, limitations, observed friction, and proceed/change/stop decision.

### Exit criteria

- The app distinguishes immediate assisted performance from delayed independent performance.
- Targeted retries return to the failed dimension/misconception without restarting the whole artifact.
- Fresh assessment items are not exposed during learning.
- The pilot produces the measurements and qualitative observations defined in M1.
- The result note makes an explicit decision about continuing the learning method and identifies the next binding constraint.
- Accessibility and security reviews cover the complete Learn -> Practice -> Mastery Check journey.
- `scripts/verify.sh` exits zero.

### Follow-on decision

Proceed to M4 or M5 only if the loop is worth continuing. Choose the next milestone from evidence: deterministic code checking if correctness is the constraint; AI tutoring if subjective feedback is the constraint. The roadmap's default is M4 first because deterministic evidence must outrank model judgment.

## M4 — Deterministic C# evidence

### Outcome

The app can validate a deliberately constrained class of C# exercises mechanically without pretending AI output is a compiler or exposing the web process to learner code.

### Required spike and gate

Compare at least:

1. exact/structured pre-authored tasks with no execution;
2. compiler APIs in a constrained host;
3. a separate local `dotnet` worker process;
4. stronger OS/container isolation.

Evaluate supported exercise shape, attack surface, dependency cost, macOS/local constraints, timeout/process/memory/output/file/network controls, cleanup, diagnostics, and future public-exposure implications. Any new production package requires prior approval.

### In scope after approval

- Support the smallest useful exercise shape, not arbitrary projects.
- Execute outside the web process in a disposable directory or choose a non-executing deterministic approach.
- Remove application secrets and unnecessary environment variables.
- Enforce timeout, process, output, and file limits; deny network if the chosen platform can enforce it reliably.
- Clean temporary files and child processes after success, failure, and timeout.
- Return safe, useful diagnostics without local paths or internals.
- Keep the runner unavailable from non-loopback/public exposure.
- Add malicious/failure fixture tests and an independent security review before widening scope.

### Exit criteria

- A written threat model and ADR justify the selected approach or decide not to execute code.
- Deterministic checks correctly override conflicting subjective feedback.
- Limits, cleanup, safe errors, and secret scrubbing are verified by tests.
- The security checklist passes; unresolved high-risk findings block the runner.
- `scripts/verify.sh` exits zero.

## M5 — Constrained AI tutor

### Outcome

AI provides useful progressive hints, explanation feedback, and misconception suggestions without exposing assessment answers, silently changing curriculum, leaking private content, or granting mastery.

### Provider decision gate

Create a fixture set before choosing a provider:

- strong, partial, incorrect, and subtly misleading answers;
- copied/canonical-looking answers;
- prompt-injection-like learner text;
- ambiguous and unsupported cases;
- provider timeout, refusal, malformed output, and schema mismatch.

Evaluate candidate local and cloud models on rubric adherence, structured-output reliability, uncertainty behavior, privacy, latency, cost, local hardware burden, and operational simplicity. Choose one adapter only. Store cloud credentials in .NET user secrets and obtain explicit consent before sending learner content off-device.

### In scope

- `Microsoft.Extensions.AI.IChatClient` at the infrastructure edge, subject to production-package approval.
- Task-specific services such as answer feedback or hint generation; no general chat abstraction in the domain.
- Progressive help after an attempt: nudge -> conceptual hint -> worked step -> explanation.
- Schema validation, bounded input/output, cancellation, timeouts, and safe recoverable failures.
- Prompt, rubric, content, model, and provider version metadata for subjective feedback.
- Minimal context from structured learner history; no default transmission of entire private histories.
- Application-owned mastery transition that AI cannot invoke directly.
- A deterministic fake client in the normal test suite; real-provider tests remain opt-in smoke tests.

### Exit criteria

- Predeclared fixture thresholds are met and failures are visible rather than coerced into a grade.
- Adversarial learner text cannot override system constraints or approve curriculum.
- Assessment mode exposes no tutor tools or canonical answers.
- Provider outages leave manual/fixed feedback and learning history usable.
- Logging contains no secrets or full private learner material.
- Security checklist and `scripts/verify.sh` pass.

## M6 — Reviewed authoring, import, and roadmap drafting

### Outcome

Manuel can create and edit curriculum manually, import bounded Markdown or pasted text, receive an AI draft, and explicitly approve only selected content into the learning path.

### Sequence

1. Manual artifact/exercise authoring and versioning.
2. Bounded pasted text.
3. Bounded Markdown file import.
4. Deterministic extraction/storage with source provenance.
5. AI draft generation against approved schemas.
6. Review operations: edit, split, merge, reorder, remove, regenerate one branch, approve/reject.

### Security and content integrity

- Validate size, format, filename, stored name, and destination for files.
- Treat imported text as data, never instructions.
- Encode rendered output; sanitize any justified raw HTML.
- Track source, content version, generation metadata, review status, and approver.
- Generated content remains draft and cannot enter active learning or mastery calculations without explicit approval.
- Do not claim official API behavior when grounding is insufficient.

### Exit criteria

- Manual authoring works without AI.
- Imported content cannot escape storage, execute, override prompts, or become trusted HTML.
- A roadmap branch can be drafted, edited, approved, and traced to source.
- Rejection/regeneration does not mutate already approved content silently.
- Security checklist and `scripts/verify.sh` pass.

## M7 — V1 hardening and local release

### Outcome

Solo Master is a maintainable personal product that can be installed/run, upgraded, backed up, restored, exported, and deleted without losing mastery integrity.

### In scope

- A clear local run/install/update path.
- Database migration and recovery rehearsal.
- Backup, restore, learner-data export, and deletion.
- Safe error and provider/runner degradation behavior.
- WCAG 2.2 AA review of complete V1 journeys, combining automated checks with keyboard and assistive-technology checks.
- Dependency, vulnerability, configuration, and secret review.
- Privacy notes explaining local data, provider disclosure, retention, and deletion.
- Performance checks for realistic personal data volumes.
- Product evidence dashboard limited to measures that support learning decisions.
- Documentation of known limitations and deferred scope.

### Public-exposure gate

V1 is local-only. Any shared or public deployment is a new architectural and security decision requiring authentication/authorization, object ownership, rate/cost controls, stronger runner isolation or removal, deployment/rollback/monitoring plans, and a new threat review.

### Exit criteria

- Fresh install/run and upgrade succeed from documented commands.
- Backup and restore recover verified learning state; deletion removes intended data.
- Complete user journeys meet the accessibility target or have explicit blocking defects.
- No high-risk security finding remains open.
- Product evidence supports a continue/change/stop decision for the next roadmap.
- `scripts/verify.sh` exits zero.

## Starter backlog — M1 and M2 only

Do not turn later milestones into detailed tickets yet.

| Order | Item | Outcome / acceptance evidence |
|---|---|---|
| 1 | M1 product experiment record | Baseline task, primary measure, delayed window, and pass/change/stop rule are written before results |
| 2 | Reviewed artifact content | One loops/boundaries artifact has required dimensions, rubric, canonical content, misconceptions, and three fresh exercise variants |
| 3 | Learning-flow prototype | The smallest journey can be walked end to end; answers remain concealed; keyboard/focus/reflow checks pass |
| 4 | M2 threat/data notes | Anonymous loopback rationale, input limits, stored fields, retention/export/delete intent, and answer-leak threats are explicit |
| 5 | M2 package proposal | Exact EF Core/SQLite packages, versions, lock impact, and alternatives are presented for approval |
| 6 | First domain rule slice | Domain project and tests model assistance-qualified evidence and prevent invalid mastery transitions |
| 7 | Persistence slice | Approved artifact and attempts persist through SQLite and application restart; migration commands are verified |
| 8 | Retrieval-first Learn slice | User attempts before reveal, can request fixed progressive help, correct the answer, and sees recorded assistance |
| 9 | Immediate unaided-check slice | A fresh question is served without hints/answers in the response and qualifying evidence is recorded |
| 10 | Review scheduling/progress slice | Review due date and evidence state persist and render accurately |
| 11 | Journey/security/accessibility completion | Real-pipeline tests, checklist, keyboard/narrow-viewport checks, architecture rule, and safe errors pass |
| 12 | M2 milestone review | Real use, full verification, evidence review, and explicit M3 proceed/change/stop decision |

Each item should be split further only when it becomes the active change. Each code-bearing slice includes its tests and documentation; testing is not a final backlog phase.

## Risk register

| Risk | Consequence | Current control | Next evidence / owner decision |
|---|---|---|---|
| False mastery | Product confidently teaches dependence or shallow recognition | Aided/unaided separation, fresh delayed check, application-owned rules | M1 rubric and pilot decision rule; M2 state tests |
| Session burden | Seven dimensions make practice exhausting | Select dimensions per artifact; ~10-minute target | M1 flow test and M3 abandonment/time data |
| Curated content is wrong or poorly scoped | Learner practices misconceptions | Manual review, versioned content, source provenance | M1 artifact review; M6 approval workflow |
| AI improves answers but harms learning | Short-term performance hides weaker retention | No AI before M3; progressive hints; AI disabled in mastery checks | M5 fixture/pilot comparison |
| AI grades inconsistently | Mastery becomes model-dependent | Deterministic evidence precedence; human/app rules; version metadata | M5 evaluation fixtures and disagreement metric |
| Private learning data leaves device unexpectedly | Loss of trust/privacy | Local default; explicit provider consent; minimal context; no full-content logs | M5 provider/privacy gate |
| Learner code compromises host | Secret theft, process/file/network abuse | No code execution before threat model; separate process; loopback-only | M4 spike and independent review |
| Broad curriculum swamps core experiment | Large app with unproven learning value | Curated single path; authoring/generation after M3/M5 | Roadmap milestone gates |
| One-person pilot is overinterpreted | Weak evidence drives broad claims | Directional language, baseline, predeclared rule, qualitative evidence | M3 result note records limitations |
| Scheduling sophistication becomes a distraction | Algorithm work replaces learning evidence | Start with simple transparent intervals | Reopen only when observed review outcomes expose a scheduling problem |
| Premature architecture slows change | Empty layers and abstractions increase effort | Extract only Domain with first pure rules; no other speculative projects | ADR and architecture test at M2 |
| Local database loss | Mastery history disappears | Ignored local DB, later backup/restore/export | M2 persistence behavior; M7 recovery rehearsal |

## Security, privacy, and accessibility gates

For every changed page/handler, input, import, AI operation, or code evaluation:

1. Complete `docs/05-security-checklist.md` with pass/fail/not-applicable.
2. Decide anonymous versus authorized access explicitly.
3. Validate lengths, counts, formats, identifiers, and state transitions at the boundary.
4. Keep safe errors free of stack traces, local paths, SQL, prompts, and provider internals.
5. Preserve Razor encoding and antiforgery; justify and sanitize any raw HTML.
6. Minimize logs and provider disclosure; never log secrets or full private learning material by default.
7. Add denied/failure/adversarial tests proportional to exposure.
8. Check keyboard interaction, focus, labels/names, errors, contrast, and responsive reflow for the changed journey.

Public exposure is not a small configuration change. It reopens authentication, authorization, abuse/cost controls, data ownership, deployment, and code-runner architecture.

## Verification strategy by milestone

| Layer | Purpose |
|---|---|
| Domain unit tests | Mastery requirements, assistance qualification, evidence combination, state transitions, targeted retry, scheduling rules |
| Integration tests | Real Razor pipeline, handler binding/validation, antiforgery/authorization decisions, SQLite behavior, safe errors, answer non-disclosure |
| Architecture tests | Domain has no forbidden project/technology dependencies after extraction |
| Accessibility checks | Automated smoke checks plus manual keyboard/reflow/assistive checks for full journeys |
| AI evaluation fixtures | Structured-output, rubric, uncertainty, adversarial, and provider-failure behavior; deterministic fake in normal suite |
| Runner security tests | Timeout, cleanup, output/process/file limits, environment scrubbing, network policy, malicious fixtures |
| Browser journey tests | Add after M2 has a stable complete flow; cover Learn -> check -> review/progress at the real UI boundary |
| Product pilot evidence | Delayed unaided/transfer results and qualitative observations; separate from software correctness |

Every code milestone ends with `./scripts/verify.sh`. Provider smoke tests and hostile runner tests that depend on local infrastructure remain explicit opt-in suites and cannot be mislabeled as part of the deterministic green gate.

## Roadmap maintenance

At each milestone exit:

1. Use the product and inspect the promised evidence.
2. Record the result and limits.
3. Close, accept, mitigate, or reorder risks.
4. Supersede any architecture decision that changed.
5. Update this roadmap's current/next status and confidence.
6. Decompose only the newly active milestone.
7. Run the repository verification gate for any code/documentation changes that affect it.
8. Make an explicit proceed/change/stop decision.

New ideas go into the relevant later milestone or an “explicitly later” list; they do not interrupt the active milestone unless they address a higher safety risk or invalidate its outcome.

## Research basis

The development-planning structure follows the reusable harness guide and is grounded in:

- [GOV.UK discovery guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works): problem/user/constraint discovery, success measures, and proceed/stop decisions.
- [GOV.UK alpha guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works): prototype the riskiest assumptions before production-scale work.
- [GOV.UK roadmap guidance](https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap): measurable objectives, adaptability, and separation from the backlog.
- [Scrum Guide](https://scrumguides.org/scrum-guide.html): usable verified increments, an emergent ordered backlog, review, adaptation, and a definition of done.
- [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html) and [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html): lifecycle requirements and product-quality completeness.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), and [WCAG 2.2](https://www.w3.org/TR/WCAG22/): integrated secure development, testable web-security requirements, and accessibility criteria.
- [DORA delivery metrics](https://dora.dev/guides/dora-metrics/): small batches and balanced throughput/instability evidence.

The product sequence also retains the learning evidence reviewed in `02-research-refresh-and-proposed-plan.md`, including:

- [Retrieval-practice review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10229024/).
- [Randomized study of scaffolded self-explanation for code examples](https://doi.org/10.1145/3605098.3636007).
- [Structured AI tutoring randomized trial](https://www.nature.com/articles/s41598-025-97652-6).
- [Field experiment showing harm from generative AI without learning safeguards](https://doi.org/10.1073/pnas.2422633122).

These studies support the direction; they do not prove Solo Master works. M1–M3 are designed to test that product-specific claim.
