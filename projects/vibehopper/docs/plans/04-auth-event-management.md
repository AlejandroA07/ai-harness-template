# Phase 4: Authentication and Event Management

Status: Planned outline

Branch: `auth-session-rotation`

## Outcome

Add secure browser sessions and owner-managed event creation, editing, and deletion end to end.

## Planned Work

- Replace persistent browser bearer-token storage with in-memory access tokens and rotating,
  hashed refresh tokens in HttpOnly SameSite cookies.
- Add refresh, logout, rotation-reuse detection, abuse controls, and security regression tests.
- Add login, registration, create, edit, and delete interfaces in Next.js.
- Introduce TanStack Query, React Hook Form, and Zod when the authenticated forms require them.

The exact token lifetimes and session schema will be decided after the public UI is complete.
