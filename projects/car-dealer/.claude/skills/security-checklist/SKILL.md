---
name: security-checklist
description: Security review checklist for new or changed API endpoints and auth flows. Use before finishing any change that adds/modifies an endpoint, touches authentication/authorization, handles user input, or processes uploads.
---

# Endpoint security checklist

Go through every item and state the verdict explicitly (pass / fail / not applicable). Don't skip items silently.

## Authentication & authorization
- [ ] Endpoint has `[Authorize]` with the correct policy/role, or a written justification for `[AllowAnonymous]`.
- [ ] Object-level authorization: a user can only reach *their own* resources (IDOR check — try another user's id in tests).
- [ ] JWT and guest-verification flows keep using their **separate** secrets; no new code path signs tokens with the wrong one.

## Input validation
- [ ] Every request DTO has a FluentValidation validator covering length, range, and format bounds.
- [ ] IDs and enums from the client are validated against existence/allowed values, not trusted.
- [ ] File uploads (vehicle images): content type + extension allowlist, size limit, randomized stored filename, never served from a path the client controls.

## Data exposure
- [ ] Responses use Contracts DTOs — no Domain entities, no over-posting/over-fetching of fields like password hashes or internal flags.
- [ ] Error responses leak nothing: no stack traces, EF/SQL messages, or file paths (check both Api JSON errors and Web error pages).
- [ ] Logs contain no secrets, tokens, or full personal data.

## Injection & transport
- [ ] All data access via EF Core parameterization — zero string-interpolated SQL.
- [ ] Razor views rely on default HTML encoding; any `Html.Raw` has a documented reason and sanitized input.
- [ ] Redirects only to local/allowlisted URLs (no open redirect from query params).

## Abuse resistance
- [ ] Auth, registration, and email/OTP verification endpoints have rate limiting or lockout consistent with the existing ones.
- [ ] Verification codes/tokens: single-use, expiring, constant-time compared.

## Regression gate
- [ ] At least one test asserts the *denied* path (401/403) for the endpoint, not just the happy path.
