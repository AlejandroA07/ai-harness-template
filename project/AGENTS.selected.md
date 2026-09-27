# Project harness

Read `docs/agents/domain.md` for domain documentation and
`docs/agents/issue-tracker.md` for issue operations when doing project work.
Use the project's established vocabulary, architecture and secret mechanism.

Run `node scripts/verify-harness.mjs` before declaring implementation complete.
This checks installed harness files and project skill adapters, then runs the
project's `scripts/verify.mjs`. Keep that project verifier current for its stack.

Project skill sources live in `.harness/skills/`; selected platform adapters are
generated. Update sources and rerun project configuration apply instead of editing
generated adapters. Keep optional workflow and tool activation explicit.

Work on a human-named `feature/<topic>` branch. Preserve unrelated work, test
denied paths at external boundaries, and stage only intended changes after the
verification gate passes. A task that calls for remote publication may push only
the current eligible branch explicitly to `origin`; force, deletion, alternate
repositories, and extra refspecs remain blocked. Use `gh` for ordinary issue and
pull-request collaboration, not high-impact repository, merge, release, workflow,
credential, secret, or arbitrary API mutations. Keep durable knowledge in
reviewable project documents.
