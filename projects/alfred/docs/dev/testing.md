# Testing

> Living doc — current truth about how tests are structured here. Update it when the test setup changes, not as a historical log.

`dotnet test` **needs a running Docker daemon** — endpoint tests boot real Postgres via Testcontainers. No Docker, no tests (CI runners have one).

## Two harnesses, picked by what the test needs

- **`AlfredAppFactory`** (`[Collection(AlfredApp.Name)]`) — the real host against a throwaway Postgres container, shared across test classes. `CreateLoggedInClientAsync()` returns a client authenticated through the *real* register+login flow, with its own cookie jar; call it twice for two distinct users. Isolation between tests comes from fresh users, not a fresh database.
- **`NoDatabaseAppFactory`** — the host in Production against a closed port. For anything decided before a handler runs (middleware, limits, error shape), and for provoking a genuine unhandled exception. Production also keeps the developer exception page out of the way.

## Gotchas worth knowing

- **In-process hosting has no client IP**, so every request lands in one rate-limit bucket. `AlfredAppFactory` sets `Identity:AuthRequestsPerMinute` very high because its tests register many users; the limiter has its own tests instead.
- **Minimal APIs only throw on malformed JSON in Development.** In Production they set a bare 400 and no exception is raised — so don't reach for bad JSON to test exception handling; it won't run.
- **A passing test proves nothing until you've seen it fail.** Break the property deliberately (drop the user filter, remove the middleware), confirm red, restore. The user-scoping and hardening tests were all checked this way.

## Mutation-check evidence (2026-07-17)

Every security property added during the API-hardening work was mutation-checked, not assumed:

- Drop the user filter → 3 user-scoping tests fail.
- Remove `UseExceptionHandler` → its ProblemDetails test fails.
- Remove `RequireRateLimiting` → its rate-limit test fails.

Keep doing this for every new security property. Two confident claims were wrong and only testing caught them: per-account lockout turned out to be *already active* (5 failed logins → 5-minute lock, `LockoutEnd` gets set), and minimal APIs only *throw* on bad JSON in Development — so the first ProblemDetails test was probing a case that can't happen in Production.
