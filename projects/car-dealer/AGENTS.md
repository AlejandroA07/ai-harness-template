# WestcoastCars — Agent Guide

Car-dealer platform: ASP.NET Core (.NET 10) API + server-rendered MVC web app + PostgreSQL, all orchestrated with Docker Compose. This file is the source of truth for AI coding agents (Claude Code, Codex, etc.). Keep it updated when commands or conventions change.

## Architecture (clean architecture — respect the dependency direction)

Dependencies point inward: `Api`/`Web` → `Application` → `Domain`. `Infrastructure` implements `Application` interfaces. Never reference outward (e.g. `Domain` must not reference EF Core).

| Project | Role |
|---|---|
| `WestcoastCars.Domain` | Entities, domain logic. No external dependencies. |
| `WestcoastCars.Application` | Use cases (MediatR handlers), interfaces, FluentValidation validators. |
| `WestcoastCars.Contracts` | DTOs shared between Api and Web. |
| `WestcoastCars.Infrastructure` | EF Core (`WestcoastCarsContext`), Npgsql, migrations, email (MailKit). |
| `WestcoastCars.Api` | REST API. JWT auth + ASP.NET Identity, Swagger, OpenTelemetry. Port 5001. |
| `WestcoastCars.Web` | MVC Razor front end, calls the Api over HTTP. Port 5002. |

Tests: `*.Tests` (unit — xUnit, Moq, FluentAssertions) and `WestcoastCars.Api.IntegrationTests` (Testcontainers PostgreSQL — needs Docker running).

**Do not touch** the lowercase `westcoast-cars.api`, `westcoast-cars.api.tests`, `westcoast-cars.auth`, `westcoast-cars.web` folders — legacy, not in the solution.

## Commands

```bash
# Run everything (Web http://localhost:5002, API http://localhost:5001, Swagger /swagger)
docker compose up --build

# Build & test (excluding external E2E, same filter as CI)
dotnet build --configuration Release
dotnet test --configuration Release --filter "Category!=ExternalE2E"

# Format — CI fails on violations, so run before finishing any change
dotnet format whitespace && dotnet format style --severity info

# Architecture rules (also run as part of plain `dotnet test`)
dotnet test WestcoastCars.ArchitectureTests --configuration Release

# Database only (then run projects natively with `dotnet run --launch-profile http`)
docker compose up db
```

NuGet uses **central package management + lock files** (`Directory.Packages.props`, CI restores with `--locked-mode`). When adding/updating a package: add the version to `Directory.Packages.props`, reference it without a version in the `.csproj`, then run `dotnet restore` so the lock files update — commit them too.

## Database & migrations

EF Core context is `WestcoastCarsContext` in `WestcoastCars.Infrastructure` (migrations live in `WestcoastCars.Infrastructure/Migrations/`).

```bash
dotnet ef migrations add <Name> --project WestcoastCars.Infrastructure --startup-project WestcoastCars.Api
dotnet ef database update --project WestcoastCars.Infrastructure --startup-project WestcoastCars.Api
```

Always inspect the generated migration before applying. Never edit an applied migration — add a new one.

## Secrets & security (non-negotiable)

- Secrets come from `.env` (Docker) or `dotnet user-secrets` (native dev). **Never** read, print, or commit `.env`; never hardcode a secret, connection string, or token in code, tests, or docs.
- `dpkeys/` holds Data Protection keys — never read, modify, or commit it.
- Every new API endpoint needs: an explicit authorization decision (`[Authorize]` with the right policy, or a written justification for `[AllowAnonymous]`), FluentValidation on all input, and error responses that leak no internals (no stack traces, no EF/SQL details).
- Data access goes through EF Core with parameterized queries. No string-interpolated SQL, ever.
- Emails/verification tokens: guest verification and JWT use separate secrets (`GuestVerification__Secret` vs `JwtSettings__Secret`) — keep it that way.

## NEVER (laws — exceptions require asking first)

- Never edit, weaken, or delete a test to make it pass. That is a fail, always.
- Never report work as done from your own assessment. Done = `scripts/verify.sh` exits 0.
- Never add a NuGet package or npm dependency without proposing it first and stopping.
- Never exceed ~200 changed lines in one commit without asking first.
- Never invent a secret, an endpoint, or a convention. Stop and ask.
- Never run `git commit` or `git push` — the owner does both himself. Sole exception: the owner has personally raised `.claude/git-autonomy.sh` above `off` (check `status`); then follow the `git` skill at exactly that level.

## How to work

Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup. Don't design for hypothetical future requirements: do the simplest thing that works well. Only validate at system boundaries.

Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly. If tests fail, say so with the output.

## Definition of done — every change, before you call it finished

Run `scripts/verify.sh` — it is the final vote: Release build, analyzer-warning ratchet (the count may go down, never up), format gates, and the full test suite (incl. architecture tests). All in one command, deterministic.

Additionally:
1. New behavior has new tests.
2. New/changed endpoints pass the security checklist above.
3. Work on a feature branch, never directly on `main`. Small, reviewable commits.

## Conventions

- Branches are `feature/<topic>`, always — including agent-created ones. If your tool defaults to another prefix (`codex/…`), rename with `git branch -m` before pushing (the pre-commit hook blocks AI-tool prefixes).
- C#: nullable reference types are on; keep them meaningful (no `!` to silence warnings). Follow `.editorconfig`.
- New features are vertical slices: Domain entity/logic → Application handler + validator → Infrastructure persistence → Api endpoint → tests at each layer you touched.
- Match the existing MediatR handler + FluentValidation patterns in `WestcoastCars.Application` rather than inventing new ones.
