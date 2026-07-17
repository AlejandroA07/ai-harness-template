# VibeHopper Roadmap

Last updated: 2026-07-17

## Product Direction

Build a usable web MVP as thin, verified vertical slices. Spring Boot remains the only backend.
The frontend uses Next.js App Router so public event pages can be server-rendered and indexed.

## Phases

| Phase | Branch | Outcome | Status |
| --- | --- | --- | --- |
| 1. Toolchain and security | `toolchain-security-baseline` | Supported, locked backend build and clean security gates | Merged in PR #39 |
| 2. API contract | `api-contract-hardening` | Bounded public event contract and reproducible OpenAPI document | Ready for review |
| 3. Next.js foundation | `frontend-foundation` | Public event search and detail experience | Planned |
| 4. Auth and event management | `auth-session-rotation` | Secure sessions and owner-managed event writes | Planned |
| 5. Ingestion pilot | `ingestion-pilot` | One legal, observable, idempotent event source | Planned |

## Working Rule

- Detail only the active phase; keep later plans as short outlines until their dependencies are complete.
- Start every phase from updated `main` after the prior phase is committed and merged.
- Finish every phase with `./scripts/verify.sh` passing and zero skipped backend tests.
- Manuel owns commits, pushes, merges, and repository-setting changes.

## Next.js Direction

- Next.js 16.2 stable line, React, TypeScript, App Router, Tailwind CSS, ESLint, and Turbopack.
- Generate API types from the backend OpenAPI document with `openapi-typescript`; call it with `openapi-fetch`.
- Add TanStack Query, React Hook Form, and Zod only when authenticated forms need them.
- Keep Spring Boot as the only API. Do not add Next.js Route Handlers or a second backend initially.
