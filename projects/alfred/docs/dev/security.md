# Security posture

> Living doc — current, verified auth/security state. Update it when the behaviour changes; don't treat it as a dated log.

The five `## Secrets & security` laws in `AGENTS.md` are always in force and always loaded — this file is the *verified state* behind them, read on demand.

## Current auth posture (verified, not assumed)

- **Registration** is gated by `Identity:InviteCode`, compared in constant time, and fails closed — no configured code means registration is shut, not open. Replaced by real per-person invites when Households lands (M2).
- **Per-account lockout is active**: 5 failed logins lock the account for 5 minutes (ASP.NET Identity defaults, confirmed empirically — `LockoutEnd` gets set). Brute force against one account is already covered; don't re-solve it.
- **Rate limiting**: fixed window over `/api/auth`, 30 req/min per IP, `Identity:AuthRequestsPerMinute`. Sits ahead of authentication so floods die before credential work. Covers what lockout can't — spraying many accounts from one source, and flooding. Caveats: in-memory (per instance — needs shared state if ever scaled out), and one NAT/absent IP shares a bucket (fails closed, never open).
- **Errors**: `ProblemDetails` outside Development; Development keeps the developer exception page on purpose, so local stack traces survive. Note the dev page echoes request headers, session cookie included — fine on localhost, never expose a Development host.
- **Module boundary vs. user identity**: modules never FK into `identity`. The owning user is stored as a plain id string (`UserId`) and every query filters on it in application code — the boundary is held by tests, not the database.

## Known gaps, deliberately open

Don't rediscover these as new findings:

- `MapIdentityApi` maps endpoints as an opaque block, so unused ones (`/forgotPassword`, `/resendConfirmationEmail`, `/refresh`, `/confirmEmail`, `/2fa`) stay exposed. Nothing reachable does damage — no email sender is registered, so the email flows no-op — and all of it is rate-limited. Trimming means hand-writing the endpoints; **do it at M2**, when Households reworks this surface anyway.
- No shared-state rate limiting and no HTTPS/HSTS hardening review yet — both belong to the M6 public-deploy milestone.
