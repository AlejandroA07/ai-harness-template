#!/bin/bash
# harness-mode.sh — switch the AI harness between AUTO and MANUAL.
# Usage: .claude/harness-mode.sh auto|manual|status
#
# AUTO   (default): hooks on, edits auto-accepted, common commands pre-approved,
#                   MCP servers loaded. Max flow, min friction.
# MANUAL: hooks off, every edit and command asks for approval (you see all code
#         and tests before they land), MCP servers unloaded (spares tokens).
#
# Works by rewriting .claude/settings.local.json (machine-local, never in git).
# The stable safety rails — deny rules for secrets/force-push — live in
# .claude/settings.json and ~/.claude/settings.json and are NEVER touched by
# this script: manual mode reduces autonomy, it does not reduce safety.
#
# Takes effect on the next Claude session (restart, or /hooks to re-review).

set -e
cd "$(dirname "$0")/.." || exit 1
MODE_FILE=".claude/settings.local.json"

# EDIT the auto-mode allowlist below: add THIS project's build/test/format
# commands so auto mode doesn't prompt for them.
case "${1:-status}" in
  auto)
    cat > "$MODE_FILE" <<'EOF'
{
  "_harness_mode": "auto",
  "enabledMcpjsonServers": ["playwright", "context7"],
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(docker compose ps:*)",
      "Bash(docker compose logs:*)",
      "Bash(docker compose up:*)",
      "Bash(dotnet build:*)",
      "Bash(dotnet test:*)",
      "Bash(dotnet format:*)",
      "Bash(dotnet restore:*)",
      "Bash(dotnet run --project src/Alfred.Api:*)",
      "Bash(dotnet ef migrations:*)",
      "Bash(pnpm run lint:*)",
      "Bash(pnpm run build:*)",
      "Bash(pnpm run dev:*)",
      "Bash(pnpm install:*)",
      "Bash(scripts/verify.sh)",
      "Bash(./scripts/verify.sh)"
    ]
  }
}
EOF
    echo "Harness mode: AUTO — hooks on, edits auto-accepted, safe commands pre-approved, MCP on."
    ;;
  manual)
    cat > "$MODE_FILE" <<'EOF'
{
  "_harness_mode": "manual",
  "disableAllHooks": true,
  "disabledMcpjsonServers": ["playwright", "context7"],
  "permissions": {
    "defaultMode": "default",
    "allow": []
  }
}
EOF
    echo "Harness mode: MANUAL — hooks off, every edit/command asks first, MCP servers off (token saving)."
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
