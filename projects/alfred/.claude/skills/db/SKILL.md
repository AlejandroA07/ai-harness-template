---
name: db
description: Inspect the local PostgreSQL database (schemas, data, applied migrations, query plans) read-only via the Docker container. Use when debugging data issues, checking what a migration actually did, or answering "what's in the database".
---

# Local database inspection (read-only)

The dev database is the `db` compose service (postgres:17-alpine, container `alfred-db`, database `alfred`, user `alfred`). Start it with `docker compose up -d` if it isn't running.

All access goes through the container — no connection strings needed:

```bash
docker compose exec db psql -U alfred -d alfred -c "<SQL>"
```

## Useful queries

```bash
# Schemas (each module owns one — identity, finance, …)
docker compose exec db psql -U alfred -d alfred -c "\dn"

# Tables in one module's schema
docker compose exec db psql -U alfred -d alfred -c "\dt identity.*"

# Schema of one table (EF quotes identifiers — case-sensitive, double-quote them)
docker compose exec db psql -U alfred -d alfred -c '\d+ identity."AspNetUsers"'

# Applied EF migrations (history table lives in the public schema, shared by all contexts)
docker compose exec db psql -U alfred -d alfred -c 'SELECT "MigrationId" FROM public."__EFMigrationsHistory" ORDER BY 1;'

# Row counts per table across schemas
docker compose exec db psql -U alfred -d alfred -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# Query plan
docker compose exec db psql -U alfred -d alfred -c 'EXPLAIN ANALYZE SELECT ...;'
```

## Rules

- **Read-only by default.** No INSERT/UPDATE/DELETE/DROP/TRUNCATE unless the user explicitly asks — and never against anything but the local dev database.
- Schema changes go through EF migrations (use the `migrate` skill), never direct SQL.
- This is personal life-admin data (finance, reminders) — select only the columns needed to answer the question; never dump user rows wholesale into the conversation.
