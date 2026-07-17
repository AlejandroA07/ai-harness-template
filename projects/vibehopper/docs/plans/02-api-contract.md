# Phase 2: API Contract

Status: Ready for review

Branch: `api-contract-hardening`

## Outcome

Freeze the anonymous event-discovery seam needed by the first Next.js slice.

## Public Read Contract

- Replace the unbounded list plus `/search` split with one anonymous endpoint:
  `GET /api/events`.
- Support `city`, `category`, `from`, `to`, `lat`, `lng`, `radiusKm`, `page`, and `size`.
- Use zero-based pages, default size 20, maximum size 100, and maximum page 10,000.
- Require latitude, longitude, and radius together; bound latitude to -90..90, longitude to
  -180..180, and radius to 0.1..500 km.
- Sort non-geographic results by date, start time with nulls last, then ID. Sort geographic
  results by distance before the same deterministic tie-breakers.
- Return `{ items, page, size, totalItems, totalPages }`, with summary DTOs in `items`.
- Keep anonymous `GET /api/events/{id}` and return a separate detail DTO.
- Public DTOs may contain event display/status data, coordinates, attendee count, and source name/
  URL attribution. They must not contain owner IDs, attendee IDs, source external IDs, or sync data.

## Write Contract

- Replace the shared request DTO with explicit `CreateEventRequest` and `UpdateEventRequest`.
- Bound stored strings and list sizes at the HTTP boundary.
- Remove owner, lifecycle, attendee, and source metadata from client-controlled inputs.
- Treat `PUT /api/events/{id}` as full replacement of client-editable fields, including allowing
  zero capacity and clearing nullable fields. Preserve server-controlled ownership, lifecycle,
  attendees, and source metadata.
- Keep event writes authenticated as USER or ADMIN, CSRF-protected, and owner-or-admin scoped for
  update/delete.

## Failure Contract

- Return the existing structured `ApiErrorResponse` for invalid JSON, invalid enums/dates,
  validation failures, incomplete geo parameters, invalid date ranges, not found, conflict,
  unauthorized, and forbidden outcomes.
- Do not expose parser, ORM, SQL, stack-trace, or internal type details.

## OpenAPI Contract

- Generate `vibehopper_be/openapi/vibehopper-api.json` from the real Spring context.
- Canonicalize the document for deterministic review.
- Add an `exportOpenApi` Gradle task for intentional snapshot updates.
- Make the normal test suite fail whenever runtime OpenAPI differs from the committed snapshot.
- Document operation IDs and bearer-auth requirements; anonymous event/auth/CSRF operations must
  not inherit bearer security.

## Verification

- Add controller, use-case, persistence unit, real PostGIS pagination, validation, data-minimization,
  and OpenAPI drift tests.
- Exercise the real event endpoint and inspect status, headers, and JSON shape.
- Finish with the root gate, zero skipped tests, Zizmor, Gitleaks, and `git diff --check` passing.

## Completion Gate

Manuel reviews, commits, pushes, and merges this branch before Phase 3 begins from updated `main`.
