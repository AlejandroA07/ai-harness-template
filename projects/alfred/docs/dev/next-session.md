# Next session — state, open concerns, plan

> Updated 2026-07-17 (late). The **budget-setting UI merged** (PR #20) — §3 below is
> now history. Current uncommitted work: the **Income backend slice** (user-scoped
> `/api/finance/incomes` CRUD + migration + tests) on `feature/m1-income`, verified
> ALL GREEN, awaiting the owner's commit — see § 3. Next after it lands: the income
> UI (+ wiring income total into the money map), then fixed costs / savings goals /
> CSV. Everything below was verified against tool output, not recalled. `docs/` is
> git-excluded, so this file is local-only.

---

## 1. Where things actually are

| Fact | Value |
|---|---|
| Branch | income backend slice is uncommitted on `feature/m1-income` (branched from `origin/main`); commit + PR it |
| Head (origin/main) | `f2b2ebf` — Merge PR #20 (`feature/m1-budget-ui`) |
| Merged so far | PR #9 (M0 invite gate), #10 (M1 categories), #11 (API hardening), #18 (M1 expenses), #19 (M1 money map), #20 (M1 budget UI) |
| Tests | 85 passing (71 + 14 income), `scripts/verify.sh` ALL GREEN |
| Uncommitted work | The **Income backend slice** — see § 3. |

Merged branches still lying around locally: `feature/m0-invite-gate`,
`feature/m1-finance-spine`, `feature/api-hardening`, `feature/m1-expense-slice`.
All fully merged; safe to `git branch -d` each (`-d` refuses unless merged, so it
double-checks itself).

**Milestones:** M0 done (verified end-to-end: invite-gated register → login →
session → logout). M1 slice 1 done (Finance module, `Category` + user-scoped CRUD,
Testcontainers harness). M1 slice 2 done (`Expense` + user-scoped CRUD, category
IDOR guard, month filter, finance UI). M1 slice 3 done and merged (money map —
read-only spend-vs-budget view, PR #19). Budget-setting UI built, not merged (this
session). M1 remains: income, fixed costs, savings goals, CSV import/export.

---

## 2. Harness hygiene — DONE (earlier 2026-07-17 session)

The four concerns from the morning handoff (docs model, AGENTS.md line 20, AGENTS.md
bloat, Codex branch naming) are resolved. What was done:

- **Docs model decided and built.** `docs/dev/` now mirrors `docs/planning/`: an
  index (`00-README.md`) plus living topic docs. The axis is *audience* (planning
  = product, dev = implementation), then *topic* within `dev/`. Topic docs are
  current truth; milestone reports are dated history. No `m1-report.md` yet — M1 is
  only one slice in, so it gets written when M1 completes.
  - `docs/dev/testing.md` — the two harnesses, gotchas, fail-first rule, mutation evidence
  - `docs/dev/security.md` — verified auth posture + deliberately-open gaps
  - `docs/dev/database.md` — migration analyzer-exemption rationale
  - `docs/dev/decisions.md` — implementation ADR log, seeded with the three that had
    no home (defer scope/split → M2, no cross-module FK, defer MapIdentityApi trim → M2)
  - `docs/dev/00-README.md` — index + "topic docs vs reports" explanation

- **AGENTS.md slimmed 1654 → 1289 words.** Line 20 rewritten (docs is the
  documentation root, only `docs/planning/` is off-limits to reorganise); line 3
  corrected. Testing / auth-posture / migration-analyzer detail moved to the topic
  docs with one-line pointers left behind. Kept inline: security laws, commands,
  architecture, NEVER laws, and the law-shaped scope/split deferral note. Added a
  docs map near the top.

- **Codex branch rule** added to `## Conventions`: branches are `feature/<topic>`,
  rename `codex/…` with `git branch -m` before pushing. Persuasion, no enforcement.

- **Correction to record:** AGENTS.md is itself git-excluded (`.git/info/exclude`),
  not committed — same as `docs/`. The morning plan wrongly assumed AGENTS.md was
  tracked; in fact nothing here enters or leaves version control. All of it is
  local working files.

---

## 3. Open handoff — the Income backend slice (uncommitted)

The **Income slice** (backend only) is built and verified, on `feature/m1-income`
(branched from `origin/main`), not yet committed. Income is the top of the money
map's monthly flow (§1b of `04-finance-and-sharing-model.md`): the map currently has
no income figure at all. This mirrors the **Expense backend commit** (`1b8a4ee`)
exactly — user-scoped CRUD, no money-map change yet — following the repo rhythm of
shipping endpoints first, then the UI.

New `Income` entity: `Amount` (numeric(12,2)), `Date` (DateOnly), `Source` (required,
≤60 chars, e.g. "Salary"). No category, so no IDOR guard; kept deliberately minimal
(no `Note` — not built ahead of need).

The changed files:

- `src/Alfred.Modules.Finance/Income.cs` (new) — the entity.
- `src/Alfred.Modules.Finance/IncomeEndpoints.cs` (new) — `GET/POST/PUT/DELETE
  /api/finance/incomes`, user-scoped, month filter on GET, mirrors `ExpenseEndpoints`.
- `src/Alfred.Modules.Finance/Migrations/*_AddIncome.*` (new) — creates `finance.Incomes`
  + `IX_Incomes_UserId_Date`. BOM stripped from the main `.cs` to match the repo
  convention (Designer + snapshot keep theirs) — the format CHARSET gate requires it.
- `AlfredFinanceDbContext.cs`, `FinanceModule.cs` (edited) — `DbSet<Income>` + config
  + `MapIncomeEndpoints()`.
- `tests/Alfred.Tests/IncomeEndpointsTests.cs` (new) — 14 tests mirroring the expense
  suite (auth, isolation, update/delete ownership, month filter, input validation).

Churny handoff bits:

- **Not committed.** Left in the tree for the owner to commit/PR (owner does all git).
  Well under the ~200-line guideline (generated migration files exempt). Suggested
  message: `Add user-scoped Income endpoints`.
- **Verified:** `scripts/verify.sh` ALL GREEN (85 tests). Fail-first done on the
  isolation guard: broke the GET `UserId` filter → `Incomes_are_not_visible_to_another_user`
  went red, restored → green. Migration inspected (new table only, non-destructive).
- **Not yet done (next slice):** the Income UI, and wiring the income total +
  `Unallocated` into the money map — deferred so the map's flow gets built once there's
  a UI to show it (matches how expenses → money map were separate slices).

---

## 4. Earlier finished work — pointers, not re-descriptions

Done and merged; durable detail lives in the topic docs, not here:

- **M0** (skeleton, CI, invite-gated auth) — `m0-report.md`.
- **M1 `Category` + `Expense` slices** (PRs #10, #18) — `finance.md` for the surface,
  `decisions.md` #1–#4 for the deferrals and the IDOR-as-400 call.
- **Harness/docs hygiene** (docs model, AGENTS.md slimming, Codex branch rule) —
  reflected in `00-README.md` and AGENTS.md themselves.

---

## 5. Suggested order next

1. **Land the income backend** — commit the § 3 changes on `feature/m1-income`, open
   the PR, merge, then `git branch -d` the merged branches still lying around locally
   (see § 1).
2. **Income UI + money-map integration** — the write surface for income (mirror
   `Finance.tsx`/expense form) and wire the income total + `Unallocated` into the money
   map so the §1b flow (income − spending − …) finally shows a top line.
3. Then the rest of M1: fixed costs / savings goals / CSV import-export. All still
   reads-and-writes over the same user-scoped pattern.

---

## 6. Session notes worth keeping

- **Verify remote git state before claiming anything about it.** Local `main` is
  routinely behind; fetch, then compare against `origin/*`.
- **A passing test proves nothing until it has failed.** Every security property is
  mutation-checked (see `docs/dev/testing.md` for the concrete cases). Keep doing this.
- **Check behaviour, don't assume it.** Two confident claims were wrong and only
  testing caught them: lockout was *already active*, and minimal APIs only *throw*
  on bad JSON in Development. A third: AGENTS.md was assumed committed but is
  git-excluded. Check the actual state, don't reason from the plan.
- **Fail-first can reveal the real guard.** On the money map, the "obvious" filter to
  mutation-test (expense `UserId`) turned out to be redundant — the actual isolation
  came from the category filter + unique GUIDs. The failing test told the truth; the
  first guess didn't. Mutate until something goes red, then you know what protects you.
