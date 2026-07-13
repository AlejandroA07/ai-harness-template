---
name: fullstack-engineer
description: Working procedure for features that span backend and frontend — a vertical slice from data model to rendered UI. Use when a task touches both sides (new feature, new page backed by new endpoints, end-to-end changes).
---

# Fullstack engineer

You are delivering one coherent vertical slice, not a backend task plus a frontend task stapled together. The most common fullstack failure is the seam: two halves that each work and don't fit.

## Order of work

1. **Design the seam first.** Write the API contract the UI will consume — routes, request/response JSON shapes, error shapes, auth requirements — before implementing either side. The contract is the plan; both halves are built to it.
2. **Slice thin.** One user-visible capability end to end (schema → endpoint → UI → tests) beats three finished layers of an unshippable feature. If the task is big, pick the thinnest slice that a user could actually exercise, finish it, then widen.
3. **Backend half:** follow the `backend-engineer` skill (contract, explicit authz, boundary validation, parameterized data access, failure design).
4. **Frontend half:** follow the `web-designer` skill for anything visual. Consume the contract exactly — no "temporary" client-side reshaping that quietly becomes a second contract. Handle the API's declared failure modes in the UI: loading, error, empty, unauthorized are designed states, not console errors.
5. **Own the seam explicitly.**
   - Types at the boundary: shared/generated types where the project has them; otherwise write the client-side type by hand from the contract and keep it next to the fetch code.
   - Validation lives server-side; client-side validation is UX sugar, never the security boundary.
   - Errors: the server returns structured errors; the client maps them to user language. Never surface raw server messages to users.
   - Auth: the UI hides what the user can't do; the server *enforces* it. Both, always.
6. **Prove it end to end.** Unit/integration tests per half, then drive the real UI against the real backend (dev server + Playwright when available) through the new flow: happy path once, one failure path once. A screenshot or DOM assertion of the working flow is the finish line — not two green test suites.

## Quality bar (reject your own work if any fail)

- A request can be traced end to end: UI action → HTTP call → handler → data access → response → rendered result, with no mystery hop.
- The API works without the new UI (curl-able, sensible errors) and the UI degrades sanely without the API (no blank page on fetch failure).
- No secrets or environment-specific URLs baked into frontend code — configuration comes from the project's mechanism.
- The full project gate (`scripts/verify.sh` or equivalent) is green, both halves included.

## Traps

- Building the whole backend "first, to be safe" — you'll design the API blind to what the UI needs. Contract first, then either order works.
- Duplicating domain rules in the client because it's convenient; the moment they drift, users see bugs that tests can't catch.
- CORS/cookie/auth-header issues discovered at the very end — hit the seam with a real browser call as early as possible.
