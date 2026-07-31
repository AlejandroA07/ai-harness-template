---
name: security-checklist
description: Review security-sensitive changes at attacker-reachable boundaries. Use for endpoints, authentication or authorization, untrusted input, uploads, outbound requests, redirects, webhooks, credentials, sensitive data, command execution, filesystem paths, dependencies, or CI security.
---

# Security checklist

Review only applicable sections, but state every verdict as pass, fail, or not applicable. Treat every external boundary as attacker-reachable.

## Access and identity

- Every entry point has an explicit access policy: anonymous with a reason, authenticated, or authenticated plus resource-scoped authorization.
- Object-level authorization is enforced server-side wherever a caller selects a resource. Test another user's or tenant's identifier when IDOR is possible.
- Sessions and tokens use the correct issuer, audience, signing material, expiry, rotation, revocation, and storage behavior. Never place secrets in URLs.
- Password resets, verification links, codes, and other one-time credentials expire, are single-use, and are compared safely.

## Inputs and outputs

- Validate type, length, range, format, cardinality, and nesting at every trust boundary.
- Validate client-provided identifiers and choices against existing, allowed values.
- Use explicit request and response contracts; prevent over-posting and accidental exposure of internal fields.
- Errors expose no stack traces, queries, filesystem paths, credentials, or internal service details.
- Logs exclude secrets, tokens, session identifiers, and unnecessary personal data.

## Injection and navigation

- Database operations are parameterized; no untrusted text is interpolated into queries.
- Commands use argument arrays or strict allowlists; never concatenate untrusted shell input.
- Filesystem operations resolve and constrain paths beneath an approved root; reject traversal and unsafe links.
- Output encoding stays enabled. Any raw HTML is sanitized and justified.
- Redirect destinations are local or allowlisted.

## Browser and network boundaries

- Browser-origin protections match the authentication model: CORS is narrow, cookie authentication has CSRF protection, and cookies use appropriate `Secure`, `HttpOnly`, and `SameSite` settings.
- Server-side outbound requests constrain schemes, hosts, redirects, ports, and private/link-local addresses to prevent SSRF.
- Webhooks verify signatures against the raw body, enforce a replay window, and handle duplicate delivery idempotently.
- HTTPS is enforced in deployed environments and security headers match the application surface.

## Files and abuse

- Uploads have size limits, content and extension allowlists, randomized server-controlled names, malware/content handling appropriate to risk, and cannot be served from attacker-controlled paths.
- Authentication, registration, recovery, verification, and expensive endpoints have rate limits or lockouts appropriate to impact.

## Dependencies and delivery

- New dependencies are necessary, actively maintained, locked, license-compatible, and pass the project's vulnerability gate.
- CI actions are pinned to immutable commits with least-privilege permissions and no credential persistence unless justified.
- Secrets use the approved local and deployed secret stores; no secret is read, printed, committed, or placed in build output.

## Regression evidence

- Tests cover the denied path as well as the happy path wherever access control applies.
- Tests exercise malicious or boundary inputs for each applicable risk above.
- Record unresolved risk explicitly; never turn a failed security item into an undocumented exception.
