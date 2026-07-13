# Learning App — Research, Decisions, Learning Method, and Plan

## Purpose

This document captures the complete discussion and current plan for a personal learning application. The initial focus is learning C# and .NET deeply enough to understand, write, explain, review, and improve code rather than merely copying tutorials.

The application should remain as simple as possible for the first version because it will initially have one user. It should nevertheless be designed around a learning method that can later support other technical subjects or anything that can be divided into concepts, examples, decisions, and exercises.

---

# 1. Original Learning Goal

The wider goal is to build advanced C#/.NET backend-development knowledge and the judgment needed to recognize good code.

The learning library already prioritizes:

1. C# fundamentals.
2. .NET runtime, projects, CLI, NuGet, configuration, and dependency injection.
3. ASP.NET Core Web API development.
4. EF Core, SQL, and PostgreSQL.
5. Testing, debugging, and code quality.
6. Architecture, clean code, SOLID, design patterns, and DDD basics.
7. Security, authentication, and authorization.
8. Git, Linux, Docker, SSH, and deployment foundations.
9. Azure/cloud basics.
10. OpenAPI/Swagger.
11. Computer-science foundations.
12. Frontend context.

The purpose is not to memorize isolated syntax. The learner should eventually be able to:

- explain what code does;
- explain why a concept exists;
- recognize when it should or should not be used;
- write a small example without copying;
- identify weak or naive code;
- improve that code;
- discuss tradeoffs;
- recognize the concept in a real codebase;
- assess code using evidence rather than confidence or fashion.

---

# 2. Meaning of a Learning Artifact

The word **artifact** means a small, durable learning unit produced for one focused concept or skill.

It is not only a note. It contains the material and evidence needed to learn and assess the skill.

For every artifact:

1. **Concept** — explain it in plain English.
2. **Problem** — explain what pain it solves.
3. **Example** — write a tiny C#/.NET example.
4. **Counterexample** — show bad, naive, incorrect, or unsuitable code.
5. **Refactor** — improve the counterexample.
6. **Tradeoff** — explain when not to use the concept or what it costs.
7. **Checklist / Recognition** — explain how to recognize it in real code and complete a recognition exercise.

This structure can be applied beyond C#, provided the subject can be broken into learnable concepts and assessed with meaningful evidence.

For basic syntax, some sections may be simpler, but the structure still has value.

Example for `Console.WriteLine`:

- Concept: writes text or values to the console output.
- Problem: allows a console program to communicate results or diagnostic information.
- Example: print `"Hello, World!"`.
- Counterexample: confusing output with returning a value from a method.
- Refactor: replace unclear repeated output with meaningful formatted output or a dedicated method when justified.
- Tradeoff: console output is not an appropriate production logging system.
- Recognition: identify where console output is being used and whether it is user output, temporary debugging, or inappropriate logging.

---

# 3. Learning-Science Direction

The app should not be designed as an AI chat wrapper. Its core should be a structured learning system.

The research direction supports:

## Retrieval practice

The learner attempts to recall and explain an answer **before** seeing the canonical explanation.

This is stronger than repeatedly rereading content.

Examples:

- “Explain a `for` loop in your own words.”
- “What problem does iteration solve?”
- “Predict the output of this code.”

## Spaced repetition

Weak or recently learned material should return later rather than being considered permanently complete after one successful session.

The app should schedule reviews according to learner performance:

- weak or failed steps return soon;
- partial understanding returns relatively soon;
- strong understanding returns later;
- previously learned artifacts can move to `Review`.

## Worked examples

Beginners benefit from small correct examples because large open-ended problems create unnecessary cognitive load.

The app should initially use:

- tiny examples;
- output prediction;
- guided completion;
- explanation of each line;
- comparison between correct and weak versions.

## Self-explanation

The learner should explain:

- what the code does;
- why it works;
- why the concept exists;
- what would happen if something changed;
- when another solution would be preferable.

## Deliberate practice

Exercises should target a specific weakness rather than generating random programming trivia.

If the learner understands loop syntax but fails to recognize an off-by-one error, the retry should focus on boundaries and iteration counts rather than restarting the whole loops curriculum.

## Mastery learning

A topic should not be marked learned merely because the learner recognizes its name.

Mastery requires passing all seven artifact stages. Failed stages become targeted retries.

Useful research references discussed:

- Dunlosky et al. on effective learning techniques and the value of practice testing and distributed practice:
  https://pubmed.ncbi.nlm.nih.gov/26173288/
- Retrieval-practice research:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3983480/
- Worked examples and cognitive load in programming education:
  https://files.eric.ed.gov/fulltext/ED477013.pdf

---

# 4. Learning Hierarchy

The system needs three content levels.

```text
1. Area / Domain
   Example: C#

2. Topic
   Example: C# Fundamentals

3. Artifact / Micro-skill
   Example: for loop
```

An area is too large to assess directly. A topic groups related skills. An artifact is the smallest mastery unit that receives the seven-step learning flow.

Example:

```text
C#
└── C# Fundamentals
    └── Loops
        ├── while loop
        ├── do/while loop
        ├── for loop
        ├── foreach loop
        ├── break
        ├── continue
        ├── nested loops
        ├── loop counters
        ├── off-by-one errors
        └── choosing the appropriate loop
```

The exact hierarchy may occasionally need an intermediate grouping such as `Loops`, but mastery should always terminate in focused artifacts that can be assessed clearly.

---

# 5. Ways to Start Learning

The user should be able to begin from several inputs.

## Broad goal

Example:

> I want to learn C#.

The app proposes a roadmap of major topics, such as:

- fundamentals;
- object-oriented programming;
- collections;
- exceptions;
- generics;
- LINQ;
- async/await;
- testing;
- ASP.NET Core;
- EF Core;
- code quality and architecture.

The user chooses the desired scope and level before artifacts are generated.

## Medium-sized topic

Example:

> I want to learn loops.

The app investigates the topic and proposes relevant micro-artifacts:

- loop purpose;
- `while`;
- `do/while`;
- `for`;
- `foreach`;
- `break`;
- `continue`;
- nested loops;
- boundaries and off-by-one errors;
- choosing the correct loop.

The user can select all or only some artifacts.

## Focused topic

Example:

> I want to learn `foreach`.

The app can create a single focused artifact and its mastery flow.

## Markdown document

The user can provide a Markdown file containing learning material. The app processes it into:

- proposed areas;
- topics;
- artifact candidates;
- a recommended order;
- prerequisites where useful.

## Pasted text

The user can paste notes, documentation, or an explanation directly into the app and request the same roadmap-generation process.

V1 should support Markdown and pasted text. PDF and arbitrary web ingestion are intentionally postponed because they add parsing, copyright, extraction, and source-quality complexity.

---

# 6. Roadmap Generation and User Control

AI should operate first as a **curriculum splitter**.

```text
Source material or learning goal
    ↓
Draft roadmap
    ↓
Areas / topics / artifacts
    ↓
User review
    ↓
Approved roadmap
    ↓
Artifact and exercise generation
```

The generated roadmap must never be silently accepted.

The user must be able to:

- accept it;
- reject it;
- edit names and descriptions;
- reorder topics;
- remove irrelevant topics;
- select only part of it;
- split a topic into smaller artifacts;
- merge duplicated or unnecessarily small artifacts;
- ask AI to suggest changes;
- ask AI to regenerate a specific branch rather than everything;
- choose the desired level or learning depth.

If the user enters a broad concept, the app should suggest micro-topics rather than pretending the broad concept is one assessable skill.

The AI should explain why it recommends a split when the reason is not obvious.

---

# 7. Complete Artifact Learning Experience

A learner does not pass an artifact by answering one definition question.

Each artifact is a seven-stage mastery session.

## Stage 1 — Concept

Prompt:

> Explain this concept in your own words.

The learner answers before seeing the explanation.

Assessment should consider:

- whether the core idea is correct;
- whether the learner confuses it with another concept;
- whether the answer is memorized wording without understanding;
- which important parts are missing.

After the attempt, the app shows the canonical explanation and allows follow-up questions.

## Stage 2 — Problem

Prompt:

> What problem does this concept solve? Why does it exist?

For loops, an acceptable answer should express repeated execution/iteration without copying the same statement many times.

This prevents syntax-only memorization.

## Stage 3 — Example

The learner must produce, complete, or explain a tiny valid example.

Possible task formats:

- write an example;
- predict its output;
- fill in missing code;
- explain every iteration;
- change the example to produce a different result.

V1 uses text and code-review exercises. Running code in a browser is postponed.

## Stage 4 — Counterexample

The learner identifies what is wrong, naive, unclear, or unsuitable in provided code.

The counterexample does not always need to be invalid syntax. It can be:

- duplicated code where a loop is suitable;
- the wrong loop type;
- infinite loop;
- off-by-one condition;
- modifying a collection during enumeration;
- clever but unreadable code.

## Stage 5 — Refactor

The AI provides weak or broken code and asks the learner to improve it.

Assessment should consider:

- correctness;
- clarity;
- whether the chosen construct fits the problem;
- whether the learner merely changed syntax without fixing the issue;
- whether the learner introduced unnecessary abstraction.

## Stage 6 — Tradeoff

The learner answers questions such as:

- When should this not be used?
- What alternative is clearer?
- What risks does it introduce?
- Is a loop better than LINQ here?
- Is `foreach` appropriate if an index is required?

This develops judgment instead of rule memorization.

## Stage 7 — Recognition

The learner examines realistic code and identifies:

- where the concept appears;
- whether it is used correctly;
- what problem it solves in that code;
- possible mistakes or edge cases;
- whether an alternative would be preferable.

This stage connects small examples to real codebases.

---

# 8. Assessment and Failure Behavior

## AI grading

AI suggests a result, but the user confirms it.

Suggested AI result categories:

- `Pass`
- `Partial`
- `Weak`
- `Fail`

The AI must also provide:

- what was correct;
- what was missing or incorrect;
- a concise improved answer;
- the specific misconception or gap;
- the recommended retry.

AI is not the sole authority because free and local models can be inconsistent.

The user can:

- accept the AI result;
- override it;
- request another explanation;
- ask for a simpler or deeper explanation;
- request another question;
- challenge the feedback.

## Strict mastery

All seven stages must pass before the artifact becomes learned.

An average score is not enough because a learner could otherwise pass while lacking an essential skill such as recognizing bad code or discussing tradeoffs.

## Targeted retry

Failing one stage does not restart the whole artifact.

Example:

```text
Concept        Pass
Problem        Pass
Example        Pass
Counterexample Pass
Refactor       Pass
Tradeoff       Fail
Recognition    Pass
```

Result:

- artifact remains `InProgress`;
- only Tradeoff becomes a retry requirement;
- the next session can include a different tradeoff question;
- after Tradeoff passes, the artifact can become `Learned`.

---

# 9. Progress States

Artifacts use these states:

- `New` — created but not started.
- `InProgress` — started, but one or more mastery stages are incomplete or failed.
- `Learned` — all seven stages have passed.
- `Review` — previously learned but due for spaced review.

The system should preserve per-stage results internally even though the main visible state remains simple.

A later review failure should not erase history. It should return the artifact to an active review/weak state and schedule targeted practice.

---

# 10. Badges and Group Completion

Badges represent completion of meaningful groups rather than merely opening content.

Examples:

```text
Complete all required artifacts in C# Fundamentals
    → earn “You Know C# Fundamentals”

Complete the required major C# topic badges
    → earn “You Know C#”
```

Badges therefore exist at multiple grouped levels:

- micro-artifact mastery can be visibly acknowledged;
- completing all required artifacts under a topic earns the topic badge;
- completing required topic badges under an area earns the area/domain badge.

Optional artifacts should not necessarily block a required badge. The roadmap must distinguish:

- required artifacts;
- recommended artifacts;
- optional/advanced artifacts.

Badge requirements must be visible before the learner starts.

---

# 11. AI Responsibilities

AI has several constrained jobs.

## Curriculum generation

- turn a broad learning goal into a roadmap;
- extract topics from Markdown or pasted text;
- split broad topics into focused artifacts;
- suggest prerequisites and order;
- identify duplicate or overlapping artifacts.

## Artifact drafting

- draft the seven artifact sections;
- provide canonical explanations;
- create tiny C# examples;
- create counterexamples;
- create refactoring exercises;
- generate tradeoff questions;
- generate realistic recognition exercises.

## Tutoring

- answer follow-up questions;
- make explanations simpler or more advanced;
- provide another analogy or example;
- explain why an answer is incomplete;
- target a known misconception.

## Evaluation

- compare the learner’s answer with explicit criteria;
- suggest `Pass`, `Partial`, `Weak`, or `Fail`;
- provide evidence and missing points;
- generate targeted retries.

## Important limitations

- AI content is a draft, not guaranteed truth.
- The user can edit every generated artifact.
- Canonical content should preferably be grounded in curated templates, official documentation, or source material provided by the learner.
- AI should not invent API behavior when source material is insufficient.
- AI must not be the only mechanism for deciding mastery.

---

# 12. AI Provider Strategy

The app should not hardcode one provider.

Use an abstraction such as:

```csharp
public interface IAiTutorProvider
{
    Task<RoadmapDraft> GenerateRoadmapAsync(...);
    Task<ArtifactDraft> GenerateArtifactAsync(...);
    Task<AnswerFeedback> EvaluateAnswerAsync(...);
    Task<ExerciseDraft> GenerateExerciseAsync(...);
    Task<string> ExplainFurtherAsync(...);
}
```

Exact contracts can be refined during implementation, but provider-independent application logic is required.

## Local providers

Support local AI, initially:

- Ollama;
- LM Studio or another OpenAI-compatible local server later.

Ollama exposes a local API, commonly at:

```text
http://localhost:11434/api
```

Ollama documentation:

https://docs.ollama.com/api/introduction

LM Studio local server documentation:

https://lmstudio.ai/docs/developer/core/server

## Cloud providers

Cloud should be optional and configurable.

Candidates researched:

- Gemini API: strongest candidate for a practical free developer tier;
- OpenRouter: offers access to some free models, but model availability and limits can change;
- Groq: offers free access/limits depending on account and organization;
- generic OpenAI-compatible endpoint for future flexibility.

Because free-tier terms and availability change, providers must be configuration rather than architecture.

The app should store API keys using development user secrets or environment variables, never committed configuration.

## No-AI fallback

The app must remain usable without an AI provider:

- create/edit roadmap manually;
- create/edit artifacts manually;
- use curated question templates;
- self-rate answers;
- schedule reviews;
- track mastery and badges.

---

# 13. Chosen Application Shape

## Web application

The user selected a web app rather than a CLI or Markdown-only system.

## ASP.NET Core Razor Pages

Razor Pages was selected because:

- most implementation can remain in C#;
- it has lower complexity than API + React;
- it supports a useful interactive web experience;
- building it also reinforces .NET web-development knowledge;
- it avoids introducing a large frontend architecture before the learning method is validated.

Alternatives considered:

- CLI: fastest and simplest, but rejected in favor of a web experience.
- Blazor Server: interactive and C#-focused, but adds Blazor-specific concepts.
- API + React: portfolio-friendly but excessive for validating this learning system.

## Storage

Use:

- SQLite for structured state;
- Markdown and pasted text for source material;
- generated artifacts should remain human-readable/editable where practical.

SQLite should track:

- roadmap hierarchy;
- artifact status;
- mastery-stage results;
- attempts;
- feedback;
- retry requirements;
- review schedule;
- badge progress;
- configured provider metadata, excluding secrets.

---

# 14. V1 Boundaries

V1 should include:

- single user;
- Razor Pages UI;
- SQLite;
- Markdown import;
- pasted text input;
- broad-topic input;
- draft roadmap generation;
- roadmap review/edit/accept/reject;
- artifact generation;
- seven-stage mastery workflow;
- AI-suggested grading with user confirmation;
- targeted retries;
- simple spaced review scheduling;
- topic and area badge progress;
- optional local/cloud AI providers;
- manual fallback.

V1 should not include:

- multi-user accounts;
- social learning;
- public course marketplace;
- PDF ingestion;
- arbitrary web scraping;
- browser-based C# execution;
- full IDE/coding workspace;
- complex gamification;
- mobile application;
- advanced analytics;
- AI as an unquestioned grading authority.

For V1, programming exercises are text, code-writing, output-prediction, debugging, refactoring, and code-recognition tasks. A safe C# execution sandbox can be considered later.

---

# 15. Current Plan — Verbatim

The following plan is copied exactly as agreed in the conversation.

<proposed_plan>
# Plan: C#/.NET Learning Tutor App — Learning Experience v2

## Summary

Build a personal **ASP.NET Core Razor Pages** app that turns broad goals, topics, Markdown files, or pasted text into a reviewed learning roadmap. The app guides you through small mastery units called **artifacts**.

An artifact means: one small learnable skill with a full mastery flow.

Example:

```text
Area: C#
Topic: C# Fundamentals
Artifact: for loops
```

Each artifact is learned only after passing all 7 steps:

1. Concept
2. Problem it solves
3. Example
4. Counterexample
5. Refactor
6. Tradeoff
7. Real-code recognition checklist/exercise

## Key Learning Flow

- User can start from:
  - broad goal: “I want to learn C#”
  - topic: “I want to learn loops”
  - Markdown file
  - pasted text

- App creates a draft roadmap:
  - broad goal → topics
  - topic → micro-artifacts
  - document/text → extracted topics + artifacts

- User must be able to:
  - accept roadmap
  - reject roadmap
  - edit roadmap manually
  - ask AI to revise/split/merge/reorder topics
  - choose all artifacts or only some

- Artifact mastery flow:
  - App asks one step at a time.
  - User answers before seeing canonical explanation.
  - AI gives feedback: `pass`, `partial`, `weak`, `fail`.
  - User confirms final result.
  - Failed steps become targeted retry tasks.
  - Artifact stays `In Progress` until all 7 steps pass.
  - Learned artifacts later move to `Review` for spaced repetition.

## App Model / Interfaces

- Main progress states:
  - `New`
  - `InProgress`
  - `Learned`
  - `Review`

- Badge model:
  - Artifact completion contributes to parent topic progress.
  - Completing all artifacts under `C# Fundamentals` earns a `C# Fundamentals` badge.
  - Completing all major C# topic badges can earn a higher `C#` badge.

- AI provider model:
  - Use an `IAiTutorProvider` abstraction.
  - Support local AI: Ollama first.
  - Support optional cloud AI: Gemini/free-tier-compatible provider and generic OpenAI-compatible provider.
  - App must work without AI using manual templates/self-rating.

- Storage:
  - SQLite for progress, attempts, schedules, badges, and roadmap structure.
  - Markdown/pasted text as source material.
  - Generated artifacts should remain editable by the user.

## Test Cases and Scenarios

- Broad roadmap:
  - Input: “I want to learn C#”
  - Expected: app proposes major topics like fundamentals, OOP, collections, LINQ, async, ASP.NET Core basics.

- Topic splitting:
  - Input: “loops”
  - Expected: app proposes artifacts like `while`, `do while`, `for`, `foreach`, `break`, `continue`, nested loops, off-by-one errors.

- Document ingestion:
  - Input: Markdown/pasted C# notes
  - Expected: app extracts topics/artifacts and asks user to approve before generating exercises.

- Artifact mastery:
  - If user passes 6/7 steps and fails Tradeoff, artifact remains `InProgress`.
  - Only Tradeoff becomes retry task.
  - Artifact becomes `Learned` only when all 7 pass.

- AI fallback:
  - If no AI provider is configured, user can still create artifacts manually and self-rate answers.

## Assumptions

- First version is personal/single-user.
- Stack remains **ASP.NET Core Razor Pages**.
- Use **SQLite + Markdown/pasted text**.
- Do not build a full code execution sandbox in v1.
- V1 exercises are text/code-review/code-writing prompts, not runnable in-browser C# execution.
- AI is a helper, not the final authority.
</proposed_plan>

---

# 16. First Suggested Learning Roadmap

The first usable content should validate the method with C# fundamentals.

A possible order:

```text
C#
└── C# Fundamentals
    ├── Console input/output
    │   ├── Console.WriteLine
    │   ├── string interpolation
    │   └── Console.ReadLine
    ├── Variables and values
    │   ├── variable declaration
    │   ├── common primitive types
    │   ├── assignment
    │   └── type conversion
    ├── Conditions
    │   ├── boolean expressions
    │   ├── if
    │   ├── else
    │   ├── guard clauses
    │   └── switch expressions
    ├── Loops
    │   ├── while
    │   ├── do/while
    │   ├── for
    │   ├── foreach
    │   ├── break and continue
    │   ├── nested loops
    │   └── off-by-one errors
    ├── Methods
    ├── Collections
    └── Classes and objects
```

The app should not assume this roadmap is universally correct. It should present it as a draft that can be reviewed and changed.

---

# 17. Definition of Success for the Learning Method

The method is working if the learner can:

- recall the concept without seeing the answer;
- explain the problem it solves;
- write or explain a small correct example;
- recognize incorrect or naive use;
- refactor weak code;
- discuss alternatives and tradeoffs;
- identify the concept in realistic code;
- retain the knowledge during later review;
- connect small concepts into larger backend-development skills.

The app is not successful merely because:

- it generated many notes;
- it produced long AI explanations;
- the learner clicked through lessons;
- the learner recognized terminology;
- the dashboard contains many badges.

Badges should represent demonstrated mastery, not activity.

---

# 18. Key Design Principles

1. **Understanding before memorization.**
2. **Recall before revealing the answer.**
3. **Small artifacts before broad claims of mastery.**
4. **Targeted retry instead of restarting everything.**
5. **AI suggests; the human confirms.**
6. **User controls the roadmap.**
7. **Source material and canonical content remain editable.**
8. **Complexity is added only after the learning method works.**
9. **The app must work without AI.**
10. **Badges represent mastery, not participation.**
11. **Programming knowledge includes writing, reading, debugging, refactoring, and judgment.**
12. **The learning system should produce durable knowledge artifacts, not temporary chat answers.**

