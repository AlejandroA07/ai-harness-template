predicate: ! git ls-files | grep -qE '(^|/)\.env(\.|$)'
born: 2026-07-09
source: harness build — no .env* variant may ever enter git (strengthened 2026-07-14 from exact-.env only; committed examples are named env.example, no leading dot)
status: satisfied
last-pass: never
on-violation: wake the owner immediately; if it ever fails, rotate every secret in the file, then purge from history
