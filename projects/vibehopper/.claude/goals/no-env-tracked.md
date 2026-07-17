predicate: ! git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' | grep -q .
born: 2026-07-09
source: harness build - no real .env variant may ever enter git; the committed placeholder .env.example is allowed
status: satisfied
last-pass: 2026-07-17
on-violation: wake the owner immediately; if it ever fails, rotate every secret in the file, then purge from history
