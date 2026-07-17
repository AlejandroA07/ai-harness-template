# Implementation decisions (ADR log)

> Implementation-level decisions — the "why we built it this way" that isn't a product decision. Product decisions live in `docs/planning/01-decisions.md`. Append new records; don't rewrite old ones (mark them superseded instead).

## 1. Defer `scope`/`split` on `Category` to M2

**Decision.** `Category` carries no `scope` (personal|shared) or split-rule columns during M1, even though `docs/planning/04-finance-and-sharing-model.md` puts them on the model.

**Why.** M1 is solo; nothing reads or writes those fields until the partner link exists. Building them now is speculative schema that would sit unused and untested. The columns arrive by migration at M2, when the partner link actually uses them.

**Revisit.** M2 (Partner & split). Until then this is a law, not an oversight — don't "complete the model" early.

## 2. No cross-module foreign keys into `identity`

**Decision.** Modules store the owning user as a plain `UserId` string and filter every query on it in application code. No FK from a module schema (e.g. `finance`) into the `identity` schema.

**Why.** The dependency law (`ArchitectureTests`) says modules reference only `Alfred.SharedKernel`, never each other or each other's schemas. A database FK would smuggle a cross-module dependency in through the data layer. The boundary is held by tests, not the database — so it must be held in application code too.

**Revisit.** Not planned. This is structural. See `docs/dev/security.md` for the user-scoping tests that enforce it.

## 3. Defer trimming unused `MapIdentityApi` endpoints to M2

**Decision.** Leave the full `MapIdentityApi` block mapped, including endpoints nothing calls (`/forgotPassword`, `/resendConfirmationEmail`, `/refresh`, `/confirmEmail`, `/2fa`).

**Why.** `MapIdentityApi` maps as an opaque block; trimming means hand-writing the endpoints. Nothing reachable does damage today (no email sender registered, so email flows no-op) and everything is rate-limited. M2's Households work reworks this surface anyway, so hand-writing now would be thrown away.

**Revisit.** M2, when the auth surface is reworked for real per-person invites.

## 4. A foreign/unknown `Expense.CategoryId` is a 400, not a 404

**Decision.** `POST`/`PUT /api/finance/expenses` validate that the referenced `CategoryId` belongs to the caller; if it doesn't (foreign owner or nonexistent), the request is rejected as `ValidationProblem` on `categoryId` (400), not `404 Not Found`.

**Why.** The category id is request *input*, not the addressed resource — the addressed resource is the expense. Treating an unusable input as a validation error keeps the 404 reserved for "this expense id isn't yours", and gives the client a field-level error it can surface on the form. Both cases collapse to the same shape (`db.Categories.Any(c => c.Id == id && c.UserId == userId)` is false), so a foreign category is indistinguishable from a nonexistent one — the caller learns nothing about other users' data. This is the expense-side IDOR guard; the cross-user tests mutation-check it.

**Revisit.** Not planned. Same rule applies to any future entity that references a `Category` (or other user-owned) id.

## 5. The money map isolates on the category filter; orphan expenses fall out by design

**Decision.** `GET /api/finance/money-map` builds its rows from the caller's current categories (filtered on `UserId`) and joins per-category expense sums onto them. Isolation is enforced by the **category** `UserId` filter. The expense-side `UserId` filter is kept too, but as defense-in-depth, not the guard. Expenses whose category was deleted (no live category row) are absent from both the rows and `totalSpent`.

**Why.** Category ids are globally unique GUIDs, so an expense's `CategoryId` only ever matches its owner's category row — joining month spend onto owned categories cannot surface another user's data even if the expense query weren't user-scoped. Fail-first confirmed this: dropping the expense `UserId` filter turns no test red, dropping the category filter turns the cross-user test red. The expense filter stays because it's correct and avoids scanning every user's expenses. Orphan expenses fall out because the map is deliberately a view over *current* categories — a deleted category has no budget to compare against, so it has no row; the alternative (an "Uncategorised" bucket) is scope the map doesn't need yet.

**Revisit.** If an "Uncategorised"/orphan-spend bucket becomes a product requirement, or if category delete starts cascading to expenses. Neither is planned in M1.
