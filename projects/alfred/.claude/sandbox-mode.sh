#!/bin/bash
# sandbox-mode.sh — DORMANT OS-sandbox switch for THIS repo (macOS Seatbelt).
# Usage: .claude/sandbox-mode.sh on|off|status
#
# OFF (DEFAULT, dormant): no OS sandbox — permission rules alone bind the agent's tools.
# ON: every subprocess is confined at the OS level — the only layer that survives
#     prompt injection and covers "a script opens the file itself".
#     Config is the one decided in HARNESS-TIERS.md (Tier 1 hardening, 2026-07-12):
#       - docker excluded (incompatible; required for this repo's dev loop — every
#         exclusion is a hole, so keep the list minimal; add "gh *" only if gh breaks)
#       - ~/.ssh and ~/.aws/credentials denied even inside the sandbox
#
# Activate when anything runs less attended than today — it is the prerequisite for
# every Tier 2 loop/schedule. Only Manuel runs this script.
#
# Works by rewriting only the "sandbox" key in .claude/settings.json; every other
# entry (permission denies, hooks, git-autonomy state) is left untouched.
# Takes effect on the next Claude session.

set -e
cd "$(dirname "$0")/.." || exit 1
SETTINGS=".claude/settings.json"
MODE="${1:-status}"

case "$MODE" in
  on|off|status) ;;
  *) echo "Usage: $0 on|off|status"; exit 1 ;;
esac

if [ "$MODE" = "status" ]; then
  python3 - "$SETTINGS" <<'EOF'
import json, sys
data = json.load(open(sys.argv[1]))
enabled = bool(data.get("sandbox", {}).get("enabled"))
print("OS sandbox: " + ("ON" if enabled else "OFF"))
EOF
  exit 0
fi

python3 - "$SETTINGS" "$MODE" <<'EOF'
import json, sys

path, mode = sys.argv[1], sys.argv[2]

with open(path) as f:
    data = json.load(f)

if mode == "on":
    data["sandbox"] = {
        "enabled": True,
        # False so MANUAL mode's ask-every-Bash contract survives sandboxing:
        # the default (true) auto-runs sandboxed Bash without prompting.
        "autoAllowBashIfSandboxed": False,
        "excludedCommands": ["docker *"],
        "credentials": {
            "files": [
                {"path": "~/.ssh", "mode": "deny"},
                {"path": "~/.aws/credentials", "mode": "deny"},
            ]
        },
    }
else:
    data.pop("sandbox", None)

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
EOF

if [ "$MODE" = "on" ]; then
  echo "OS sandbox: ON — subprocesses confined at the OS level; docker excluded, ssh/aws denied."
  echo "Network domains will prompt on first use; deny rules still apply on top."
else
  echo "OS sandbox: OFF — dormant default; permission rules alone bind the agent."
fi
echo "Takes effect on the next Claude session."
