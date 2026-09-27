---
status: accepted
---

# Use a quiet, script-owned repository verification contract

Repository verification should spend model context on failures rather than on discovering test commands or reading successful output. We will use one stable command, `node scripts/verify.mjs`, whose script owns the complete verification sequence; speed is secondary to correctness and low token use.

## Output contract

- Success without warnings prints `PASS` and exits `0`.
- Success with warnings prints `PASS WITH WARNINGS`, followed by concise, deduplicated warnings, and exits `0`.
- Failure prints the failed stage, the essential diagnostic, and the path to the complete captured log, then exits nonzero.
- Successful command details remain captured instead of entering the model context.
- `--verbose` is an opt-in escape hatch for humans or exceptional diagnosis; it is not the normal agent workflow.

The model runs the complete verifier instead of spending context selecting focused tests. It reads detailed logs only when the concise failure report is insufficient.

## Execution constraints

The verifier should run inexpensive checks first, fail fast, use correctness-preserving caches, apply timeouts, and avoid unintended changes to tracked files. Network access, external services, and other side effects must be explicit and controlled. Local and CI verification must exercise the same logical gate, and unexpected skips or warnings must not be hidden.

## Consequences

The verification script becomes the maintained source of truth for required checks. A passing result proves only that its configured checks passed, so the script must evolve with the project. Full output remains available for diagnosis without consuming tokens during normal successful work.

The contract is implemented by the shared verification runner used by both the harness repository and generated project verifiers.
