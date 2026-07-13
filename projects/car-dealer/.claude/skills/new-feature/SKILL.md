---
name: new-feature
description: Scaffold a new feature as a vertical slice through the clean architecture (Domain → Application → Infrastructure → Api/Web) with tests at each layer. Use when adding any new capability, endpoint, or use case.
---

# New feature — vertical slice checklist

Work inward-out and keep the dependency rule: `Api`/`Web` → `Application` → `Domain`; `Infrastructure` implements `Application` interfaces.

## 1. Domain (`WestcoastCars.Domain`)
- Entity changes or new entity with the invariants enforced in the type itself.
- No EF Core, no infrastructure concerns here.

## 2. Application (`WestcoastCars.Application`)
- MediatR request + handler following the existing handler patterns (look at a neighboring feature first and copy its shape).
- FluentValidation validator for every request that carries user input.
- New external needs (email, storage, …) become interfaces here, implemented in Infrastructure.

## 3. Contracts (`WestcoastCars.Contracts`)
- DTOs for anything crossing the Api boundary. Don't expose Domain entities directly.

## 4. Infrastructure (`WestcoastCars.Infrastructure`)
- EF configuration/repository changes. If the schema changes, use the `migrate` skill.

## 5. Api (`WestcoastCars.Api`)
- Endpoint/controller. **Every endpoint gets an explicit auth decision**: `[Authorize]` with the right policy, or a justified `[AllowAnonymous]`. Then run the `security-checklist` skill on it.
- Wire up Swagger annotations consistently with existing endpoints.

## 6. Web (`WestcoastCars.Web`) — only if the feature has UI
- Controller + Razor view following existing view conventions; the Web app talks to the Api over HTTP, never to the database.

## 7. Tests — not optional
- Unit tests for the handler and validator (`WestcoastCars.Application.Tests`), for domain logic (`WestcoastCars.Api.Tests`/domain-level tests as the existing layout dictates).
- An integration test in `WestcoastCars.Api.IntegrationTests` for the endpoint happy path + at least one authz-denied case.

## 8. Definition of done
Run the full gate from AGENTS.md: Release build clean, all tests green, `dotnet format --severity info` clean.
