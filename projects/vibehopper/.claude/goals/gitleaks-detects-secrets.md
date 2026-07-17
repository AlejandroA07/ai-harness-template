predicate: f=$(mktemp); printf 'aws_key = "%s%s"\n' "AKIA4X7QZ2" "J9K3M8N5P1" > "$f"; gitleaks detect --no-git --source "$f" >/dev/null 2>&1; r=$?; rm -f "$f"; [ "$r" -eq 1 ]
born: 2026-07-09
source: 2026-07-09 incident — `gitleaks protect --staged` silently scanned nothing after a version upgrade; this self-test catches scanner regressions
status: satisfied
last-pass: never
on-violation: the secret scanner is not actually detecting; check gitleaks version/CLI changes before trusting any commit
