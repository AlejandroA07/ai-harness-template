#!/bin/bash
# PreToolUse guard: block `git commit` and `git push` for any agent that honors hooks.
# Manuel performs all commits and pushes himself — this enforces that rule mechanically
# instead of trusting instructions. Reads the hook JSON on stdin, denies when the
# proposed shell command is a commit/push, allows everything else.
set -uo pipefail

input=$(cat)

command=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
tool_input = data.get("tool_input") or data.get("arguments") or {}
print(tool_input.get("command", ""))
' 2>/dev/null) || exit 0

[ -z "$command" ] && exit 0

if printf '%s' "$command" | grep -qE '(^|[;&|`$(]|\s)git(\s+-{1,2}[^ ]+(\s+[^ -][^ ]*)?)*\s+(commit|push)\b'; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "git commit / git push are reserved for the owner. Leave changes in the working tree and summarize them instead."
  }
}
JSON
  exit 0
fi

exit 0
