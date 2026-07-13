---
name: db
description: Inspect the local PostgreSQL database (schema, data, query plans) read-only via the Docker container. Use when debugging data issues, checking what a migration actually did, or answering "what's in the database".
---

# Local database inspection (read-only)

The dev database runs in the `db` compose service (postgres:16, database `westcoast_cars`, user `postgres`). Start it with `docker compose up -d db` if it isn't running.

All access goes through the container — no connection strings or passwords needed:

```bash
docker compose exec db psql -U postgres -d westcoast_cars -c "<SQL>"
```

## Useful queries

```bash
# Tables and sizes
docker compose exec db psql -U postgres -d westcoast_cars -c "\dt+"

# Schema of one table
docker compose exec db psql -U postgres -d westcoast_cars -c "\d+ \"Vehicles\""

# Applied EF migrations (compare with WestcoastCars.Infrastructure/Migrations/)
docker compose exec db psql -U postgres -d westcoast_cars -c 'SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1;'

# Row counts per table
docker compose exec db psql -U postgres -d westcoast_cars -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# Query plan
docker compose exec db psql -U postgres -d westcoast_cars -c 'EXPLAIN ANALYZE SELECT ...;'
```

Note: EF Core quotes identifiers, so table/column names are case-sensitive in SQL — always double-quote them (`"Vehicles"`, not `vehicles`).

## Rules

- **Read-only by default.** No INSERT/UPDATE/DELETE/DROP/TRUNCATE unless the user explicitly asks — and never against anything but the local dev database.
- Schema changes go through EF migrations (use the `migrate` skill), never through direct SQL.
- Don't dump user/personal data into the conversation wholesale; select the columns needed.
