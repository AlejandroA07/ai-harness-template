# Phase 5: Ingestion Pilot

Status: Planned outline

Branch: `ingestion-pilot`

## Outcome

Populate VibeHopper from one legally permitted, reliable external event source.

## Planned Work

- Select one source only after confirming permission, data usefulness, and update behavior.
- Implement timeout-bound acquisition, untrusted-input validation, normalization, and attribution.
- Make repeated and concurrent imports idempotent.
- Add retry behavior, structured operational reporting, metrics, and integration tests.
- Add another source only after the first adapter operates reliably.

No generic scraper framework will be built before a concrete source is selected.
