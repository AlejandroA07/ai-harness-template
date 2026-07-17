# Project Decisions

Last updated: 2026-07-17

## Canonical Source

- `AlejandroA07/vibehopper` is the only canonical repository.
- The advanced VibeHopper PostgreSQL/PostGIS backend lineage was chosen over the older SocialSync/MongoDB checkout.
- Backend Git history was preserved even though historical commits may contain old names.
- `/Users/manuelalmeida/socialsyncapi` is reference-only until it is eventually moved to Trash after a fresh-clone verification.

## Naming And Layout

- Repository and product spelling is `vibehopper` where lowercase repository naming is appropriate.
- The monorepo directories are `vibehopper_be/` and `vibehopper_fe/`.
- Java packages and Spring application naming follow Java conventions under `com.vibehopper` and `VibeHopperApplication`.
- No current project file should use SocialSync naming.

## Architecture

- Preserve the modular-monolith architecture and dependency direction `infrastructure -> application -> domain`.
- Do not create a separate security microservice; authentication remains a module in the monolith.
- Keep event endpoint paths stable until API-contract hardening to avoid combining migration with a broad redesign.
- Frontend work waits for a stable OpenAPI contract and generated client workflow.

## Frontend

- Use Next.js App Router with React and TypeScript instead of Vite and React Router.
- Keep Spring Boot as the only backend; do not add Next.js Route Handlers or a second backend initially.
- Server-render anonymous event discovery and generate frontend API types from OpenAPI.
- Add TanStack Query, React Hook Form, and Zod only when authenticated forms require them.

## Security

- Ownership and source metadata are server-controlled.
- Browser-facing unsafe requests use CSRF protection even while access authentication uses bearer JWTs.
- Future authentication uses short-lived in-memory access tokens plus rotating refresh tokens in HttpOnly, SameSite=Strict cookies.
- Public repository publication was allowed only after current-tree and history secret scans passed; later hardening remains roadmap work.

## Documentation And Harness

- Root/backend READMEs and standard CI/security automation are committed project files.
- `docs/` is private local project memory and is ignored through `.git/info/exclude`, never `.gitignore`.
- AI/harness files remain local-only and must not appear in commits.
- Manuel owns all commits, pushes, merges, and repository-setting changes; Codex leaves verified working-tree changes for review.
