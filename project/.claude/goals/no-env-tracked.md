predicate: ! git ls-files | grep -qE '(^|/)\.env$'
born: 2026-07-09
source: harness build — .env must never enter git history
status: satisfied
last-pass: never
on-violation: wake the owner immediately; if it ever fails, rotate every secret in the file, then purge from history
