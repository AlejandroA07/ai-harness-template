---
name: implement
description: Implement an approved specification or ticket through verified vertical slices, review the exact task patch, and create a clean local commit. Use only when the user explicitly asks to implement approved work.
---

# Implement

Implement only the approved specification or ticket. If the requested behavior, test seams, authorization, or scope is still undecided, stop and return to the planning workflow.

1. Read `AGENTS.md`, `CONTEXT.md`, relevant ADRs, the full ticket/specification, and the nearest existing implementation and tests.
2. Confirm the current branch is a human-style `feature/<topic>` branch. Never work directly on the default branch.
3. Define the exact task patch before editing so unrelated dirty work is excluded.
4. Use `tdd` at the pre-agreed seams: one failing behavior test, the smallest passing implementation, then the next vertical slice.
5. Typecheck and run focused tests frequently. Format explicitly before completion.
6. Run `security-checklist` when the change touches an attacker-reachable boundary, authentication, authorization, user input, files, redirects, outbound requests, webhooks, credentials, sensitive data, or dependency/CI security.
7. Stage only the intended paths. Never use broad staging when unrelated changes exist.
8. Run `code-review` against `git diff --cached`, along separate Standards and Spec axes. Resolve material findings and re-stage only the intended paths.
9. Run `node scripts/verify.mjs`. Exit code `0` is the only definition of done, then inspect the final staged diff.
10. Create one clean local commit with a concise human-style message and zero AI attribution. Report the commit SHA.

Never push a feature branch. A `research/*` branch may be pushed only to `origin`, only after the user explicitly approves that individual push, and never with force, tags, deletion, mirrors, or extra refspecs.

Write a PR title or description only when the user explicitly requests it.
