#!/bin/bash
# Best-effort Stop hook for Codex and Claude: format changed C# files.
# The deterministic verification script remains the final gate.
set -uo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root" || exit 0

changed_cs=$(
  {
    git diff --name-only --diff-filter=ACMR -- '*.cs'
    git diff --cached --name-only --diff-filter=ACMR -- '*.cs'
    git ls-files --others --exclude-standard -- '*.cs'
  } | sort -u
)

if [ -z "$changed_cs" ]; then
  exit 0
fi

# Only whitespace + style — exactly what verify.sh/CI gate on. Plain
# `dotnet format` would also apply analyzer code-fixes (e.g. CA1707 renaming
# test methods), silently changing code beyond formatting.
dotnet format whitespace SoloMaster.slnx --no-restore >/dev/null 2>&1 || true
dotnet format style SoloMaster.slnx --no-restore --severity info >/dev/null 2>&1 || true
exit 0
