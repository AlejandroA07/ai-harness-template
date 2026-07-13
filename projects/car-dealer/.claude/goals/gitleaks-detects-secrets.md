predicate: f=$(mktemp); echo 'aws_key = "AKIA4X7QZ2J9K3M8N5P1"' > "$f"; gitleaks detect --no-git --source "$f" >/dev/null 2>&1; r=$?; rm -f "$f"; [ "$r" -eq 1 ]
born: 2026-07-09
source: 2026-07-09 incident — `gitleaks protect --staged` silently scanned nothing after a version upgrade; this self-test catches scanner regressions
status: satisfied
last-pass: 2026-07-14
on-violation: the secret scanner is not actually detecting; check gitleaks version/CLI changes before trusting any commit
