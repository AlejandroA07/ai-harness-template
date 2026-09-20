---
name: archify
description: Create a validated Archify diagram from authored evidence when the user explicitly asks for an architecture or flow visualization.
---

# Archify integration

Use the harness-managed Archify v2.16.0 runtime only when the user explicitly
requests an architecture, workflow, sequence, data-flow, or lifecycle diagram.
Archify validates and renders authored JSON; it does not prove that the authored
relationships were extracted completely from source.

- Prefer a static render. Start preview or motion only when the user asks.
- Keep repository evidence and authored/inferred relationships labeled clearly.
- Validate the typed input before rendering and report validation separately
  from visual review.
- Write only to the explicit render or delivery path. Do not start a persistent server,
  perform an update check, or fetch external assets unless separately approved.
- Use Graphify only as bounded evidence input; verify material relationships in
  source and never present Graphify inference as deterministic Archify evidence.

The harness owns the pinned release archive, discovery adapter, and removal
receipt. Do not use a vendor global installer or overwrite shared settings.
