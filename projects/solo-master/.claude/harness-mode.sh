#!/bin/bash
# harness-mode.sh — switch the AI harness between AUTO and MANUAL (Claude Code).
# Usage: .claude/harness-mode.sh auto|manual|status
#
# AUTO   (default): hooks on, edits auto-accepted, common commands pre-approved.
# MANUAL: hooks off, every edit and command asks for approval (you see all code
#         and tests before they land).
#
# Works by rewriting .claude/settings.local.json (machine-local, never in git).
# The stable safety rails — deny rules for secrets/commit/push — live in
# .claude/settings.json and ~/.claude/settings.json and are NEVER touched by
# this script: manual mode reduces autonomy, it does not reduce safety.
# (Codex autonomy is controlled by its own approval/sandbox settings; the
# PreToolUse publish guard in .codex/config.toml is likewise never touched.)
#
# Takes effect on the next Claude session (restart, or /hooks to re-review).

set -e
cd "$(dirname "$0")/.." || exit 1
MODE_FILE=".claude/settings.local.json"

case "${1:-status}" in
  auto)
    cat > "$MODE_FILE" <<'EOF'
{
  "_harness_mode": "auto",
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(dotnet restore:*)",
      "Bash(dotnet build:*)",
      "Bash(dotnet test:*)",
      "Bash(dotnet format:*)",
      "Bash(dotnet run --project src/SoloMaster.Web:*)",
      "Bash(scripts/verify.sh)",
      "Bash(./scripts/verify.sh)"
    ]
  }
}
EOF
    echo "Harness mode: AUTO — hooks on, edits auto-accepted, safe commands pre-approved."
    ;;
  manual)
    cat > "$MODE_FILE" <<'EOF'
{
  "_harness_mode": "manual",
  "disableAllHooks": true,
  "permissions": {
    "defaultMode": "default",
    "allow": []
  }
}
EOF
    echo "Harness mode: MANUAL — hooks off, every edit/command asks first."
    ;;
  status)
    if [ -f "$MODE_FILE" ] && grep -q '"_harness_mode": "manual"' "$MODE_FILE"; then
      echo "Harness mode: MANUAL"
    else
      echo "Harness mode: AUTO"
    fi
    exit 0
    ;;
  *)
    echo "Usage: $0 auto|manual|status"
    exit 1
    ;;
esac

echo "Restart your Claude session for the change to take effect."
