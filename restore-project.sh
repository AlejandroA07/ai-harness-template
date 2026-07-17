#!/bin/bash
# restore-project.sh — restore a project's LOCAL-ONLY AI/harness files from its
# snapshot in projects/<name>/ onto a (possibly fresh) clone.
#
# SAFE ORDER (the whole point of this script): exclusions are restored BEFORE the
# local files, so at no moment do AGENTS.md/.claude/... sit in the tree without
# being git-excluded — otherwise a stray `git add .` would stage them all.
#
# Usage: ./restore-project.sh <name> <target-clone-path> [--apply]
#        default is DRY-RUN: prints what would happen, changes nothing.
set -euo pipefail
cd "$(dirname "$0")"

name="${1:?usage: restore-project.sh <name> <target-clone-path> [--apply]}"
target="${2:?usage: restore-project.sh <name> <target-clone-path> [--apply]}"
apply="${3:-}"
src="projects/$name"

[ -d "$src" ] || { echo "FATAL: no snapshot at $src"; exit 1; }
git -C "$target" rev-parse --git-dir >/dev/null 2>&1 || { echo "FATAL: $target is not a git repo"; exit 1; }

run() { if [ "$apply" = "--apply" ]; then "$@"; else echo "DRY-RUN: $*"; fi; }

# 1) exclusions first (git-path is worktree-safe; .git may be a file, not a dir)
exclude_path=$(git -C "$target" rev-parse --git-path info/exclude)
case "$exclude_path" in /*) : ;; *) exclude_path="$target/$exclude_path" ;; esac
if [ -f "$src/.git-local-state/info-exclude" ]; then
  run cp "$src/.git-local-state/info-exclude" "$exclude_path"
else
  echo "WARN: snapshot has no info-exclude — capture it with backup-projects.sh first"
fi

# 2) hooksPath (so the gitleaks pre-commit hook is armed before anything else lands)
if [ -s "$src/.git-local-state/hooksPath" ]; then
  run git -C "$target" config core.hooksPath "$(cat "$src/.git-local-state/hooksPath")"
fi

# 3) the local files themselves (exact mirror of the snapshot's AI/harness set)
run rsync -a \
  --include='AGENTS.md' --include='CLAUDE.md' --include='.mcp.json' \
  --include='.claude/***' --include='.codex/***' --include='.harness/***' \
  --include='.agents' --include='.agents/***' \
  --include='.githooks/***' --include='docs/***' \
  --exclude='*' \
  "$src/" "$target/"

# 4) executable bits on hooks and scripts (find is read-only; chmod is gated)
while IFS= read -r f; do
  run chmod +x "$f"
done < <(find "$target/.githooks" "$target/.claude" "$target/.harness" \( -name '*.sh' -o -name 'pre-commit' \) -type f 2>/dev/null)

# 5) validate: every local-only path must be invisible to git before we call it done
if [ "$apply" = "--apply" ]; then
  fail=0
  for p in AGENTS.md CLAUDE.md .claude .mcp.json .agents .codex .harness .githooks docs; do
    [ -e "$target/$p" ] || continue
    git -C "$target" check-ignore -q "$p" || { echo "FAIL: $p is NOT excluded in $target"; fail=1; }
  done
  leaked=$(git -C "$target" status --porcelain | grep -E 'AGENTS\.md|CLAUDE\.md|\.claude/|\.mcp\.json|\.agents|\.codex|\.harness|\.githooks|^.. docs/' || true)
  [ -n "$leaked" ] && { echo "FAIL: git status sees restored files:"; echo "$leaked"; fail=1; }
  [ "$fail" -eq 0 ] && echo "OK: restore complete, all local-only paths invisible to git." || exit 1
else
  echo "DRY-RUN complete. Re-run with --apply to execute."
fi
