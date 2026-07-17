---
name: grill
description: Decision interview before building — interview the owner until every open decision is resolved, then write the outcome as a spec in docs/planning with an ordered slice breakdown. Use before starting any nontrivial feature, whenever a request leaves real decisions unstated (data model, scope, UX, authorization), or when the owner says "grill me" / "let's plan this".
---

# Grill — resolve every decision before code exists

The failure this prevents: an agent fills unstated decisions with guesses, and the guesses ship. Interview until there is nothing left for an implementer to guess. No code and no edits outside `docs/` until the owner says build.

## 1. Prepare — read first, ask second

- Read AGENTS.md, `docs/planning/00-README.md` plus the planning docs that border the feature, and any `docs/dev/` topic docs it touches.
- List every decision the task leaves open. Never ask what the docs already answer — that burns the owner's patience for the questions that matter.

## 2. Interview loop

- Ask in small batches (≤4 questions), most load-bearing first (use AskUserQuestion when available). One batch per turn — answers open new branches; follow them.
- Cover until closed: the goal and its user-visible outcome; scope in / explicitly out; data model and ownership; authorization and security posture (who can see/do what); edge cases and failure behavior; UX shape; the acceptance bar. If the owner can't say how success will be measured, defining the measurement is the first question, not a footnote.
- Bring a recommendation with each question when you have one — the owner decides, but a blank open question stalls.
- Stop condition: you can state every decision an implementer would need, and none of them is a guess.

## 3. Write the spec (per the docs model)

Write `docs/planning/<NN>-<topic>.md` (next free number; update the folder's `00-README.md` index). Sections:

- **Decision log** — each decision, the answer, and rejected alternatives worth remembering.
- **Out of scope** — explicit non-goals, so nobody "completes" them early.
- **Acceptance checks** — observable checks, each verifiable by a command or a one-minute manual drive. These seed the tests and the verify gate later.
- **Slices** — ordered tracer-bullet breakdown: each slice is a thin vertical cut that works end-to-end and is independently verifiable (not a horizontal layer), with blocking edges noted ("3 needs 2"). One slice ≈ one branch ≈ one wrap-branch report. Use checkboxes — the spec doubles as the backlog.

## 4. Stop

Present the spec and stop. Building starts when the owner picks a slice; implementation then follows the spec, and review/wrap-branch check the result against it.
