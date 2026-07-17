#!/bin/bash
# Stop hook: auto-format changed Java files with the backend Spotless formatter.
# Best-effort by design; verification remains the source of truth.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

changed() {
  { git diff --name-only HEAD -- "$@"; git ls-files --others --exclude-standard -- "$@"; } 2>/dev/null | sort -u
}

java_files=$(changed 'vibehopper_be/src/**/*.java')
if [ -n "$java_files" ] && [ -x vibehopper_be/gradlew ]; then
  (
    cd vibehopper_be || exit 0
    if command -v /usr/libexec/java_home >/dev/null 2>&1; then
      export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
    fi
    ./gradlew --no-daemon spotlessApply >/dev/null 2>&1
  )
fi

exit 0
