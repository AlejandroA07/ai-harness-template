# Project State

Last updated: 2026-07-17

## Canonical Repository

- GitHub: `AlejandroA07/vibehopper`.
- Visibility: public.
- Local checkout: `/Users/manuelalmeida/vibehopper`.
- The old `/Users/manuelalmeida/socialsyncapi` checkout is not canonical and must not receive new work.
- Backend history from the advanced VibeHopper PostgreSQL/PostGIS lineage was preserved.

## Repository Shape

- `vibehopper_be/`: active Spring Boot 3 / Java 17 backend using PostgreSQL, PostGIS, Flyway, and Gradle.
- `vibehopper_fe/`: placeholder only; no frontend application has been scaffolded.
- `scripts/verify.sh`: root definition-of-done gate.
- Architecture remains a modular monolith with dependencies flowing `infrastructure -> application -> domain`.

## Completed Milestone

PR #29, `Reorganize VibeHopper monorepo and add verification baseline`, merged into `main` on 2026-07-17 as merge commit `eac3938`. GitHub reported all four checks passing.

The merged work consists of:

- `a9e8a4f`: reorganized the preserved backend into `vibehopper_be/`, added the frontend placeholder, root/backend READMEs and verification scripts, Spotless, dependency locks, pinned CI/security workflows, Dependabot, secret scanning, required JWT configuration, and event ownership enforcement.
- `81e82b3`: moved individual user lookup to `/api/admin/users/{id}`, retained `/api/me`, hardened JWT/account-state handling, added structured 401/403 responses, replaced static security assertions with real filter-chain tests, upgraded Testcontainers to `1.21.4`, and made real Postgres/PostGIS tests mandatory with zero skips.
- `565534d`: upgraded CodeQL to the Node 24-compatible pinned v4 action.
- `160e9d4`: resolved CodeQL's high-severity CSRF alert by enabling cookie-backed CSRF protection, adding `GET /api/csrf`, updating CORS and API documentation, and adding real cookie/token flow tests.

GitHub's CodeQL annotation is marked fixed and the repository currently shows zero open security/code-scanning alerts.

## Local Git State

- Local `main` and `origin/main` are synchronized at `eac3938`.
- Phase 1 merged as PR #39; local and remote `main` are synchronized at `64b0287`.
- Current checkout is `api-contract-hardening`, created from that synchronized `main`.

## Verification Snapshot

- `./scripts/verify.sh`: passes.
- Backend tests: 81 passed, zero skipped, zero failures.
- Postgres/PostGIS integration tests execute against Testcontainers-managed PostGIS.
- Spotless: passes.
- Gitleaks current tree: passes.
- Gitleaks Git history: 35 commits scanned, no leaks found.
- Zizmor pedantic workflow scan: no findings.
- `git diff --check`: passes.
- Local docs and harness files do not appear in normal Git status.

## Current Follow-ups

- Phase 2 is ready for Manuel's review on `api-contract-hardening`; it adds the bounded event contract, data-minimized DTOs, strict write validation, and canonical OpenAPI snapshot.
- Phase 1 consolidated the compatible Spring Boot 3.5, Gradle 8, JJWT, springdoc 2, and GitHub Action updates. Spring Boot 4, Gradle 9, and springdoc 3 remain intentionally deferred.
- The GitHub repository description still mentions MongoDB and should be changed to PostgreSQL/PostGIS.
- Confirm `main` branch protection requires pull requests and the CI/security checks while allowing the solo-owner workflow without external approval.
- Review and close GitHub issues already satisfied by PR #29.

## Planned Branches

1. `toolchain-security-baseline` (merged in PR #39)
2. `api-contract-hardening` (ready for review)
3. `frontend-foundation`
4. `auth-session-rotation`
5. `ingestion-pilot`
