# Finance & Sharing Model

> Added 2026-07-10. This is the anchor of the whole product — the Excel-replacement workflow that started the idea. Design goal: the owner's current spreadsheet workflow must map onto the app with *less* effort than the spreadsheet, and other households must be able to arrange it differently.

## 1. The current real-world workflow (source of truth)

- Two bank accounts: one for **savings**, one for **bills + monthly spending**.
- All expenses go into an Excel sheet with **categories**: bills, car, presents, child, food, food outside, others.
- The sheet answers: *how much did we spend this month, on what, which costs are shared between us, which are personal*, and produces a **total** and a **share amount** (what each partner owes toward the shared costs).
- Personal costs (phone bill, training, etc.) stay out of the shared calculation.

This is essentially **Splitwise (settlement between partners) + YNAB-style categories**, and neither app does both well with category-level sharing — which is exactly the gap Alfred fills.

## 1b. The personal default: every krona accounted for (added 2026-07-10)

Before any sharing, the single-user experience is a **monthly money map**. The user states income and the app shows where all of it goes — nothing unexplained:

```
Salary / income (per month)
  − Fixed costs        (rent, insurance, subscriptions — recurring, mostly untouched)
  − Budgeted spending  (the variable categories: food, car, child, …)
  − Savings            (contributions to savings goals)
  − Planned purchases  (saving toward concrete things: computer, trip, sofa)
  = Unallocated        (shown explicitly — the honest leftover, positive or negative)
```

- **Income**: one or more entries (salary, side income). Private by default like everything.
- **Fixed costs**: recurring expenses with a day-of-month; auto-appear each month, one tap to confirm/adjust. They also feed reminders ("insurance renews Friday").
- **Budgeted spending**: the categories from §2, each optionally with a monthly budget figure; month view shows spent vs budget.
- **Savings & planned purchases**: savings goals (already modeled) — a "planned purchase" is just a goal with a target item, linking finance to the Purchases module when bought.
- **Unallocated** is a first-class number, never hidden. If it's consistently large, Alfred can suggest assigning it (that's the YNAB "give every unit a job" idea, without envelope bureaucracy).

**Presentation matters** (owner: "shown in a way that is pleasant to the eye"): the month view is a visual flow — income bar breaking down into fixed / spending / savings / planned / unallocated segments, then category detail below. This is a flagship screen; design it properly (a Sankey-style or stacked-bar breakdown, big readable numbers), not a data table with totals.

This model is a superset of the couple's Excel: the Excel is the *shared-spending slice* of it (§1), and both views read the same expense data.

## 2. Domain model

```
Household
  members: [User]                      (MVP: exactly 2 — partner link via invite code)
  settings: split_mode, currency

Account (informational, no bank sync)
  name ("Savings", "Bills & monthly"), owner (user or household), type

Category  (user-defined, per user, with optional household visibility)
  name, icon/color
  default_scope: personal | shared     ← the key idea
  default_split: 50/50 | proportional | custom %   (only if shared)

Expense
  amount, date, category, note
  paid_by: user
  scope: inherited from category, overridable per expense
  split: inherited from category, overridable per expense

MonthlySummary (computed, not stored)
  per-category totals
  personal totals per member (visible only to that member)
  shared total
  per-member share (from split rules)
  settlement: "X owes Y ___ this month"  (net of who actually paid what)

SavingsGoal (already in MVP)
  optionally linked to an Account; optionally shared
```

### Why category-level sharing (the owner's instinct, confirmed)

Marking sharing on the **category** (with per-expense override) is the lowest-friction correct model:

- Log "food 480 SEK" → it's shared automatically because *Food* is a shared category. No per-expense decision.
- "Phone bill" lives in a personal category → never enters the shared math, partner never sees it.
- Edge cases ("this dinner was actually just mine") → one-tap scope override on the expense.

### Split rules — configurable per household AND per category

Different households arrange money differently, so `split_mode` is a household default with category overrides:

| Mode | Behavior |
|---|---|
| `all_shared` | Everything both partners log is pooled; one big shared budget. |
| `by_category` (owner's mode, the default) | Categories are personal or shared; shared ones split by rule. |
| `separate` | Nothing shared by default; individual expenses can be explicitly pushed to the shared pot. |

Split rules per shared category: **50/50** (default), **proportional to income** (each partner stores an income figure, private, only the ratio is used), **custom %**. Settlement nets out who paid: if the shared total is 10,000, split 50/50, and I paid 7,000 of it, partner owes me 2,000.

### Monthly cycle

- Month view = the spreadsheet replacement: category rows, totals column, shared total, share amount, settlement line.
- "Close month" is just a soft marker (nothing locks); Alfred's weekly/monthly review reads from it.
- CSV export from day one (trust: the data is never trapped; also eases migration *from* the Excel).

## 3. Generalized sharing model (all modules, not just money)

One mechanism everywhere, so "share a category with my partner" and "share one study topic with one friend" are the same feature:

```
ShareGrant
  resource: (type, id)        e.g. (category, 42), (study_topic, 7), (savings_goal, 3), (event, 91)
  grantee:  household | specific user
  role:     viewer | editor
```

Rules:

1. **Private by default.** No grant → invisible to everyone else. (Unchanged principle.)
2. Grants are **per-resource**, to either the household or a named person. Sharing a finance category with the household ≠ sharing a study topic with one friend — same table, different rows.
3. Shared-category *expenses* are visible to the grantee only in aggregate + line items of that category — never the rest of the payer's finances.
4. Revoking a grant hides future *and* past data of that resource (simplest rule; revisit if it feels wrong).
5. Household dissolution = all household grants revoked; personal data untouched. (Answers the research's open question with the simplest defensible rule.)

MVP implements grants for: **finance categories** (household) — that's the wife use case. The table design supports the rest; study/goal/event sharing turns on in later milestones without schema change.

### The Household module = the receiving side of sharing (added 2026-07-10)

Sharing has two surfaces:

1. **Giving** — on any shareable thing (income entry, fixed cost, category, savings goal, study topic…) a "Share" control creates/revokes grants. That's it.
2. **Receiving — the Household area**: a dedicated module page showing *everything others have shared with me*, so the partner's shared world is one coherent place instead of scattered hints inside my own pages.

Household page layout: grouped into **sections by domain** — e.g. *Economy* (their shared salary, bill costs, shared categories, savings plans), *Studies*, *Plans/Goals* — with the shared-spending settlement view (§1) as the centerpiece of the Economy section. Section grouping and order are user-configurable via the same `user_preferences` mechanism as the dashboard (and thus also adjustable by asking Alfred). Shared items also surface contextually where relevant (a shared category appears in my month view's shared block), but the Household page is the canonical "what do I see of my partner" answer — which doubles as a **privacy audit**: what's listed there is exactly what's shared, in both directions (a "shared by me" tab shows the mirror image).

## 4. Customization ("each household does as they want")

- Categories: fully user-defined (seeded with the owner's set as a sensible default: Bills, Car, Presents, Child, Food, Food outside, Other + Personal).
- Scope & split: per category, overridable per expense.
- Household mode: the three modes above.
- All of it editable via settings UI **and** via Alfred commands (same confirm flow) — this is the "customizable by person or AI" feature applied to the domain that matters most.

## 5. Explicitly out (for now)

Bank synchronization · multi-currency math (store currency, no conversion) · budgets/envelopes (categories + monthly totals first; envelopes are a later layer) · >2-member households (schema allows it, UI doesn't) · debt/credit-card cycle modeling.
