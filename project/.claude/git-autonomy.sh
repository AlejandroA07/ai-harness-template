#!/bin/bash
# git-autonomy.sh — DORMANT git system: how much git the agent may do in THIS repo.
# Usage: .claude/git-autonomy.sh off|commit|push|pr|status
#
# Levels (cumulative — each includes the previous):
#   off     (DEFAULT, dormant) agent can never commit or push — Manuel does both.
#   commit  agent may branch/stage/commit locally; push stays denied. Manuel reviews & pushes.
#   push    agent may also push feature branches. Bare `git push`, force-push, deleting
#           remote branches, and any push to main stay denied. Manuel merges.
#   pr      agent may also open GitHub PRs (gh pr create). Manuel reviews & merges.
#
# Only Manuel runs this script. The agent-facing procedure and laws for each level
# live in .claude/skills/git/SKILL.md — the skill refuses to act while status is OFF.
#
# Works by rewriting only the git/gh-related permission entries in .claude/settings.json;
# every other entry (secret denies, hooks, ...) is left untouched. It NEVER edits
# ~/.claude/settings.json — while dormant, the global file also denies git commit/push,
# and a deny in ANY settings file always wins, so activation prints the one manual
# global edit that is additionally required. That two-lock design is deliberate.
#
# Takes effect on the next Claude session (restart, or /permissions to re-review).

set -e
cd "$(dirname "$0")/.." || exit 1
SETTINGS=".claude/settings.json"
GLOBAL_SETTINGS="$HOME/.claude/settings.json"
LEVEL="${1:-status}"

case "$LEVEL" in
  off|commit|push|pr|status) ;;
  *) echo "Usage: $0 off|commit|push|pr|status"; exit 1 ;;
esac

if [ "$LEVEL" = "status" ]; then
  python3 - "$SETTINGS" <<'EOF'
import json, sys
data = json.load(open(sys.argv[1]))
print("Git autonomy: " + data.get("_git_autonomy", "off").upper())
EOF
  exit 0
fi

python3 - "$SETTINGS" "$LEVEL" <<'EOF'
import json, sys

path, level = sys.argv[1], sys.argv[2]

# Every git/gh entry this script manages; anything else in settings.json is untouched.
# (Read-only allows like "Bash(git status)" / "Bash(git diff:*)" don't match these prefixes.)
def managed(entry):
    return entry.startswith((
        "Bash(git add", "Bash(git commit", "Bash(git push", "Bash(git switch",
        "Bash(git checkout -b", "Bash(git branch", "Bash(git stash",
        "Bash(git restore --staged", "Bash(git fetch", "Bash(git pull",
        "Bash(git rebase", "Bash(gh pr",
    ))

HISTORY_GUARDS = ["Bash(git commit --amend:*)", "Bash(git rebase:*)"]
PUSH_GUARDS = [
    "Bash(git push)",  # bare push denied: the target branch must always be explicit
    "Bash(git push --force:*)", "Bash(git push -f:*)",
    "Bash(git push --delete:*)", "Bash(git push origin --delete:*)",
    "Bash(git push origin main)", "Bash(git push origin main:*)",
    "Bash(git push -u origin main)", "Bash(git push -u origin main:*)",
]
ALLOW_COMMIT = [
    "Bash(git add:*)", "Bash(git commit -m:*)", "Bash(git switch:*)",
    "Bash(git checkout -b:*)", "Bash(git branch:*)", "Bash(git stash:*)",
    "Bash(git restore --staged:*)",
]
ALLOW_PUSH = ALLOW_COMMIT + [
    "Bash(git push -u origin:*)", "Bash(git push origin:*)",
    "Bash(git fetch:*)", "Bash(git pull --ff-only:*)",
]
ALLOW_PR = ALLOW_PUSH + [
    "Bash(gh pr create:*)", "Bash(gh pr view:*)", "Bash(gh pr list:*)",
    "Bash(gh pr checks:*)",
]

DENY = {
    "off":    ["Bash(git commit:*)", "Bash(git push:*)"],
    "commit": ["Bash(git push:*)"] + HISTORY_GUARDS,
    "push":   HISTORY_GUARDS + PUSH_GUARDS,
    "pr":     HISTORY_GUARDS + PUSH_GUARDS,
}
ALLOW = {"off": [], "commit": ALLOW_COMMIT, "push": ALLOW_PUSH, "pr": ALLOW_PR}

with open(path) as f:
    data = json.load(f)

perms = data.setdefault("permissions", {})
perms["deny"] = [e for e in perms.get("deny", []) if not managed(e)] + DENY[level]
perms["allow"] = [e for e in perms.get("allow", []) if not managed(e)] + ALLOW[level]
data["_git_autonomy"] = level

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
EOF

case "$LEVEL" in
  off)    echo "Git autonomy: OFF — agent can never commit or push (dormant default)." ;;
  commit) echo "Git autonomy: COMMIT — agent may branch/stage/commit locally; push stays denied." ;;
  push)   echo "Git autonomy: PUSH — agent may push feature branches; main/force/delete/bare pushes stay denied." ;;
  pr)     echo "Git autonomy: PR — push level, plus opening GitHub PRs. You review and merge." ;;
esac

if [ "$LEVEL" != "off" ] && grep -qE '"Bash\(git (commit|push):\*\)"' "$GLOBAL_SETTINGS" 2>/dev/null; then
  echo ""
  echo "NOT EFFECTIVE YET: ~/.claude/settings.json still denies git commit/push globally,"
  echo "and a deny in any settings file always wins. To activate for real, remove these"
  echo "two lines from ~/.claude/settings.json yourself (they protect every repo on this"
  echo "machine, so weigh that first — this script never touches the global file):"
  echo '    "Bash(git commit:*)",'
  echo '    "Bash(git push:*)"'
fi

echo "Takes effect on the next Claude session."
