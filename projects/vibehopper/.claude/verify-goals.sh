#!/bin/bash
# Re-verify standing goals — invariants that stay true after work is "finished".
# A goal you only verify once is an assumption with a timestamp.
# Usage: .claude/verify-goals.sh          (run manually, or wire into cron later)
# Exit 0 = all hold; exit 1 = at least one VIOLATED (violated files listed).
# Predicates must be cheap, deterministic, read-only (no timeout cmd on macOS).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

LEDGER=".claude/goals/ledger.tsv"
VIOLATIONS=0

for g in .claude/goals/*.md; do
  [ -e "$g" ] || continue
  grep -q '^status: retired' "$g" && continue
  pred=$(grep '^predicate:' "$g" | cut -d' ' -f2-)
  name=$(basename "$g" .md)
  if bash -c "$pred" >/dev/null 2>&1; then
    r=pass
    sed -i '' "s/^status:.*/status: satisfied/; s/^last-pass:.*/last-pass: $(date +%F)/" "$g"
  else
    r=FAIL
    VIOLATIONS=$((VIOLATIONS + 1))
    sed -i '' "s/^status:.*/status: VIOLATED/" "$g"
  fi
  printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$name" "$r" >> "$LEDGER"
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "VIOLATED goals:"
  grep -l '^status: VIOLATED' .claude/goals/*.md
  exit 1
fi
echo "all standing goals hold"
