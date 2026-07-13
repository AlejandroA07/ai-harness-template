# Learning App — 2026 Research Refresh and Proposed Plan

Status: **proposal for discussion, not an implementation specification**  
Research date: 2026-07-10

This document compares the existing `learning-app-research-and-plan.md` concept with current learning products, recent learning research, the current .NET stack, and the `ai-harness-template`. It deliberately leaves a few product decisions open so they can be settled before code is scaffolded.

## Executive recommendation

Keep the central idea: a learner should produce evidence of understanding before the app reveals or evaluates an answer. That is much more defensible than building another AI chat wrapper.

Change the first version in five ways:

1. Treat the seven artifact sections as **mastery dimensions**, not seven mandatory screens in every session.
2. Make the daily loop short: **attempt → targeted feedback → correction → unaided check → schedule**.
3. Separate tutoring from assessment. During an assessment, AI hints and canonical answers are unavailable.
4. Narrow V1 to one excellent C# learning path and manually authored seed artifacts; add broad AI curriculum generation only after the learning loop works.
5. Measure delayed, unaided retention and transfer—not lesson completion, chat activity, or streak length.

The strongest positioning is:

> A personal mastery coach for developers that makes you explain, write, critique, and improve code before it helps you—and brings weaknesses back until you can perform unaided.

## What is popular now

Current learning products converge on a recognizable set of features:

| Product pattern | Examples | What it gets right | Limitation/opportunity for this app |
|---|---|---|---|
| Bite-sized guided lessons | Mimo, Sololearn, Codecademy | Low activation energy and clear next action | Can reward recognition and tapping more than independent ability |
| Immediate AI feedback | Codecademy, Scrimba, Khanmigo | Help arrives at the moment of confusion | Unguarded help can improve task performance without producing durable learning |
| Personalized practice and spaced review | Boot.dev, Codecademy | Returns to weak topics and reduces planning burden | Often optimizes question success rather than broad engineering judgment |
| Interactive problem solving | Brilliant, Exercism | Learners do something instead of only watching | Most products assess a correct result more easily than explanation, critique, and tradeoffs |
| Projects and authentic code | Microsoft Learn, Exercism, Codecademy | Connects small skills to working software | Feedback is often about passing tests, not why a design is good or bad |
| Streaks, XP, badges, quests | Mimo, Sololearn, Boot.dev | Builds habit and makes progress visible | Activity can be mistaken for mastery |

Representative current product evidence:

- Codecademy combines AI assistance, coding practice, review recommendations, and identification of topics needing more review: <https://www.codecademy.com/learn/learn-how-to-code>
- Boot.dev's Training Grounds uses learner history, spaced repetition, generated challenges, bug fixing, interview practice, XP, streaks, and quests: <https://www.boot.dev/training>
- Brilliant describes single-concept lessons, active learning, guided problem solving, and misconception diagnosis: <https://brilliant.org/about/>
- Exercism combines learning exercises, practice exercises, tests, and mentoring, including a C# track: <https://exercism.org/docs/using/faqs>
- Microsoft Learn organizes C# into paths, modules, exercises, challenges, assessments, and achievements: <https://learn.microsoft.com/en-us/training/paths/get-started-c-sharp-part-1/>
- Khanmigo uses step-by-step scaffolding and avoids immediately giving away answers: <https://2023-2024.annualreport.khanacademy.org/khanmigo>

The opportunity is not to out-content these products. It is to combine their short, guided practice with a stronger definition of mastery: explanation, production, debugging, refactoring, tradeoffs, recognition, and delayed transfer.

## What current evidence changes

### Structured AI tutoring can work

A 2025 randomized controlled trial with 194 undergraduate physics students found substantially greater learning gains in less time with a carefully designed AI tutor than with an active-learning class. The important qualifier is that the tutor used expert-crafted prompts, scaffolding, controlled content, and pedagogical design; this is evidence for a structured tutor, not a generic chat box. Source: <https://www.nature.com/articles/s41598-025-97652-6>

In programming education, a 2024 randomized study compared passive worked-example reading with scaffolded self-explanation of code examples. This supports the existing emphasis on explaining code rather than merely reading it. Source: <https://doi.org/10.1145/3605098.3636007>

### Help can improve performance while harming learning

A large field experiment in high-school mathematics found that unrestricted GPT-4 access improved practice performance but reduced later unaided performance; tutoring safeguards largely mitigated that harm. Source: <https://papers.ssrn.com/sol3/Delivery.cfm/4895486.pdf?abstractid=4895486&mirid=1>

A 2025 Nature Reviews Psychology article similarly warns that generative AI performance gains do not necessarily reflect the deeper cognitive processing required for learning. Source: <https://www.nature.com/articles/s44159-025-00467-5>

Product implication: the app must track what the learner can do **without AI**, and AI should provide progressive hints rather than answers by default.

### Learner history is useful tutor context

Khan Academy reported in 2026 that structured signals from recent attempts, demonstrated skill, and prerequisite progress improved next-item correctness in large product tests. This is company-reported product evidence rather than an independent trial, but it supports passing concise learning-state data—not an entire chat history—to the tutor. Source: <https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/>

Product implication: attempt history, misconception tags, hint usage, and stage performance should be first-class data.

## Comparison with the existing plan

### Keep

- Retrieval before explanation.
- Focused artifacts/micro-skills inside a roadmap hierarchy.
- Explicit counterexamples, refactoring, recognition, and tradeoffs.
- Targeted retries instead of restarting a whole topic.
- Human-editable AI drafts and user override of AI grading.
- Markdown/pasted-text input and no-AI fallback.
- Razor Pages, SQLite, and a single-user local-first V1.
- Provider-independent application code.

### Modify

| Existing decision | Proposed change | Reason |
|---|---|---|
| Every artifact is a seven-stage session | Store seven mastery dimensions, but select 2–4 appropriate activities per session | Seven consecutive screens will make even small concepts exhausting |
| All seven stages must pass once | Require evidence across dimensions plus a delayed unaided check | Immediate success is not durable mastery |
| `Learned` is a durable state | Use `Mastering`, `ReviewDue`, and `Mastered`, with mastery health/date | Knowledge decays; state should communicate freshness |
| User confirms every AI grade | Require confirmation for subjective, low-confidence, or disputed grades; deterministic checks auto-record | Confirmation on every answer adds friction without improving all results |
| Badges say “You Know C#” | Use “C# Fundamentals — Mastered” with date and review health | Avoids overclaiming broad expertise from a finite checklist |
| Browser code execution postponed | Include deterministic C# verification early, even if the editor remains simple | A coding tutor should compile/test code instead of asking an LLM to guess correctness |
| Multiple local/cloud providers in V1 | Use the standard `IChatClient` abstraction, but ship one adapter first | Preserves portability without multiplying setup and test work |
| AI generates broad roadmaps first | Seed one curated C# path and validate the practice loop first | Curriculum generation is impressive but not the highest-risk assumption |

### Defer

- General-purpose learning across arbitrary subjects.
- Multiple AI provider UIs and provider marketplaces.
- Large-scale document ingestion or RAG.
- Complex badge trees and broad gamification.
- Social features, accounts, mobile apps, and public courses.
- Advanced analytics beyond the small set needed to validate learning.

## Proposed learning model

### Seven evidence dimensions

Retain the existing seven ideas as the rubric for what mastery can mean:

1. Explain the concept.
2. Explain the problem it solves.
3. Produce or complete an example.
4. Diagnose a counterexample.
5. Refactor weak code.
6. Discuss tradeoffs and alternatives.
7. Recognize it in realistic code.

Not every micro-skill needs equal weight in every dimension. A curriculum author assigns required dimensions and acceptance criteria. For example, `Console.WriteLine` may need only explanation, example, misuse recognition, and limitations; dependency inversion should require all seven.

### Three session modes

**Learn**

1. Give a small prompt and ask for an attempt.
2. Offer progressive help: nudge → conceptual hint → worked step → explanation.
3. Ask the learner to correct or improve the answer.
4. End with a different, unaided check.

**Practice**

- Mix due artifacts and target known misconceptions.
- Include code tracing, completion, debugging, refactoring, and explanation.
- Prefer short sessions of roughly 5–15 minutes.
- Interleave related skills once the learner has basic familiarity.

**Mastery check**

- Disable tutor help and canonical content.
- Use a fresh question, not the practiced example.
- Include at least one production task and one judgment/recognition task.
- Record confidence before feedback to reveal overconfidence and underconfidence.
- Schedule a delayed check before granting `Mastered`.

### Progress model

Suggested visible states:

- `New`
- `Learning`
- `Review due`
- `Mastered`

Internally retain:

- per-dimension evidence and rubric result;
- unaided vs aided attempt;
- hints used and highest hint level;
- misconception tags;
- confidence rating;
- question/exercise version;
- model/provider and prompt version for AI evaluations;
- next review date and scheduling history;
- mastery date and last successful delayed check.

Do not collapse the internal model to one average score. Deterministic results (compilation, tests, expected output) and subjective results (explanation quality, tradeoffs) should remain separate.

## Proposed V1 product scope

### Core vertical slice

The first usable slice should teach one small C# cluster—suggested: loops and boundaries—and include:

- a curated roadmap with 8–12 artifacts;
- an artifact overview with prerequisites and mastery evidence;
- Learn, Practice, and Mastery Check modes;
- retrieval-first prompts and progressive hints;
- tiny C# examples that compile and run against deterministic checks;
- rubric-based AI feedback for explanations and critiques;
- targeted retries from misconception tags;
- a due-review queue;
- a simple progress page showing evidence by dimension;
- manual authoring/editing of artifacts and exercises;
- a fake AI provider for deterministic application tests;
- one real AI provider after the non-AI loop is working.

### First provider recommendation

Use `Microsoft.Extensions.AI` and its `IChatClient` abstraction instead of inventing a broad custom chat-provider interface. Microsoft documents `IChatClient` as the common abstraction for different AI services and for testing/middleware: <https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai>

For the first real integration, choose one:

- **Ollama first** if local/private/free experimentation matters most.
- **One cloud provider first** if grading quality and predictable structured output matter most.

The domain should own task-specific interfaces such as `IRoadmapDraftingService` and `IAnswerEvaluationService`; infrastructure implements those using `IChatClient`. This prevents chat-provider details from leaking into learning logic.

### C# execution recommendation

For this personal local app, a minimal local runner is reasonable in an early slice, but arbitrary code execution must be treated as untrusted:

- run in a disposable working directory;
- enforce process timeout and output limits;
- do not pass application secrets/environment variables;
- restrict supported exercise shape initially;
- never expose this runner publicly without stronger OS/container isolation.

If that security work is too large for the first slice, use constrained fill-in/predict-output exercises plus a few pre-authored executable tests, but do not let AI judgment stand in for compilation.

## Suggested technical shape

- .NET 10 LTS and ASP.NET Core Razor Pages.
- EF Core 10 with SQLite. EF Core 10 is LTS through November 2028: <https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew>
- Modular monolith, not distributed services.
- One web project plus focused test projects initially; split libraries only when dependency boundaries become useful.
- Feature folders/use-case services around Roadmaps, Artifacts, Sessions, Reviews, and Authoring.
- `Microsoft.Extensions.AI.IChatClient` at the infrastructure boundary.
- Structured AI outputs validated against application-owned schemas.
- Prompt templates, rubrics, and seed curriculum versioned as content assets.
- No vector database or embeddings in the first slice.

Suggested domain concepts:

```text
Roadmap
  Topic
    Artifact
      MasteryRequirement
      Exercise

LearningSession
  Attempt
    AssistanceLevel
    EvidenceResult
    Misconception

ReviewSchedule
MasterySnapshot
```

The key distinction is that an `Artifact` describes what is learned, an `Exercise` is one replaceable way to elicit evidence, and an `Attempt` records what the learner actually did.

## Delivery plan

### Phase 0 — settle the product experiment

- Agree on the core learner and whether C#/.NET remains the exclusive initial domain.
- Choose the default session length and how much of the seven-dimension rubric appears at once.
- Choose Ollama-first or cloud-first.
- Decide whether this folder becomes its own Git repository.
- Sketch the Learn and Mastery Check flows before scaffolding.

Exit condition: we can state the riskiest hypothesis and how the first slice will test it.

### Phase 1 — repository and harness foundation

- Scaffold the .NET 10 solution and test projects.
- Apply the adapted Codex/Claude harness described below.
- Establish format, build, unit/integration test, secret-scan, and browser-smoke-test gates.
- Add seed curriculum as reviewed content, not generated database data.

Exit condition: one deterministic verification command is green on an otherwise empty application.

### Phase 2 — non-AI learning loop

- Build the curated loops-and-boundaries roadmap.
- Implement artifact, exercise, attempt, evidence, session, and progress persistence.
- Implement Learn and Mastery Check with fixed prompts/rubrics.
- Add deterministic code/output checks or the constrained runner.

Exit condition: a user can complete one artifact and the app records aided and unaided evidence correctly without AI.

### Phase 3 — constrained AI tutor

- Add one `IChatClient` provider and a fake test client.
- Implement progressive hints, explanation feedback, and misconception tagging.
- Require structured output, schema validation, source/version metadata, and uncertainty handling.
- Build an evaluation fixture set of strong, partial, incorrect, and adversarial learner answers.

Exit condition: AI improves feedback without being able to silently grant mastery or reveal assessment answers.

### Phase 4 — review and mastery

- Implement a simple scheduler and due queue.
- Add fresh-question delayed checks and targeted retries.
- Add mastery health and dated badges.
- Measure unaided delayed success, hint dependence, and transfer performance.

Exit condition: the app can distinguish immediate assisted success from later independent mastery.

### Phase 5 — authoring and roadmap generation

- Add Markdown/pasted-text import.
- Generate roadmap drafts and artifact drafts for user review.
- Support branch-level regenerate, split, merge, reorder, and approve actions.

Exit condition: generated curriculum remains editable, traceable to source, and cannot enter active learning content without approval.

## Codex/Claude harness adaptation

### Repository decision — resolved

Solo Master now has a standalone project root at:

```text
/Users/manuelalmeida/solo-master
```

This matches the harness template's repository-root assumption and allows `.githooks`, `.github`, `AGENTS.md`, `.codex`, and `scripts` to have unambiguous Solo Master scope. Git initialization remains part of the approved foundation setup rather than this planning move.

### Keep from the template

- `AGENTS.md` as the verified project source of truth.
- One `scripts/verify.sh` deterministic gate.
- gitleaks pre-commit plus a CI history scan.
- CodeQL and Dependabot, adapted to the actual project.
- .NET analyzers and format gates.
- Architecture tests only after real dependency rules exist.
- Browser-based verification after a runnable UI exists.
- Standing goals only for cheap invariants that have demonstrated value.
- The rule that every documented command must be run successfully before entering `AGENTS.md`.

### Change for current Codex

The template's claim that Codex has no hooks is now outdated. Current Codex supports project `.codex/config.toml` and project-local lifecycle hooks for trusted projects. Official documentation: <https://developers.openai.com/codex/config-advanced>

Use:

```text
AGENTS.md                 durable project facts and working agreements
.codex/config.toml        trusted project settings and selected MCP/hook configuration
.codex/hooks/             small deterministic lifecycle scripts if they prove useful
.githooks/pre-commit      tool-independent secret protection
scripts/verify.sh         final deterministic quality gate
.github/workflows/        CI verification and security
```

Codex reads the repository-root `AGENTS.md` before working in the project. Official documentation: <https://developers.openai.com/codex/guides/agents-md>

Do not copy the Claude AUTO/MANUAL mode directly into Codex. Codex already has sandbox and approval settings; machine-level personal choices should remain in `~/.codex/config.toml`, while only safe project-scoped overrides belong in `.codex/config.toml`.

### MCP recommendation

- Use the in-app browser or Playwright only when the app can run and there is a real end-to-end flow to verify.
- Keep Context7 optional; official docs and repository code should remain the first sources for technical decisions.
- Do not require MCP servers at startup unless failure should genuinely block work.
- The official OpenAI documentation MCP has now been added globally on this machine; restart Codex before expecting it in a task.

### Harness activation order

1. Decide repository boundary.
2. Scaffold the minimal solution.
3. Write `AGENTS.md` from commands actually executed.
4. Create `scripts/verify.sh` and prove every stage.
5. Activate gitleaks and run the fake-secret self-test.
6. Add analyzers and format checks.
7. Add CI, then run `zizmor` to zero findings.
8. Add browser verification after the first UI flow.
9. Add architecture rules only after architecture exists.
10. Add project skills/hooks only when a repeated workflow or recurring failure justifies them.

## Product success criteria

For the personal V1, a small evidence dashboard is more valuable than broad analytics. Track:

- delayed unaided success rate;
- transfer success on a new example;
- hint level required over time;
- misconception recurrence;
- correction success after feedback;
- time to the first meaningful attempt;
- abandonment by exercise type;
- AI/user grade disagreement rate.

Do not use lesson completions, messages sent, or streak length as the primary success metric.

## Decisions for the brainstorm

1. **Repository:** resolved — standalone project at `/Users/manuelalmeida/solo-master`.
2. **Initial learner:** only Manuel learning C#/.NET, or should V1 already be understandable to another learner?
3. **Core experiment:** validate the learning loop first (recommended), or prioritize AI roadmap generation first?
4. **Provider:** Ollama-first for local/private use, or cloud-first for stronger grading consistency?
5. **Code execution:** constrained local runner in the first vertical slice, or deterministic non-executing exercises until the second slice?
6. **Mastery burden:** require all seven dimensions only for complex concepts (recommended), or for every artifact?
7. **Session promise:** optimize for a focused 10-minute daily session, or a deeper 25–40 minute study session?

## Proposed first decision

Start by agreeing on this hypothesis:

> After using the app for one small C# topic, the learner can solve and explain a fresh problem several days later without AI assistance better than they could using ordinary notes/tutorials.

If that is the product hypothesis, the first build should be the smallest system that measures it. Everything else—broad curriculum generation, arbitrary documents, badges, provider choice, and polished analytics—is secondary.
