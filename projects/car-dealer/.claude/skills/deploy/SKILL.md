---
name: deploy
disable-model-invocation: true
description: Deploy WestcoastCars to the VPS using the Docker Compose production overlay. Use when the user asks to deploy, release, or update the production/VPS environment.
---

# VPS deployment (Docker Compose overlay)

Production runs `docker-compose.yml` + `docker-compose.deploy.yml`: only `web` is public (port 80), `api` and `db` are internal to the Docker network, `ASPNETCORE_ENVIRONMENT=Production`.

> `railway.md` in the repo root refers to the **legacy** lowercase projects — treat it as historical, not a deploy path.

## Pre-deploy gate (all of it, no exceptions)

1. CI green on the commit being deployed (`main`).
2. `docker compose build` succeeds locally.
3. Any pending EF migrations reviewed — the API applies/needs them against the production DB, so know what schema change ships.
4. `.env` on the VPS has all required values (`POSTGRES_PASSWORD`, `JWT_SECRET`, `GUEST_VERIFICATION_SECRET`, `ADMIN_PASSWORD`, `WEB_BASE_URL`, and the `EMAIL_SMTP_*` set — production **fails fast at startup** if SMTP is blank). File must be `chmod 600`.

## Deploy

On the VPS, from the repo directory:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --build
```

## Post-deploy verification (don't skip)

```bash
docker compose ps                      # all services healthy
docker compose logs api --since 5m     # no startup errors, migrations applied
docker compose logs web --since 5m
```

Then hit the public site and exercise one real flow (e.g. vehicle list loads, login works).

## Rules

- `dpkeys/` on the VPS is the Data Protection key ring — losing it invalidates all sessions. Never delete it; it must survive deployments.
- Never expose `api` or `db` ports in production — the overlay removes them deliberately.
- Rollback = `git checkout <previous-tag-or-sha>` + rerun the same `up -d --build` command. Note: schema migrations don't roll back automatically — if the bad release migrated, decide explicitly (usually roll forward).
