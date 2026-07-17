# VibeHopper Project Notes

## Project Shape

- Monorepo root: `/Users/manuelalmeida/vibehopper`.
- Canonical GitHub repository: public `AlejandroA07/vibehopper`.
- Backend: `vibehopper_be/`, Spring Boot 3, Java 17, Gradle wrapper, PostgreSQL + PostGIS, Flyway migrations.
- Frontend: `vibehopper_fe/`, placeholder only until the backend OpenAPI contract is stable.
- Local-only docs and harness files must stay out of git through `.git/info/exclude`.

## Commands

- Full gate from repo root: `./scripts/verify.sh`.
- Backend gate from repo root: `vibehopper_be/scripts/verify.sh`.
- Backend tests only: `cd vibehopper_be && JAVA_HOME="$(/usr/libexec/java_home -v 17)" ./gradlew --no-daemon test`.
- Formatter check: `cd vibehopper_be && ./gradlew --no-daemon spotlessCheck`.
- Formatter apply: `cd vibehopper_be && ./gradlew --no-daemon spotlessApply`.
- Local app: `cd vibehopper_be && docker compose up -d && ./gradlew bootRun --args='--spring.profiles.active=local'`.
- Docker must be running for verification; Postgres/PostGIS integration tests are mandatory and zero skipped tests are allowed.

## Security Rules

- Public anonymous endpoints: auth register/login, `GET /api/csrf`, Swagger/OpenAPI, and `GET /api/events/**`.
- Every `POST`, `PUT`, `PATCH`, and `DELETE` requires the cookie/header pair issued by `GET /api/csrf`, including registration and login.
- The CSRF cookie is HttpOnly and SameSite=Strict; clients send the returned token in `X-XSRF-TOKEN`.
- Event writes require authenticated `USER` or `ADMIN`.
- Event update/delete must be admin-or-owner only.
- Admin user-management endpoints live under `/api/admin/**`; the current user endpoint is `/api/me`.
- User authorities use Spring role format through `ROLE_USER` and `ROLE_ADMIN`.
- Registered users default to `locked=false` and `enabled=true`.
- JWTs for locked, disabled, expired, or unknown users must be rejected with a generic structured 401.
- Do not commit `.env`, real secrets, tokens, keys, local docs, or harness files.

## Definition Of Done

- `./scripts/verify.sh` exits 0.
- All backend tests execute with zero skips against the Testcontainers-managed PostGIS database.
- `zizmor --pedantic .github/workflows/` has zero findings.
- Gitleaks has no findings for committable files.
- `git diff --check` exits 0.
- `git status --porcelain --ignored=matching docs AGENTS.md CLAUDE.md .claude .mcp.json .githooks .harness .codex` shows these files ignored, not committable.
- No commits or pushes are made by Codex; Manuel commits and pushes.
- Start Phase 2 from an updated `main` on branch `toolchain-security-baseline`.
