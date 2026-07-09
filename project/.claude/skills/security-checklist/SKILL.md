---
name: security-checklist
description: Security review checklist for new or changed API endpoints and auth flows. Use before finishing any change that adds/modifies an endpoint, touches authentication/authorization, handles user input, or processes uploads.
---

# Endpoint security checklist

Go through every item and state the verdict explicitly (pass / fail / not applicable). Don't skip items silently.

## Authentication & authorization
- [ ] Endpoint has an explicit auth requirement (correct policy/role/middleware), or a written justification for being anonymous.
- [ ] Object-level authorization: a user can only reach *their own* resources (IDOR check — try another user's id in tests).
- [ ] Tokens/sessions: correct signing secret per token type, sensible expiry, no secrets in URLs.

## Input validation
- [ ] Every request payload is validated (length, range, format bounds) with the project's validation library.
- [ ] IDs and enums from the client are validated against existence/allowed values, not trusted.
- [ ] File uploads: content type + extension allowlist, size limit, randomized stored filename, never served from a client-controlled path.

## Data exposure
- [ ] Responses use DTOs — no domain/ORM entities, no over-posting/over-fetching of internal fields.
- [ ] Error responses leak nothing: no stack traces, ORM/SQL messages, or file paths.
- [ ] Logs contain no secrets, tokens, or full personal data.

## Injection & transport
- [ ] All data access parameterized via the ORM/query builder — zero string-interpolated SQL.
- [ ] Output encoding on by default in templates; any raw-HTML escape hatch has a documented reason and sanitized input.
- [ ] Redirects only to local/allowlisted URLs (no open redirect from query params).

## Abuse resistance
- [ ] Auth, registration, and verification endpoints have rate limiting or lockout.
- [ ] Verification codes/tokens: single-use, expiring, constant-time compared.

## Regression gate
- [ ] At least one test asserts the *denied* path (401/403), not just the happy path.
