---
name: diagnosing-bugs
description: Structured debugging loop — reproduce, minimize, hypothesize, instrument, then verify the fix against the reproduction. Use whenever behavior is wrong or unexplained (bug report, failing test, flaky CI, "it worked yesterday") — before attempting any fix.
---

# Diagnosing bugs — evidence before fixes

The failure this prevents: "fixing" the symptom you can see instead of the cause you haven't found, and calling it done because the error message changed.

## 1. Reproduce — nothing before this

- Get a deterministic reproduction: a command that fails the same way every run. Capture it as a failing test when possible — it becomes the regression test later.
- Can't reproduce? Don't fix. Gather evidence instead: exact error, logs, environment differences, recent changes (`git log`), data state. A fix without a reproduction is a guess you cannot verify.

## 2. Minimize

Shrink the reproduction until every remaining element is necessary — smallest input, fewest steps, one failing assertion. Many diagnoses fall out of minimization alone.

## 3. Hypothesize, then instrument — one at a time

- List candidate causes; rank by likelihood and cheapness to test.
- Test exactly one hypothesis at a time with targeted instrumentation (a log line, the debugger, a query, `git bisect`). Design each experiment so it can *kill* the hypothesis, not just comfort it.
- Note what each experiment ruled out — re-testing dead hypotheses is where debugging time goes to die.

## 4. Fix the cause

Fix at the root, not where the error surfaced. If the true fix is out of the task's scope, say so and flag it — never silently patch the symptom.

## 5. Verify against the reproduction

- The original reproduction now passes, and the captured failing test stays in the suite — seen failing before the fix, passing after (fail-first law).
- Run the project's full gate (`scripts/verify.sh` or the AGENTS.md commands): the fix must not buy the repro at the price of something else.

## 6. Record

Nontrivial bug → record cause and fix in `docs/dev/` per the docs model (the topic doc it belongs to, or the branch's dated report). If a cheap predicate would have caught this class of bug, propose it as a standing goal (retro / verify-goals) — propose, don't apply.
