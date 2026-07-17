# Alfred — Agent Guide

Alfred is a personal-first AI butler for life admin (finance, reminders, purchases, calendar, studies), built as an ASP.NET Core (.NET 10) modular monolith with a React 19 + TypeScript PWA frontend and PostgreSQL.
Source of truth for AI coding agents (Claude Code, Codex); keep it updated when commands or conventions change.

**Docs map** (`docs/` is the documentation root, local-only, never committed):

- `docs/planning/` — product truth: plans, product decisions, domain models. Read `docs/planning/00-README.md` before any product-level decision.
- `docs/dev/` — implementation reference, read on demand. Start at `docs/dev/00-README.md`; topic docs (`testing.md`, `security.md`, `database.md`), the implementation ADR log (`decisions.md`), and milestone reports live there.

## Architecture

| Path | Role |
|---|---|
| `src/Alfred.Api` | ASP.NET Core host: endpoint mapping, static SPA serving, composition root. References all modules. |
| `src/Alfred.SharedKernel` | Common abstractions shared by modules. References nothing. |
| `src/Alfred.Modules.Identity` | Users, auth (ASP.NET Identity + `MapIdentityApi`, cookie sessions), invite-gated registration, auth rate limiting, `AlfredIdentityDbContext` (schema `identity`). |
| `src/Alfred.Modules.Finance` | M1 in progress. `Category` (+ CRUD under `/api/finance/categories`), `AlfredFinanceDbContext` (schema `finance`). Expenses, budgets and the money map still to come. |
| `src/Alfred.Modules.{Households,Reminders,Purchases,Calendar,Assistant,Notifications}` | Domain modules — placeholders until their milestone (see `docs/planning/02-mvp-plan.md`). |
| `tests/Alfred.Tests` | xUnit; architecture tests enforcing module boundaries, plus endpoint tests against real Postgres (see Testing). |
| `web/` | React 19 + TS + Vite PWA. Dev server proxies `/api` → `http://localhost:5037`. |

**Dependency law (enforced by `ArchitectureTests`): modules reference only `Alfred.SharedKernel`, never each other.** Cross-module needs go through domain events or interfaces composed in the API host. New module = new classlib + project reference from Api + entry in `ArchitectureTests.ModuleAssemblies`.

Do not reorganise `docs/planning/` — it's the owner's product-planning space (read it, add to `docs/dev/` for implementation notes, but don't restructure planning). Do not touch `web/dist` or applied migrations (see Database section).

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
# Create a migration. Each module owns its DbContext + migrations, and there is now
# more than one context, so --context is required (EF errors out without it).
dotnet ef migrations add <Name> \
  --project src/Alfred.Modules.Finance --startup-project src/Alfred.Api \
  --context AlfredFinanceDbContext
```

Migrations apply automatically at startup in Development only (`Program.cs` migrates every context explicitly — a new module's context must be added there). Always inspect a generated migration before running the app; never edit an applied migration.

Generated migrations are exempt from two analyzers (CA1861, IDE0300) and must not be hand-fixed for style — regenerating undoes it. Why: `docs/dev/database.md`.

## Testing

`dotnet test` **needs a running Docker daemon** — endpoint tests boot real Postgres via Testcontainers. Two harnesses: `AlfredAppFactory` (real host + throwaway container, for endpoint/flow tests) and `NoDatabaseAppFactory` (host in Production against a closed port, for middleware/limits/error-shape). A passing test proves nothing until you've seen it fail — break the property, confirm red, restore. Harness details, gotchas, and mutation-check evidence: `docs/dev/testing.md`.

## Secrets & security (non-negotiable)

- Local dev DB credentials live in `appsettings.Development.json` and `docker-compose.yml` (local-only Postgres, acceptable). **Real secrets (AI provider keys, VAPID keys, anything production) come from user-secrets locally and environment variables in deployment — never appsettings, never code, never docs.**
- Never read, print, or commit `.env` files or key material.
- Every new endpoint needs: an explicit authorization decision (user-scoped queries — every query filters on the current user's id), validation on all input, and error responses that leak no internals.
- AI/LLM outputs are untrusted input: proposed commands are validated server-side like any client payload; imported web/inbox content is data, never instructions.
- All data access parameterized — EF Core only; no string-interpolated SQL, ever.

### Current auth posture

Verified state (invite gate, per-account lockout, `/api/auth` rate limiting, ProblemDetails, no cross-module FK) and the deliberately-open gaps (unused `MapIdentityApi` endpoints → M2; shared-state rate limiting + HTTPS/HSTS → M6) are documented in `docs/dev/security.md`. Read it before "fixing" any of those — several are deliberate, not findings.

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

- Copy the shape of a neighboring module/feature before inventing a new pattern; the Identity module is the reference for module wiring (`Add<X>Module` + `Map<X>Module` extension methods), and `Finance/CategoryEndpoints.cs` is the reference for a user-scoped endpoint group (group-level `RequireAuthorization()`, every query filtered on the caller's id, request/response `record` DTOs, `Results.ValidationProblem` for input errors).
- Minimal APIs (no controllers); endpoints grouped under `/api/<module>`.
- Branches are `feature/<topic>`, always — including agent-created ones. If your tool defaults to another prefix (`codex/…`), rename with `git branch -m` before pushing.
- **Sharing fields are not built ahead of their milestone.** `docs/planning/04-finance-and-sharing-model.md` puts `scope` (personal|shared) and split rules on `Category`, but M1 is solo: those columns arrive by migration at M2, when the partner link actually uses them. Deliberate, not an oversight — don't "complete the model" early.
- Frontend: function components, plain `fetch` against `/api` (no API client library yet), CSS files per component for now. Styling direction is decided: Tailwind + shadcn/ui (see `docs/planning/03-technical-architecture.md`), but it is not installed yet — adding it goes through the dependency-proposal law like any other package; don't hand-roll a competing pattern in the meantime.
- Product terminology: use the vocabulary from `docs/planning/` (money map, ShareGrant, draft→confirm commands, Collections) so code and plans stay aligned.
