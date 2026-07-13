---
name: migrate
description: Safely create and apply an EF Core migration for WestcoastCarsContext. Use whenever a Domain entity or EF configuration changes, or the user asks for a schema change / migration.
---

# EF Core migration workflow

Context: `WestcoastCarsContext`, migrations in `WestcoastCars.Infrastructure/Migrations/`, startup project `WestcoastCars.Api`, PostgreSQL via Docker (`docker compose up db`, localhost:5432).

## Steps

1. Make sure the model change is complete (entity + `IEntityTypeConfiguration` if the project uses one for that entity).
2. Create the migration — name it in PascalCase describing the change:
   ```bash
   dotnet ef migrations add <DescriptiveName> --project WestcoastCars.Infrastructure --startup-project WestcoastCars.Api
   ```
3. **Read the generated migration file before applying.** Check for:
   - Unintended column drops or renames (EF sometimes sees a rename as drop+add — data loss).
   - Missing indexes on new foreign keys or frequently queried columns.
   - Nullability matching the domain model's intent.
4. Apply it to the local database (db container must be running):
   ```bash
   dotnet ef database update --project WestcoastCars.Infrastructure --startup-project WestcoastCars.Api
   ```
5. Run the integration tests — they spin up real PostgreSQL via Testcontainers and will catch broken mappings:
   ```bash
   dotnet test WestcoastCars.Api.IntegrationTests --configuration Release --filter "Category!=ExternalE2E"
   ```

## Rules

- Never edit a migration that is already committed/applied — create a follow-up migration instead.
- If the migration looks wrong, remove it with `dotnet ef migrations remove` (same --project/--startup-project flags) before it's applied, fix the model, and regenerate.
- Destructive changes (dropping columns/tables with data) need an explicit callout to the user before applying.
