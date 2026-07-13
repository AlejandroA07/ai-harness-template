---
name: migrate
description: Safely create and inspect an EF Core migration for an Alfred module (each module owns its own DbContext + migrations). Use whenever an entity or EF configuration changes, or the user asks for a schema change / migration.
---

# EF Core migration workflow (per module)

Context: each module owns its DbContext, schema, and migrations (Identity module = `AlfredIdentityDbContext`, schema `identity`, migrations in `src/Alfred.Modules.Identity/Migrations/`). Startup project is always `src/Alfred.Api`. PostgreSQL 17 runs via `docker compose up -d` (db/user `alfred`, localhost:5432). `dotnet-ef` is a local tool — run `dotnet tool restore` if it's missing.

## Steps

1. Make sure the model change is complete in the owning module (entity + configuration).
2. Create the migration — PascalCase name describing the change, `--project` pointing at the **owning module**:
   ```bash
   dotnet ef migrations add <DescriptiveName> --project src/Alfred.Modules.<Module> --startup-project src/Alfred.Api
   ```
3. **Read the generated migration file before running anything.** Check for:
   - Unintended column drops or renames (EF sometimes sees a rename as drop+add — data loss).
   - Missing indexes on new foreign keys or frequently queried columns.
   - The migration staying inside the module's own schema — one module never touches another module's tables.
   - Nullability matching the domain model's intent.
4. Apply it: in Development the API applies migrations at startup, so `dotnet run --project src/Alfred.Api --launch-profile http` is enough. To apply without starting the app:
   ```bash
   dotnet ef database update --project src/Alfred.Modules.<Module> --startup-project src/Alfred.Api
   ```
5. Run the test suite (includes architecture tests that guard module boundaries):
   ```bash
   dotnet test --configuration Release
   ```

## Rules

- Never edit a migration that is already applied/committed — add a follow-up migration (also stated in AGENTS.md; `**/Migrations/*` is a do-not-touch path for existing files).
- If the migration looks wrong and hasn't been applied, remove it with `dotnet ef migrations remove` (same flags), fix the model, regenerate.
- Destructive changes (dropping columns/tables with data) need an explicit callout to the user before applying.
- Cross-module data needs are a design smell — go through domain events/interfaces, not a foreign key into another module's schema.
