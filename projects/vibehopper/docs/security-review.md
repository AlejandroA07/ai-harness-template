# Security Review

Last updated: 2026-07-17

## Authentication And Authorization

- Spring authorities use `ROLE_USER` and `ROLE_ADMIN`; method security is enabled.
- Registration creates enabled, unlocked USER accounts and hashes passwords.
- Public anonymous routes are registration, login, `GET /api/csrf`, Swagger/OpenAPI, and event reads.
- Event writes require USER or ADMIN authentication.
- Event creation takes `ownerId` from the authenticated principal.
- Event update/delete use the path ID and require admin-or-owner authorization.
- User management is admin-only under `/api/admin/**`; authenticated users access their own record through `/api/me`.
- JWT validation rejects malformed, expired, invalid, unknown-user, locked, disabled, account-expired, and credentials-expired credentials.
- Authentication and authorization failures use generic structured JSON 401/403 responses.
- Invalid login credentials do not expose whether an account exists.

## CSRF Decision

- The original stateless bearer configuration disabled CSRF globally. CodeQL correctly reported this as a high-severity browser-security risk.
- CSRF is now enabled with `CookieCsrfTokenRepository`.
- `GET /api/csrf` is public and returns the header name plus token while issuing the `XSRF-TOKEN` cookie.
- The token cookie is HttpOnly, SameSite=Strict, and path-scoped to `/`.
- CORS allows the `X-XSRF-TOKEN` request header and only configured frontend origins; credentials are enabled for the token cookie.
- Every unsafe request (`POST`, `PUT`, `PATCH`, `DELETE`) requires the issued cookie and matching header, including registration and login.
- JWT access tokens remain in the `Authorization: Bearer ...` header.
- Tests prove missing-token rejection, public token bootstrap, cookie attributes, and a real bootstrap-cookie-header registration flow.

## Validation And Errors

- Auth and event DTOs use Jakarta validation.
- Duplicate email returns a safe 409 response.
- Missing resources return structured 404 responses.
- Ownership violations and Spring Security denials return structured 403 responses.
- Validation errors return structured 400 responses with field details.
- Test JWT configuration uses a deterministic low-entropy Base64 placeholder so Gitleaks does not mistake it for a production secret.

## Security Automation

- JWT creation and verification use JJWT 0.13.0's current typed signing and parsing APIs.
- CodeQL uses the pinned Node 24-compatible v4 action and runs successfully now that the repository is public.
- The CodeQL CSRF finding from PR #29 is fixed; GitHub currently reports zero open code-scanning alerts.
- Gitleaks scans pull requests and pushes; PR metadata read permission is explicitly granted.
- Local current-tree and full-history Gitleaks scans pass.
- Zizmor reports no workflow findings.
- Dependabot covers Gradle and GitHub Actions.
- No real `.env`, key, token, or signing secret is tracked.

## Deferred Risks

- Access JWTs still last 24 hours and cannot be revoked. Phase 4 replaces this with 15-minute access tokens and rotating, hashed refresh sessions.
- Login and registration are not rate limited.
- Consistent correlation IDs and explicit safe 429/500 responses are not implemented.
- Dependency verification metadata, OSV scanning, wrapper checksum validation, and ArchUnit rules remain later hardening work.
- The local seed still needs conversion to an idempotent repeatable Flyway seed.
- Branch protection and issue cleanup still need confirmation in GitHub settings.

## Phase 1 Security Checklist

| Check | Verdict |
| --- | --- |
| Endpoint authentication requirement | Pass — endpoint policies are unchanged and filter-chain tests cover them. |
| Object-level authorization / IDOR | Pass — existing owner/admin denial tests remain green. |
| Token secret, expiry, and URL handling | Pass with tracked risk — typed HS256 signing remains configuration-backed; 24-hour non-revocable access tokens are replaced in Phase 4. |
| Request payload validation | Not applicable — Phase 1 changes no request contract. |
| Client IDs and enums | Not applicable — Phase 1 changes no client input. |
| File upload controls | Not applicable — no upload endpoint exists. |
| DTO-only responses | Pass — no response mapping changed. |
| Safe client errors | Pass — structured generic security errors remain covered. |
| Secret/PII-safe logging | Pass — no token or personal-data logging was added. |
| Parameterized data access | Not applicable — Phase 1 changes no data access. |
| Output encoding | Not applicable — the backend renders no templates. |
| Redirect allowlisting | Not applicable — no redirect endpoint exists. |
| Auth abuse resistance | Fail, pre-existing — login and registration rate limiting remains required in Phase 4. |
| Verification token controls | Not applicable — verification tokens do not exist. |
| Denied-path regression test | Pass — 401, 403, CSRF, account-state, and ownership denials execute in the normal suite. |

## Phase 2 Security Checklist

| Check | Verdict |
| --- | --- |
| Endpoint authentication requirement | Pass — public event reads remain intentionally anonymous; event writes retain explicit USER/ADMIN rules and CSRF protection. OpenAPI now marks bearer requirements only on protected operations. |
| Object-level authorization / IDOR | Pass — update/delete still enforce owner-or-admin checks, and tests deny a different user's ID. |
| Token secret, expiry, and URL handling | Pass with tracked risk — Phase 2 does not change token handling; configuration-backed HS256 remains in use, while 24-hour non-revocable access tokens remain scheduled for Phase 4. |
| Request payload validation | Pass — create/update strings, collections, capacity, coordinates, page, size, radius, and filter combinations are bounded and tested. Unknown JSON fields are rejected. |
| Client IDs and enums | Pass — event IDs are parsed as UUIDs at persistence, invalid/missing IDs produce safe 404s, and categories/country/day values are constrained enums with structured 400s for invalid values. |
| File upload controls | Not applicable — no upload endpoint exists; image inputs are bounded strings only. |
| DTO-only responses | Pass — summary, detail, create, and update contracts are separate; public payloads omit owner IDs, attendee IDs, external source IDs, and synchronization metadata. |
| Safe client errors | Pass — malformed JSON, invalid types, validation, authorization, conflict, and missing-resource paths use structured errors without parser, SQL, ORM, path, or stack-trace details. |
| Secret/PII-safe logging | Pass — no logging of tokens, secrets, payloads, attendee IDs, or owner IDs was introduced. |
| Parameterized data access | Pass — all filter values use named query parameters; SQL text is assembled only from fixed server-owned clauses. |
| Output encoding | Not applicable — the backend renders no HTML templates and returns JSON DTOs. |
| Redirect allowlisting | Not applicable — no redirect endpoint exists. |
| Auth abuse resistance | Fail, pre-existing — login and registration still need rate limiting in Phase 4. This phase adds no new auth endpoint. |
| Verification token controls | Not applicable — verification tokens do not exist. |
| Denied-path regression test | Pass — the normal suite covers unauthenticated, forbidden, CSRF, account-state, and cross-owner denials. |
