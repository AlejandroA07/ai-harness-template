# Alfred Butler App — Planning Index

> Status: planning phase. Updated 2026-07-10.

## Files in this folder

| File | What it contains |
|---|---|
| `alfred-butler-app-chat-summary.md` | Original product-discovery research (June 2026). Still the reference for the full vision, modules, competitor landscape, and risks. |
| `01-decisions.md` | Consolidated decisions from the July 2026 planning session: product direction, verdicts on PageAgent / PixelRAG / pi / Hermes, and what we are explicitly NOT building. |
| `02-mvp-plan.md` | Concrete MVP scope (v2, finance-first), the 9 Alfred commands, Studies module design, milestone plan M0–M6. |
| `03-technical-architecture.md` | Chosen stack (.NET 10 + React/TS + PostgreSQL), provider-agnostic AI layer (`IChatClient`) with provider comparison, hosting and cost plan, path to mobile/app stores. |
| `04-finance-and-sharing-model.md` | The anchor: personal money map (every krona accounted for), couple's money model (categories with personal/shared scope, split rules, monthly settlement), the generalized ShareGrant sharing model, and the Household received-shares page. |
| `05-collections-and-recipes.md` | Collections module (user-named containers + card templates we control) with recipes as the first template: AI import from text/link, attributed notes, sharing. How users get "their own modules" without a metadata platform. |

## One-sentence vision (unchanged)

> Alfred is a personal-first AI butler that captures and organizes your life context, turns obligations and ambitions into persistent plans and actions, and helps you remember, decide, follow through, and resume without starting from zero.

## The "save / plan / learn" framing

The owner's core framing maps cleanly onto the existing vision:

- **Save** = Capture + Inbox + structured storage (purchases, notes, receipts, ideas)
- **Plan** = Goals, reminders, finance, calendar, review loop
- **Learn** = Studies/knowledge module + Alfred learning the user's context over time

Nothing in the original research contradicts this framing; it's a simpler way to pitch the same product.
