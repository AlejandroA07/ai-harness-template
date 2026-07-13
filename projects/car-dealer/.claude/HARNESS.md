# WestcoastCars — harness operating card (local-only, never committed)

One page quick reference. The **full manual for this repo is `docs/ai-harness.md`** (inventory, toggles table, Codex mapping, status history — kept in sync with `~/dev/ai-harness-template/reference-implementation.md`). Cross-project state matrix: `~/dev/ai-harness-template/HARNESS-PARITY.md`. Last synced: 2026-07-14.

## Operating it

```bash
.claude/harness-mode.sh auto|manual|status   # autonomy dial (deny rules never affected)
.claude/git-autonomy.sh off|commit|push|pr|status   # dormant git system — default OFF, Manuel-only switch
.claude/sandbox-mode.sh on|off|status        # dormant OS sandbox — default OFF, Manuel-only switch
./.claude/verify-goals.sh                    # re-verify the 5 standing goals
./scripts/verify.sh                          # final vote: build + warning ratchet + format + tests
dotnet stryker --project WestcoastCars.Application   # mutation testing, on demand
zizmor .github/workflows/                    # workflow audit (also a standing goal)
```

## Quick facts

- Skills: `migrate`, `new-feature`, `db`, `deploy`, `security-checklist`, `retro`, `git` (dormant) (+ global role skills in `~/.claude/skills/`).
- Guards: deny `.env*`/`dpkeys` reads and **all** `git commit`/`git push` (project + global settings, upgraded 2026-07-12); gitleaks pre-commit (fail-closed since 2026-07-14); format-on-stop hook (whitespace+style only).
- Dormant switches (added 2026-07-14, default OFF): `git-autonomy.sh` + `git` skill; `sandbox-mode.sh`. Only Manuel flips them.
- Warning **ratchet** (not TreatWarningsAsErrors — legacy backlog): count may only go down; baseline in `scripts/warnings-baseline.txt`; promote to TWE when near zero.
- Local-only policy: AI files stay out of git via `.git/info/exclude` (migrated off the committed `.gitignore` 2026-07-14); CI/analyzers/tests are committed (no AI signature).
