predicate: [ "$(git config core.hooksPath)" = ".githooks" ]
born: 2026-07-09
source: harness build — core.hooksPath is per-clone and silently absent after a fresh clone
status: satisfied
last-pass: never
on-violation: re-run `git config core.hooksPath .githooks`; until then commits are NOT secret-scanned locally
