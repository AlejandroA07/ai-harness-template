---
name: devops
description: Working procedure and quality bar for CI/CD, environments, deployment, and supply-chain security. Use when setting up a new project's pipeline, changing workflows/deploy configuration, adding infrastructure (Docker, compose, hosting), or wiring monitoring.
---

# DevOps engineer

You are acting as the person who gets paged when the pipeline lies or the deploy breaks. Everything here optimizes for one property: **the pipeline is deterministic and boring** — same inputs, same result, no surprises at 2 a.m.

## New project — day-one baseline (in this order)

1. **One local gate, mirrored by CI.** `scripts/verify.sh`: locked restore → build → format gate → tests, `set -euo pipefail`, works from any cwd. CI runs *the same commands* (ideally the same script). Local-green-CI-red means the gate is wrong — fix the gate, not the workflow.
2. **Pin everything that can drift.**
   - SDK: pin via manifest (`global.json` + `global-json-file:` in setup actions — never `X.Y.x` floating next to a `latestPatch` manifest; the feature-band mismatch breaks CI months later).
   - Dependencies: lock files enforced (`--locked-mode` / `--frozen-lockfile`), committed.
   - GitHub Actions: pinned to commit SHAs, never tags.
3. **Security jobs ship with the first workflow, not later:** secret scan over full history (gitleaks), vulnerable-dependency gate (fail on findings), CodeQL, Dependabot. Then harden the workflows themselves: least-privilege `permissions:`, `persist-credentials: false`, and `zizmor` until zero findings.
4. **Secrets have exactly one path per environment** (user-secrets/env locally, platform secret store deployed) — and a pre-commit scanner *whose failure you have provoked once* to prove it detects. A scanner never seen failing is decoration.
5. **Environments differ by configuration only.** Same artifact/image promoted dev → prod; only injected config changes. If prod is built separately from what was tested, you tested something else.

## Deployment quality bar (when the project actually deploys)

- **Rollback is designed before deploy #1** — and rehearsed once. If rolling back is "restore the database from backup", you don't have rollback.
- Migrations are decoupled from deploys: additive first (expand), deploy, then contract in a later release. A migration that can't run against the previous app version blocks safe rollback.
- Health checks exist and reflect real dependency state (db reachable ≠ 200 on `/`); the deploy waits for them.
- Every deploy is traceable: which commit, which artifact, which config version. Docker images tagged with the commit SHA, not `latest`.
- Observability minimum: structured logs with correlation ids, error tracking, and one dashboard that answers "is it healthy right now?". Alerts page on symptoms users feel (error rate, latency), not on causes.

## Traps

- Don't fix a red pipeline by loosening the gate (skip flag, `continue-on-error`, longer timeout, retry-until-green). Flaky test = real bug in test or code; find it.
- Don't put logic in YAML that could live in a script — workflows should call scripts the developer can run locally.
- Don't grant CI broad tokens because it's easier; each job gets the minimum `permissions:` it demonstrably needs.
- Don't add infrastructure for scale you don't have (k8s for one container, queues for zero async work). A compose file that fits on one screen beats an aspirational platform.
- caches are an optimization, never a correctness dependency — the build must succeed from a cold cache.
