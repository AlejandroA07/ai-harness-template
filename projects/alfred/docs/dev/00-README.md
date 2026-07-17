# Alfred — Implementation docs index

> Current state: M0 done (skeleton, CI, harness, invite-gated auth — verified E2E). M1 in progress: `Category` and `Expense` merged, money map built (uncommitted). See `finance.md` for the current module surface. Next: budget-setting UI, then income / fixed costs / goals / CSV. Updated 2026-07-17.

`docs/dev/` is the implementation-side documentation root — how the thing is actually built, why decisions went the way they did, and what was verified. Product truth lives in `docs/planning/` (read `docs/planning/00-README.md` first for anything product-level).

## Files in this folder

| File | What it contains | Kind |
|---|---|---|
| `finance.md` | The Finance module's current surface: entities, endpoints, shared conventions, the money map, known gaps. | living topic doc |
| `testing.md` | The two test harnesses, gotchas, the fail-first rule, mutation-check evidence. | living topic doc |
| `security.md` | Verified auth posture and the deliberately-open gaps. | living topic doc |
| `database.md` | EF migration implementation notes (analyzer exemptions). | living topic doc |
| `decisions.md` | Implementation ADR log (parallel to `planning/01-decisions.md`). | living log |
| `m0-report.md` | What M0 built, why, and every decision made. | history — dated report |
| `next-session.md` | End-of-session handoff: state, open concerns, next steps. | working note |

## Topic docs vs reports

**Topic docs** (`testing`, `security`, `database`) are *current truth* — update them in place when behaviour changes. **Reports** (`m0-report`) are *history* — a dated snapshot of a milestone, never edited after the fact. When you need to know how something works now, read a topic doc; when you need to know how a milestone went, read its report. A milestone report is written when the milestone completes, not while it's in progress.
