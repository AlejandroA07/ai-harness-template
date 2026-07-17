# Finance module — current surface

> Living topic doc: the Finance module as it is built *now*. Update in place as M1
> slices land; don't turn it into a changelog. Product intent lives in
> `docs/planning/04-finance-and-sharing-model.md`; the "why we built it this way"
> lives in `decisions.md`; test evidence in `testing.md`.

## What exists

M1 is being built in slices: **Category → Expense → money map → (income, fixed
costs, goals, CSV to come)**. Everything below is solo/personal — sharing and split
fields arrive at M2 (see `decisions.md` #1).

### Entities (`AlfredFinanceDbContext`, schema `finance`)

| Entity | Key fields | Notes |
|---|---|---|
| `Category` | `Name` (≤60, unique per user), `Color` (`#rrggbb`), `MonthlyBudget` (`numeric(12,2)`, nullable) | The unit expenses are logged against and budgets are set on. |
| `Expense` | `CategoryId`, `Amount` (`numeric(12,2)`), `Date` (`DateOnly`), `Note` (≤200, nullable) | Indexed `(UserId, Date)`. `CategoryId` is a plain id, not a nav FK. |

Both carry the owning `UserId` as a plain string (no cross-module FK — `decisions.md`
#2) and `CreatedAt`.

### Endpoints (all under `/api/finance`, group-level `RequireAuthorization()`)

| Method + route | Purpose |
|---|---|
| `GET/POST/PUT/DELETE /categories` | User-scoped category CRUD. Name unique per user. |
| `GET /expenses?month=YYYY-MM` | List the caller's expenses; optional month filter. |
| `POST/PUT/DELETE /expenses` | Log / edit / delete an expense; validates the category is the caller's. |
| `GET /money-map?month=YYYY-MM` | Read-only spend-vs-budget aggregation (below). |

## Conventions shared across the module

- **User scoping is the authorization.** Every query filters on the caller's
  `UserId` (from `ClaimsPrincipalExtensions.RequireUserId`). This is what enforces
  isolation — mutation-checked by cross-user tests (`testing.md`).
- **Category ownership on writes** — anything referencing a `CategoryId` verifies it
  belongs to the caller before saving; a foreign/unknown id is a 400, never attached
  (the IDOR guard, `decisions.md` #4).
- **Month handling** — `MonthRange.TryParse` turns `YYYY-MM` into a half-open
  `[start, end)` day range, shared by the expense filter and the money map. Malformed
  months → 400 `ValidationProblem` on `month`.
- **Input validation** is hand-rolled per endpoint (`Results.ValidationProblem`);
  amounts/budgets are capped at `9,999,999,999` to protect the `numeric(12,2)` column.
- **DTOs are request/response `record`s** local to each endpoint file;
  `CategoryEndpoints` is the reference shape for a new user-scoped group.

## The money map (`GET /api/finance/money-map`)

A read-only view of one month's spend per category against each category's budget.
No writable state of its own.

**Request.** `?month=YYYY-MM`, optional — defaults to the current UTC month.

**Response.**
```
{ month, totalSpent, totalBudget, categories: [
    { categoryId, name, color, monthlyBudget, spent }
] }
```
- Rows are the caller's **current** categories, ordered by name; a category with no
  spend this month is `spent: 0` (still listed).
- `totalSpent` is the sum of the rows. `totalBudget` is the sum of non-null budgets,
  or `null` when no category has a budget.
- **Orphan expenses** (whose category was later deleted) have no live category row to
  attach to, so they are absent from both the rows and `totalSpent` — the map is a
  view over current categories (`decisions.md` #5).
- Isolation is enforced by the **category** `UserId` filter, not the expense filter
  (`decisions.md` #5 explains why the expense filter is kept anyway).

**Frontend.** `MoneyMap.tsx` renders per-category budget bars inside the month
section of `Finance.tsx`: fill clamped to 100%, tinted the category colour under
budget and red when over, with "N% of budget · €X left" / "€Y over budget" / "No
budget set". The map refreshes with the month's expenses on log / delete /
add-category. Budgets are set from `Categories.tsx` (below), and every add/edit
reloads the map so the bars stay live.

## Category management (`Categories.tsx`)

`Categories.tsx` is the write surface for categories, rendered as its own card under
the money map in `Finance.tsx`:
- Lists the caller's categories, each with an inline **monthly-budget** number input
  and a Save button (`PUT /categories/{id}`, disabled until the value actually
  changes; a blank field clears the budget to `null`). Because `PUT` replaces the
  whole record, a budget edit resends the category's current name and colour.
- An add-category form (name, colour, **monthly budget** optional → `POST
  /categories`) that doubles as the empty-state onboarding.

Both actions call back into `Finance.tsx` to reload categories **and** the money map,
so a newly-set budget shows up on the bars immediately. The shared ProblemDetails
message parser lives in `web/src/problem.ts`.

## Known gaps

- **Deferred to their milestones** (not oversights): `scope`/`split` on `Category`
  → M2 (`decisions.md` #1); no validation library yet (fine at current size).
