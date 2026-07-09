#!/bin/bash
# Stop hook: auto-format every file changed this session so the CI format
# gate never fails on style. Handles .NET (dotnet format) and JS/TS (prettier).
# Best-effort by design — never blocks the agent from finishing (always exits 0).

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

changed() {
  { git diff --name-only HEAD -- "$@"; git ls-files --others --exclude-standard -- "$@"; } 2>/dev/null | sort -u
}

# .NET — only if the repo has a solution or csproj at the root
if ls ./*.sln ./*.csproj >/dev/null 2>&1; then
  cs_files=$(changed '*.cs')
  if [ -n "$cs_files" ]; then
    # shellcheck disable=SC2086  # word-splitting the file list is intentional
    dotnet format --no-restore --severity info --include $cs_files >/dev/null 2>&1
  fi
fi

# JS/TS — only if prettier is a dependency
if [ -f package.json ] && grep -q '"prettier"' package.json 2>/dev/null; then
  ts_files=$(changed '*.ts' '*.tsx' '*.js' '*.jsx' '*.css' '*.json')
  if [ -n "$ts_files" ]; then
    # shellcheck disable=SC2086
    npx prettier --write $ts_files >/dev/null 2>&1
  fi
fi

exit 0
