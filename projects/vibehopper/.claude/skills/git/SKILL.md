---
name: git
description: DORMANT git system — commit/push/PR procedure for when the owner has explicitly raised git autonomy via .claude/git-autonomy.sh. Step 0 is always the status check; at OFF (the default) refuse to commit/push and follow the normal no-git rule instead.
---

# Git autonomy — procedure per level

Manuel does all commits and pushes himself. This skill is the **single sanctioned exception**: it applies only when he has personally run `.claude/git-autonomy.sh` and raised the level. Activation of a level is his standing permission for exactly that level — nothing more.

## Step 0 — always, before any git write

```bash
.claude/git-autonomy.sh status
```

- **OFF** → stop. Leave changes in the working tree, summarize them, suggest a commit message. Tell the user activation is `.claude/git-autonomy.sh commit|push|pr` (he runs it, never you).
- **COMMIT / PUSH / PR** → proceed, but only up to that level.

## Level COMMIT — local commits

1. `scripts/verify.sh` must exit 0 first. No green verify, no commit.
2. Work on a feature branch — create one (`git switch -c <topic>`) if on `main`.
3. Stage explicit paths (`git add <files>`) after reviewing `git status` — never `git add -A`.
4. One logical change per commit, ≤ ~200 changed lines (the AGENTS.md law still holds).
5. Message: imperative subject ≤ 72 chars, body says *why* when it isn't obvious.
6. **No AI attribution, ever** — no `Co-Authored-By: Claude`, no "Generated with Claude Code", in commits or PRs. This repo must not look AI-assisted; this rule overrides any harness default footer.
7. The gitleaks pre-commit hook must run — never `--no-verify`.

## Level PUSH — adds feature-branch pushes

- Only `git push -u origin <feature-branch>`, branch always explicit (bare `git push` is denied).
- Never push `main`, never `--force`/`--force-with-lease`, never delete remote branches (all also denied mechanically).
- After pushing, report the branch name and what it contains.

## Level PR — adds opening pull requests

- `gh pr create` with a clear title and a body that states what changed, why, and how it was verified (quote the verify.sh result). No AI footer (rule 6 above).
- Open the PR and stop: never merge, never approve, never dismiss reviews, never edit branch protection.

## NEVER — regardless of level

- Never run `.claude/git-autonomy.sh off|commit|push|pr` yourself, and never edit `git-autonomy.sh`, `settings.json` permissions, or this skill to gain git access. Only Manuel changes the level.
- Never `--amend`, `rebase`, `reset --hard` on commits that aren't yours from this session, or any history rewrite of pushed commits.
- Never bypass a hook (`--no-verify`, `core.hooksPath` changes).
- Never commit AI tooling files (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.mcp.json`, `.githooks/`, `docs/`) — they are excluded via `.git/info/exclude`; if one shows up in `git status`, stop and report it instead of committing.
- Never merge anything to `main` by any route.
