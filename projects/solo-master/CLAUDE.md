@AGENTS.md

## Claude-specific notes

- Use project skills when they apply: `security-checklist` (endpoint review), `retro` (weekly harness compost).
- The Stop hook formats changed C# files as a best-effort convenience; `scripts/verify.sh` remains the authoritative gate.
- Do not commit or push. Manuel performs all Git publication actions (also enforced by deny rules and the Codex publish guard).
- Harness quick reference (mode switch, standing goals, inventory, deferred items): `.claude/HARNESS.md`.
