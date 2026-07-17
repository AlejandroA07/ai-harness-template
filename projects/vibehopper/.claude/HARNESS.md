# Harness Card

## Inventory

- `.githooks/pre-commit` blocks likely secrets before commit.
- `.claude/hooks/format-changed.sh` runs project formatting for changed files.
- `.claude/harness-mode.sh` toggles local harness mode.
- `.claude/git-autonomy.sh` remains off unless Manuel enables it.
- `.claude/sandbox-mode.sh` remains off unless Manuel enables it.
- `.harness/hooks/guard-git-publish.sh` denies agent-driven `git commit` and `git push`.
- `scripts/verify.sh` is the repo definition of done.

## Commands

- Full verify: `./scripts/verify.sh`
- Backend verify: `vibehopper_be/scripts/verify.sh`
- Harness mode: `.claude/harness-mode.sh auto|manual|status`
- Git autonomy: `.claude/git-autonomy.sh off|commit|push|pr|status`
- Sandbox mode: `.claude/sandbox-mode.sh on|off|status`
- Goals: `.claude/verify-goals.sh`

## Policy

Harness files are local-only. They are ignored through `.git/info/exclude` and must not appear in `git status --porcelain`.

## Deferred

- Frontend harness commands should be added after `vibehopper_fe/` is scaffolded.
- Deployment and database operation skills should be added only after real deployment workflows exist.
