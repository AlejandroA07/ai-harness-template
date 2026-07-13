# MVP Plan (v2 — finance-first)

> Revised 2026-07-10: finance promoted to the anchor module (it's the origin of the idea and the daily-use hook), minimal Household (partner link) pulled INTO the MVP because the owner's core workflow is two-person, and a Studies milestone added. Original v1 slice is superseded.

## Goal

Two proofs:

1. **Replace the Excel.** The owner and his wife run their monthly money (categories, shared vs personal, share amount, settlement) in Alfred instead of the spreadsheet — and it's less work.
2. **Prove Alfred.** Capturing anything (expense, reminder, purchase, idea) by telling Alfred beats opening five apps.

## The loop (unchanged)

```
Capture (chat / inbox / form)
→ Alfred proposes a structured action → user confirms
→ Stored in the right module → Today view / reminder / monthly summary
→ Review surfaces what's overdue, stalled, or overspent
```

## In scope

### 1. Accounts & minimal Household
- Email+password auth, invite-code registration.
- **Partner link**: invite your partner into a 2-person household. Everything else stays private by default; sharing is per-resource grants (see `04-finance-and-sharing-model.md`).

### 2. Finance (the anchor — full model in doc 04)
- **Personal money map** (the default view, every krona accounted for): income entries, recurring fixed costs, budgeted spending categories, savings goals + planned purchases, and an explicit **Unallocated** number. Presented as a visual monthly flow (income bar → fixed / spending / savings / planned / unallocated) — a flagship screen, designed to be pleasant, not a table.
- User-defined categories with `personal|shared` scope and split rules (50/50, income-proportional, custom %); household modes `all_shared | by_category | separate`.
- Expense logging (amount, category, payer, date, note) — form must be ≤ 5 seconds; Alfred chat even faster.
- Month view: category totals vs budgets, shared total, share amount, **settlement line** ("Maria owes you 2,000 SEK").
- Savings goals with contribution + ETA projection; planned purchases are goals with a target item.
- CSV export; one-time CSV/Excel import to migrate history from the current sheet.

### 2b. Household module (receiving side of sharing)
- A dedicated page showing everything my partner shared with me, grouped in configurable sections by domain (Economy first; Studies/Plans join later) — plus a "shared by me" mirror tab that doubles as a privacy audit. See doc 04 §3.

### 3. Alfred chat
- Streaming chat; every mutation is a **draft card** → Confirm / Edit / Discard. Manual forms always exist for everything.
- **MVP command set (9):**
  1. `log_expense` — amount, category, payer, scope/split override
  2. `create_category` — incl. scope + split rule
  3. `create_reminder`
  4. `create_purchase` — item, store, price, return deadline → auto reminder
  5. `create_savings_goal`
  6. `create_calendar_event`
  7. `summarize_today` (query)
  8. `finance_summary` (query — "how much did we spend on food this month? what's the settlement?")
  9. `update_ui_preferences` — card order, module visibility, reminder aggressiveness

### 4. Inbox
- One-keystroke free-text capture + browser speech-to-text; cheap-model classification suggests the right command; one tap converts.

### 5. Today view
- Overdue/today reminders, closing return windows, upcoming events, month-to-date spend vs typical, goal progress, inbox count. Layout from `user_preferences` JSONB.

### 6. Notifications
- Web Push (installed PWA incl. iOS): reminders with configurable escalation (normal / persistent / daily-until-done), daily digest.

### 7. Weekly/monthly review (v0)
- Generated page: completed, overdue, stalled goals, spending by category vs last month, settlement status. Alfred adds short commentary.

## Studies module (first post-MVP milestone — designed now, built after)

The target use case, verbatim: *"I want to learn about Christianity — give me the best-known critics, the best apologists, the main figures in history; I iterate, ask for summaries and recommendations, then Alfred saves it as a study topic with a learning path I can customize."*

- **Research mode** in chat: Alfred answers with **web search enabled** (provider server-side search tool) so figures/books/sources are current and citable — this is why the AI layer must support a search tool (see doc 03).
- Iterative: user asks follow-ups, asks for summaries, "give me a reading order", "make me a map".
- `create_study_topic` command saves the conversation's outcome as a structured topic. **Default template** (opinionated baseline for people who don't know how to organize study):
  ```
  Study Topic
  ├─ Overview (Alfred-written summary of the topic)
  ├─ Key positions & figures (e.g. critics / apologists / historical figures — grouped)
  ├─ Reading list (beginner → intermediate → advanced, with why-this-book notes)
  ├─ Learning path (ordered milestones with checkboxes; each links to sources)
  ├─ Subtopics (user- or Alfred-created, same structure recursively)
  ├─ Notes (markdown, free-form)
  └─ Open questions
  ```
- Everything editable/reorderable; template is a starting point, not a cage. Sections are data (JSONB blocks), so users can add custom sections — same "UI as data" trick as the dashboard, no metadata engine.
- Commands added in this phase: `create_study_topic`, `update_study_topic` (add sources/milestones/notes), `share_item` (per-person grants — share one topic with one friend, using the grant table from doc 04).
- Progress tracking: milestone checkboxes + "resume where I left off" prompt from Alfred if a topic stalls (the research's "resume abandoned plans" promise, applied here first).

## Out of scope (MVP + studies phase)

Receipt OCR · email integration (paste into Inbox) · training & diet modules · bank sync · budgets/envelopes · >2-person households · proactive Alfred (reactive + suggest-on-capture only) · app stores.

## Milestones

| # | Milestone | Contents | Done when |
|---|---|---|---|
| M0 | Skeleton | Solution structure, React PWA shell, Postgres in Docker, auth, CI, harness template applied | Logs in locally |
| M1 | Finance core (solo) | Income, fixed costs, categories + budgets, expenses, savings goals/planned purchases, **money-map view**, CSV import/export | **Owner stops using Excel for his own tracking** |
| M2 | Partner & split | Household invite, category sharing grants, split rules, settlement, **Household page (received shares + shared-by-me audit)** | **The couple's monthly closing happens in Alfred** |
| M3 | Life admin | Reminders, purchases + return deadlines, calendar, Today view | Daily-driver for both |
| M4 | Alfred v1 | Chat + the 9 commands + inbox classification + draft-confirm; **AI settings page (choose among wired-up providers, cost/risk cards, per-user usage meter + caps)** | Voice/text capture beats forms |
| M5 | Notify & review | Web Push, escalations, digest, weekly/monthly review, UI prefs | A return deadline is saved by a push |
| M6 | Studies + friends beta | Research mode (web search), study topics, per-person sharing, invite friends, public deploy | A friend learns something with it |
| M7 | Collections & recipes | User-named collections, recipe template, AI import from text/link, attributed notes, recipe sharing (doc 05) | The couple cooks from a shared recipe with each other's notes |

Governing rule unchanged: **manual workflow first, AI second** (M1–M3 work fully without any AI key configured).
