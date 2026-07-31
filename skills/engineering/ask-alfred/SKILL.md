---
name: ask-alfred
description: Recommend the smallest skill or workflow that fits the user's situation. Use only when the user explicitly asks which workflow or skill to use.
---

# Ask Alfred

Recommend a route; do not perform it until the user chooses.

## Planned work

- A codebase-sized idea with decisions that fit one conversation: `grill-with-docs` -> `to-spec` -> `to-tickets` -> a fresh `implement` session per ticket.
- A huge or foggy effort that spans sessions: `wayfinder` -> `to-spec` -> `to-tickets` -> `implement`.
- A small, already-clear change: `implement` directly.
- A decision that needs something runnable or visible: let the workflow invoke `prototype`, then bring its result back into planning.

Keep grilling, the specification, and ticket creation in one context window when practical. Start each implementation ticket in a fresh context.

## Other entry points

- No repository or no durable project record needed: `grill-me`.
- A hard bug or unexplained failure: `diagnosing-bugs`.
- A full context window or a planned session boundary: `handoff`.
- A codebase-health audit: `improve-codebase-architecture`.
- A multi-session learning workspace: `teach`.

Model-invoked support skills include `grilling`, `domain-modeling`, `research`, `prototype`, `tdd`, `code-review`, `codebase-design`, and `security-checklist`.

GitHub Issues is the tracker when the project has a GitHub remote. Otherwise use ignored local files under `.scratch/`.
