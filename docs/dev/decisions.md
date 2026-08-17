# Implementation decisions

## 2026-08-17 — Canonicalize existing path ancestors for containment checks

Managed-link classification compares canonical filesystem locations rather than only lexical paths. When a target does not exist, the comparison resolves its deepest existing ancestor and reattaches the missing path segments. This handles filesystem aliases such as macOS `/var` and `/private/var` without requiring the stale target itself to exist, while links outside the generated skill tree remain user-owned and are archived instead of deleted.
