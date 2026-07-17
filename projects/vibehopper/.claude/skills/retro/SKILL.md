---
name: retro
description: Weekly-ish harness retrospective — mine recent failures for at most 3 proposed harness improvements. Propose-only; never applies changes itself. Use when the user asks for a retro, or roughly weekly.
---

# Harness retro (compost) — failures become laws

Read the week's exhaust, extract at most **3** proposals, apply **none** of them. The owner signs off; unsigned proposals die.

## 1. Gather evidence (read-only)

```bash
tail -50 .claude/goals/ledger.tsv | grep FAIL          # goal violations
gh run list --limit 15                                  # CI failures
git log --oneline --since="7 days ago"                  # what shipped
```

Plus anything the user reports going wrong with agents this week (repeated corrections, bad suggestions, prompts that had to be re-asked).

## 2. Extract at most 3 proposals

Each proposal must be one of:
- **A new law** for AGENTS.md's NEVER block — quote the incident(s) that motivate it. A law needs a number, a "never", or a command that checks it; anything softer gets optimized away.
- **A skill fix** — the same failure repeating means the skill's steps are wrong, not the executor.
- **A new standing goal** — something broke that a cheap predicate in `.claude/goals/` would have caught. Include the exact predicate and verify it detects (run it against the broken state if reproducible).

**Prefer the executable form.** When a failure is mechanically checkable, propose the standing goal (or a repo test) over prose — a running predicate catches the regression forever; reserve laws and skill fixes for what no cheap predicate can check.

## 3. Report format

For each proposal: the evidence (quoted), the exact change (diff-ready text), and what it would have prevented. If the week was clean, say exactly that and propose nothing — inventing proposals to fill quota is how harnesses bloat.

## Never

- Never apply a proposal — present and stop.
- Never propose more than 3; pick the highest-evidence ones.
- Never propose removing a NEVER law or weakening a deny rule as a "cleanup".
