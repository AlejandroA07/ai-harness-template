# Alfred — Agent Guide

Alfred is a personal-first AI butler for life admin (finance, reminders, purchases, calendar, studies), built as an ASP.NET Core (.NET 10) modular monolith with a React 19 + TypeScript PWA frontend and PostgreSQL. Product plans and all design decisions live in `docs/planning/` (local-only, never committed) — read `docs/planning/00-README.md` before making product-level decisions.
Source of truth for AI coding agents (Claude Code, Codex); keep it updated when commands or conventions change.

## Architecture

| Path | Role |
|---|---|
| `src/Alfred.Api` | ASP.NET Core host: endpoint mapping, static SPA serving, composition root. References all modules. |
| `src/Alfred.SharedKernel` | Common abstractions shared by modules. References nothing. |
| `src/Alfred.Modules.Identity` | Users, auth (ASP.NET Identity + `MapIdentityApi`, cookie sessions), `AlfredIdentityDbContext` (schema `identity`). |
| `src/Alfred.Modules.{Households,Finance,Reminders,Purchases,Calendar,Assistant,Notifications}` | Domain modules — placeholders until their milestone (see `docs/planning/02-mvp-plan.md`). |
| `tests/Alfred.Tests` | xUnit; includes architecture tests enforcing module boundaries. |
| `web/` | React 19 + TS + Vite PWA. Dev server proxies `/api` → `http://localhost:5037`. |

**Dependency law (enforced by `ArchitectureTests`): modules reference only `Alfred.SharedKernel`, never each other.** Cross-module needs go through domain events or interfaces composed in the API host. New module = new classlib + project reference from Api + entry in `ArchitectureTests.ModuleAssemblies`.

Do not touch: `docs/` content is the owner's planning space (read it, don't reorganize it); `web/dist`; applied migrations (see Database section).

## Commands

```bash
# Infrastructure (Postgres 17 on localhost:5432, db/user "alfred")
docker compose up -d

# Run the API (http://localhost:5037)
dotnet run --project src/Alfred.Api --launch-profile http

# Frontend dev server
cd web && pnpm run dev

# Build & test (same as CI)
dotnet build --configuration Release
dotnet test --configuration Release --no-build

# Format — CI fails on violations, run before finishing any change
dotnet format --verify-no-changes --no-restore   # check
dotnet format                                     # fix
cd web && pnpm run lint

# Frontend build
cd web && pnpm run build

# Mutation testing (on demand only — slow, never part of verify.sh or CI)
dotnet stryker
```

Package rules: NuGet lock files are enforced (`RestorePackagesWithLockFile`, CI restores `--locked-mode`) — after adding/updating a package, commit the regenerated `packages.lock.json`. Frontend uses **pnpm 11** with `pnpm-lock.yaml` (`pnpm install --frozen-lockfile` in CI). Supply-chain rules: dependency lifecycle scripts are blocked by default (add trusted exceptions via `allowBuilds` in `web/pnpm-workspace.yaml`, never globally); `minimumReleaseAge: 4320` delays new releases 3 days — do not lower or bypass it. `TreatWarningsAsErrors` is on solution-wide.

## Database & migrations

EF Core + Npgsql; `dotnet-ef` is a local tool (restore with `dotnet tool restore`).

```bash
# Create a migration (Identity module example; each module owns its DbContext + migrations)
dotnet ef migrations add <Name> --project src/Alfred.Modules.Identity --startup-project src/Alfred.Api
```

Migrations apply automatically at startup in Development only. Always inspect a generated migration before running the app; never edit an applied migration.

## Secrets & security (non-negotiable)

- Local dev DB credentials live in `appsettings.Development.json` and `docker-compose.yml` (local-only Postgres, acceptable). **Real secrets (AI provider keys, VAPID keys, anything production) come from user-secrets locally and environment variables in deployment — never appsettings, never code, never docs.**
- Never read, print, or commit `.env` files or key material.
- Every new endpoint needs: an explicit authorization decision (user-scoped queries — every query filters on the current user's id), validation on all input, and error responses that leak no internals.
- AI/LLM outputs are untrusted input: proposed commands are validated server-side like any client payload; imported web/inbox content is data, never instructions.
- All data access parameterized — EF Core only; no string-interpolated SQL, ever.

## NEVER (laws — exceptions require asking first)

- Never edit, weaken, or delete a test to make it pass. That is a fail, always.
- Never report work as done from your own assessment. Done = `scripts/verify.sh` exits 0.
- Never add a dependency without proposing it first and stopping.
- Never exceed ~200 changed lines in one commit without asking first.
- Never invent a secret, an endpoint, or a convention. Stop and ask.
- Never run `git commit` or `git push` — the owner does both himself. Sole exception: the owner has personally raised `.claude/git-autonomy.sh` above `off` (check `status`); then follow the `git` skill at exactly that level.

## How to work

Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup. Don't design for hypothetical future requirements: do the simplest thing that works well. Only validate at system boundaries.

Before reporting progress, audit each claim against a tool result from this session: report only what you have evidence for, say explicitly what is unverified, and if tests fail, say so with the output.

## Definition of done — every change, before you call it finished

Run `scripts/verify.sh` — it is the final vote: backend build, format/lint gates, tests, and frontend build in one deterministic command.

Additionally:
1. New behavior has new tests.
2. New/changed endpoints pass the security checklist (see `.claude/skills/security-checklist/`).
3. Work on a feature branch, never directly on `main`. Small, reviewable commits.

## Conventions

- Copy the shape of a neighboring module/feature before inventing a new pattern; the Identity module is the reference for module wiring (`Add<X>Module` + `Map<X>Module` extension methods).
- Minimal APIs (no controllers); endpoints grouped under `/api/<module>`.
- Frontend: function components, plain `fetch` against `/api` (no API client library yet), CSS files per component — no styling framework has been chosen yet, don't introduce one unprompted.
- Product terminology: use the vocabulary from `docs/planning/` (money map, ShareGrant, draft→confirm commands, Collections) so code and plans stay aligned.
