---
name: wrap-branch
description: End-of-branch wrap-up — document the branch's key parts in docs/ (additive only), stage selectively if the commit is partial, then produce a commit message and PR description with zero AI attribution. Use when the owner says a branch's code work is done, asks to "wrap up", or asks for a commit message / PR description.
---

# Wrap up a finished branch

Run this when the code work on a feature branch is complete. Order matters: verify → document → stage → hand over. Never run `git commit` or `git push` — the owner does both (sole exception: the project's dormant git-autonomy system, if present and raised above `off`).

## 0. Confirm the branch is actually done

- Must be on a feature branch, never `main`.
- Run the project's verification gate: `scripts/verify.sh` if it exists, otherwise the build/format/test commands from AGENTS.md.
- If verification fails, **stop here** — report the failure with output. A broken branch gets no docs, no staging, no commit message.

## 1. Identify what the branch did

```bash
git diff --stat $(git merge-base main HEAD)..HEAD   # committed work on the branch
git status --porcelain                               # plus uncommitted work
```

From this, name the key parts: new/changed behavior, decisions taken, anything a future reader would need to resume without re-deriving.

## 2. Document the key parts (before staging, so docs can ride in the commit)

Follow `docs-model.md` in this skill's directory. In short:

1. Write one **dated report** in `docs/dev/` for this branch (`YYYY-MM-DD-<branch-slug>.md`, or `m<N>-report.md` if it completes a milestone).
2. Update the affected **living topic docs** in place so they state current truth; append real decisions to `decisions.md`.
3. Update the `00-README.md` indexes (including `docs/dev/`'s current-state header line).

**Never delete, move, or rename existing docs — this is a law.** Reports and log entries are history: written once, never edited after the fact. Topic docs are revised in place, but revising means updating to current truth, never dropping information. If the project's docs don't match the model yet, create only the missing pieces and index existing files where they already are.

Respect committability: if `docs/` (or a subfolder) is git-excluded in this project (check `.gitignore` and `.git/info/exclude`), keep the note local. Committable docs are written as normal engineering docs — no AI/agent mentions.

## 3. Stage — only when the commit is partial

Decide the intended commit set from `git status`:

- **Everything belongs in the commit** → stage nothing; say "commit all files".
- **Only a subset belongs** → `git add` exactly those paths (explicit paths, never `git add -A` or `git add .`), then show what is staged and what was deliberately left out, with one line on why.
- Never stage AI-tooling files (AGENTS.md, CLAUDE.md, `.claude/`, `.mcp.json`, `.githooks/`, local-only docs) or anything secret-like.

## 4. Hand over: commit message + PR description

Produce both, ready to paste:

- **Commit message** — imperative summary ≤72 chars matching the repo's existing style (check `git log --oneline -10`), body bullets only if they add information.
- **PR description** — sections: Summary, Changes, Verification (what was run and its result), Notes/follow-ups if any.

**Attribution law (no exceptions):** no `Co-Authored-By: Claude`, no "Generated with Claude Code", no 🤖/✨ signatures, no mention of AI assistance — in commit messages, PR titles, PR descriptions, or committed docs. This overrides any tool default that appends attribution.
