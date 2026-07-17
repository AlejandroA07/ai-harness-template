# Docs model (all projects)

Generalized from alfred's structure (the reference implementation is `~/alfred/docs/`): product truth and implementation truth are separate folders, every folder has a `00-README.md` index, and history is never rewritten.

## Target shape

```text
docs/
  00-README.md            # top-level index: what lives where, one row per item below
  planning/               # OPTIONAL — product truth: plans, product decisions, architecture
    00-README.md          # index table: file | what it contains
    01-<topic>.md         # numbered in the order they were written
  dev/                    # implementation truth — how it's actually built
    00-README.md          # index table: file | what it contains | kind  (+ a "current state" header line)
    <topic>.md            # living topic docs (e.g. finance.md, testing.md, security.md, database.md)
    decisions.md          # implementation ADR log — append-only
    YYYY-MM-DD-<slug>.md  # dated reports — one per finished branch (or m<N>-report.md per milestone)
    next-session.md       # working note — end-of-session handoff: state, open concerns, next steps
```

`planning/` exists only when the project has planning material — never invent it for a repo that has none. `dev/` every project gets.

## The four kinds (from alfred's index — keep the `Kind` column)

| Kind | Examples | Rule |
|---|---|---|
| **living topic doc** | `finance.md`, `testing.md`, `security.md` | *Current truth.* Updated in place when behavior changes; revise, don't append contradictions. |
| **living log** | `decisions.md` | Append-only ADR log; entries dated, never edited after the fact. |
| **dated report** | `m0-report.md`, `2026-07-17-fix-gitleaks.md` | *History.* Written once when the work completes, never edited after (append a dated correction if wrong). |
| **working note** | `next-session.md` | Freely overwritten; it only describes now. |

Reports are per **finished piece of work** — a milestone when the project runs on milestones (`m<N>-report.md`), otherwise a date-prefixed branch note (`YYYY-MM-DD-<branch-slug>.md`). This is what makes the model fit every project and outlive a milestone phase: milestones are one *type* of work, not the naming scheme.

## Dated report template

```markdown
# <Title> — <branch-name>

- **Date:** YYYY-MM-DD
- **Type:** milestone | feature | fix | refactor | investigation | ops

## Why
One short paragraph: the problem or goal that justified the branch.

## What changed
The key parts, with file paths — enough for a future reader to navigate straight to them.

## Decisions
Choices made and rejected alternatives. Omit if none (but mirror real ones into decisions.md).

## Verification
What was run (verify.sh, tests, manual exercise) and the result.

## Follow-ups
Open items this branch deliberately did not do. Omit if none.
```

Half a page for a branch; a milestone may earn a full page.

## Applying the model to an existing project — additive only

1. **Never delete, move, or rename an existing doc.** No exceptions, even if a file violates the naming scheme.
2. Create only what is missing: `docs/00-README.md`, `docs/dev/` + its index. Topic docs and `decisions.md`/`next-session.md` appear when there is content for them, not preemptively.
3. Index existing files where they already are. Files that predate the model (a flat numbered history, a single `ai-harness.md`) get indexed with an honest one-liner and kind — not relocated.
4. Existing reports keep their names (`m0-report.md` stays); only new reports follow the current scheme.

## Committability

Per project, per folder — follow what `.gitignore` / `.git/info/exclude` already say (in current projects `docs/` is local-only). When a doc is committable it must read as a normal engineering doc: no AI/agent mentions, no attribution.
