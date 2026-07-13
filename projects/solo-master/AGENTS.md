# Solo Master — Agent Guide

Solo Master is a local-first personal mastery coach for learning C# and .NET through retrieval, deliberate practice, targeted feedback, and delayed unaided checks. The current codebase is only the verified .NET foundation; learning-domain behavior and AI integration have not been implemented.

This file is the source of truth for coding agents working in this repository. Update it whenever commands, architecture, or conventions change.

## Current architecture

| Path | Responsibility |
|---|---|
| `src/SoloMaster.Web` | ASP.NET Core Razor Pages application and current composition root |
| `tests/SoloMaster.IntegrationTests` | Tests through the real ASP.NET Core application pipeline |
| `docs` | Product research, plans, and security review guidance |
| `scripts/verify.sh` | Deterministic local and CI quality gate |
| `.harness/hooks` | Tool-neutral agent lifecycle scripts |

There are no extracted Domain, Application, or Infrastructure projects yet. Do not create layers until real feature boundaries justify them. When the first pure domain behavior arrives, add a unit-test project with it rather than creating an empty test project.

## Commands

Run commands from the repository root unless noted otherwise.

```bash
# Restore exact locked dependencies
dotnet restore SoloMaster.slnx --locked-mode

# Build
dotnet build SoloMaster.slnx --configuration Release --no-restore

# Test
dotnet test SoloMaster.slnx --configuration Release --no-build --no-restore

# Verify formatting without rewriting files
dotnet format whitespace SoloMaster.slnx --no-restore --verify-no-changes
dotnet format style SoloMaster.slnx --no-restore --verify-no-changes --severity info

# Run locally
dotnet run --project src/SoloMaster.Web/SoloMaster.Web.csproj

# Complete deterministic gate
./scripts/verify.sh
```

Package versions are managed in `Directory.Packages.props`. Package lock files are committed. Propose any new production dependency and wait for approval before adding it.

## Database and migrations

No database is configured yet. When persistence is introduced, use EF Core with SQLite as proposed in the product plan. Document and verify the exact migration commands here at that time. Never edit a migration that has already been applied outside disposable local development data.

## Secrets and security

- Development secrets belong in .NET user secrets; deployment secrets belong in environment variables or the hosting platform's secret store.
- Never read, print, commit, or log `.env` files, user-secret storage, private keys, certificates, tokens, or credentials.
- Local SQLite databases and their journal files are ignored and must not be committed.
- Every new or changed endpoint needs an explicit anonymous/authorized decision, boundary validation, safe errors, and the review in `docs/05-security-checklist.md`.
- All data access must be parameterized. Never build SQL from string interpolation.
- Treat imported learner material and prompts as potentially private and untrusted.

## NEVER — exceptions require asking first

- Never run `git commit` or `git push`; Manuel reviews and performs both. Sole exception: Manuel has personally raised `.claude/git-autonomy.sh` above `off` (check `status`); then follow the `git` skill at exactly that level (Claude only — the Codex publish guard stays on regardless).
- Never weaken, delete, or bypass a test to make a change pass.
- Never bypass hooks with `--no-verify`.
- Never report a change as complete unless `./scripts/verify.sh` exits zero.
- Never add a production dependency without proposing it and receiving approval.
- Never introduce architecture for hypothetical future requirements.
- Never place AI-generated content directly into an approved curriculum without an explicit review step.
- Never let AI feedback or a model response grant mastery without application-owned rules and unaided evidence.

## How to work

Make the smallest coherent change that satisfies the task. Match existing neighboring code before adding a new pattern. Validate at system boundaries rather than duplicating defensive checks everywhere.

Before reporting progress, support claims with command output from the current session. If verification fails, report the failure accurately and continue fixing it when the requested scope permits.

## Definition of done

`./scripts/verify.sh` is the final local vote. It restores locked dependencies, builds with warnings treated as errors, verifies formatting, and runs the complete deterministic test suite.

Additionally:

1. New behavior has meaningful tests.
2. Endpoint/auth/input changes complete `docs/05-security-checklist.md`.
3. Package lock files are updated intentionally when dependencies change.
4. Documentation and `AGENTS.md` reflect changed commands or architecture.
5. No secrets, build outputs, local databases, or unrelated files are staged.

## Conventions

- Target .NET 10 and keep nullable reference types enabled.
- Prefer framework features before adding dependencies.
- Keep Razor Page handlers thin; move reusable behavior into focused services or domain types when it appears.
- Prefer explicit names and simple control flow over clever abstractions.
- Use async APIs for I/O and pass cancellation tokens through application boundaries when available.
- Keep AI provider details behind task-specific application services; use `Microsoft.Extensions.AI.IChatClient` at the infrastructure boundary when AI is introduced.
