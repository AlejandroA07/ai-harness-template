#!/bin/bash
# backup-projects.sh — snapshot each live project's LOCAL-ONLY AI/harness files
# into projects/<name>/ inside this private repo, so they have versioned recovery.
# (The projects' committable code is already on GitHub; these files never are —
# AGENTS.md, CLAUDE.md, .claude/, .codex/, .harness/, .githooks/, .mcp.json, docs/.)
#
# Usage: ./backup-projects.sh   — then review `git status` and commit (Manuel).
# Idempotent; --delete keeps each snapshot an exact mirror of the project.
set -euo pipefail
cd "$(dirname "$0")"

REPOS=("$HOME/alfred" "$HOME/car-dealer" "$HOME/solo-master")

# Prerequisite BEFORE touching any snapshot: no scanner, no backup.
command -v gitleaks >/dev/null 2>&1 || {
  echo "FATAL: gitleaks not installed — refusing to snapshot without a secret scan (brew install gitleaks)."
  exit 1
}

for repo in "${REPOS[@]}"; do
  name=$(basename "$repo")
  [ -d "$repo" ] || { echo "skip: $repo not found"; continue; }
  dest="projects/$name"
  mkdir -p "$dest"
  rsync -a --delete \
    --include='AGENTS.md' --include='CLAUDE.md' --include='.mcp.json' \
    --include='.claude/***' --include='.codex/***' --include='.harness/***' \
    --include='.agents' --include='.agents/***' \
    --include='.githooks/***' --include='docs/***' \
    --exclude='*' \
    "$repo/" "$dest/"
  # per-clone activation state (not files in the tree): exclusions + hooksPath
  mkdir -p "$dest/.git-local-state"
  cp "$repo/.git/info/exclude" "$dest/.git-local-state/info-exclude" 2>/dev/null || true
  git -C "$repo" config core.hooksPath > "$dest/.git-local-state/hooksPath" 2>/dev/null || true
  echo "snapshot: $name -> $dest ($(find "$dest" -type f | wc -l | tr -d ' ') files)"
done

# Never snapshot a secret: fail loudly if gitleaks finds anything in the copies.
if ! gitleaks detect --no-git --source projects/ --config .gitleaks.toml >/dev/null 2>&1; then
  echo "BLOCKED: gitleaks found a potential secret under projects/ — fix before committing."
  exit 1
fi
echo "gitleaks: projects/ clean"

echo "Done. Review with 'git status' and commit yourself."
