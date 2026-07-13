---
name: architecture-designer
description: Procedure for choosing and evolving a project's architecture — starting a new project, adding a module/layer, or deciding whether a boundary is worth it. Use at project creation and whenever a structural decision comes up (new project, extract a layer, split a module, pick a pattern).
---

# Architecture designer

You are making the decisions that are expensive to reverse. Everything else can be refactored cheaply; boundaries, dependency direction, and data ownership cannot. Spend the thinking there, and only there.

## New project — the decision ladder

Work through these in order; each answer constrains the next.

1. **Name the load-bearing qualities.** Pick the top 2 (not 5): e.g. "single user, local-first, private data" or "portfolio piece, must demonstrate layering". Every structural choice below gets judged against these two only.
2. **Default shape: modular monolith.** One deployable, boundaries as modules inside it. You need evidence, not taste, to deviate:
   - *Single project, no layers* — until the first real boundary appears (this is the right start for a learning project or unproven product).
   - *Modular monolith* — clear domains, one team, one deploy (the default for anything real).
   - *Clean/layered architecture* — when demonstrating it is itself a goal, or the domain logic genuinely outgrows handlers.
   - *Services* — only for a proven scaling/isolation need you can state in one sentence. Not before.
3. **Draw the dependency direction and write it down.** One rule, one sentence: "modules reference only SharedKernel, never each other" / "dependencies point inward: Api → Application → Domain". If you can't state it in a sentence, the architecture isn't decided yet.
4. **Decide data ownership with the boundaries.** Each module/layer owns its tables (own schema, own DbContext/repository). Cross-boundary needs go through interfaces or events composed at the root — never a join or foreign key into someone else's tables. Shared data is the boundary-killer; decide it explicitly, day one.
5. **Encode the rules as tests, immediately.** A dependency rule that lives only in a doc is a suggestion; as an architecture test (NetArchTest / dependency-cruiser / import-linter) it fails the build for humans and AI alike. New module = new entry in the architecture tests, same commit.
6. **Record the decision.** A short ADR per irreversible choice: context, decision, the option you rejected and why, and the condition that would reopen it ("split Finance into a service when X"). Future sessions — human or agent — inherit the *why*, not just the shape.

## Evolving an existing architecture

- **A boundary must earn its existence:** two real call sites with different reasons to change, or a genuine isolation need. "We might need it" is not a reason — YAGNI applies to layers hardest of all.
- **Extract, don't pre-build:** when the first pure domain behavior appears, extract it *with its tests, in the same change* — don't create empty Domain/Application shells that wait for content.
- **New capability = vertical slice** through the existing shape (entity → use case → endpoint → UI), copying the shape of the nearest neighbor. Inventing a second pattern for the same problem is an architecture decision — treat it as one (ADR or don't do it).
- **Violations are design feedback:** when the architecture tests fail, the interesting question is *why the dependency wanted to exist*. Sometimes the fix is the code; sometimes the boundary is wrong — then move it deliberately (ADR), never by weakening the test.

## Quality bar (reject the design if any fail)

- The whole architecture fits in a table of "path → responsibility" plus one dependency sentence (if AGENTS.md can't hold it, it's too clever).
- Every boundary answers "what does it protect / what change does it absorb?" in one sentence.
- The rules are machine-enforced (architecture tests in the normal suite), not prose-enforced.
- A new developer (or agent) can add a feature by copying a neighboring slice without asking where anything goes.
- No dependency on a concrete external tech from the domain (the database, mail, AI provider live behind interfaces at the boundary — one interface per *need*, not a generic wrapper).

## Traps

- Designing for the imagined future scale/team instead of the named qualities from step 1.
- Interfaces with a single implementation created "for testability" where a plain class would test fine.
- The distributed monolith: services that share a database or deploy together — worst of both worlds.
- Copying a reference architecture wholesale (folders and all) into a project whose qualities don't need it.
- Letting "temporary" cross-boundary shortcuts live past the sprint they were born in — they become the real architecture.
