#!/bin/bash
# Stop hook: auto-format every file changed this session so the CI format
# gate never fails on style. Handles .NET (dotnet format) and JS/TS (prettier).
# Best-effort by design — never blocks the agent from finishing (always exits 0).

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

changed() {
  { git diff --name-only HEAD -- "$@"; git ls-files --others --exclude-standard -- "$@"; } 2>/dev/null | sort -u
}

# .NET — only if the repo has a solution or csproj at the root (.slnx = new solution format).
# compgen instead of `ls glob...`: ls exits non-zero if ANY glob is unmatched, which
# silently disabled this whole branch (e.g. .sln present but no root .csproj).
if compgen -G "*.sln" >/dev/null || compgen -G "*.slnx" >/dev/null || compgen -G "*.csproj" >/dev/null; then
  cs_files=$(changed '*.cs')
  if [ -n "$cs_files" ]; then
    # Whole-solution format: `dotnet format --include <list>` silently no-ops on
    # larger lists (observed with dotnet 10.0.201 + slnx), so format everything.
    # Only whitespace + style — exactly what verify.sh/CI gate on. Plain
    # `dotnet format` would also apply analyzer code-fixes (e.g. CA1707
    # renaming test methods), silently changing code beyond formatting.
    dotnet format whitespace --no-restore >/dev/null 2>&1
    dotnet format style --no-restore --severity info >/dev/null 2>&1
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
