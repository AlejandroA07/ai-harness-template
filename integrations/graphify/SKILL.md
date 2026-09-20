---
name: graphify
description: Build or query a project knowledge graph with the pinned Graphify integration when the user explicitly requests it.
---

# Graphify integration

Use this integration only after the user explicitly asks to build, refresh, or
query a Graphify map. The harness-owned runtime is pinned to `graphifyy==0.9.58`.
Do not run Graphify's own installer: this adapter, its receipt, and the harness
lifecycle own discovery and configuration.

Before executing a Graphify command, confirm the selected target reports both
the approved distribution artifact and an invocable owned runtime. If only the
artifact is provisioned, report that explicit `--materialize --allow-network`
setup with Python 3.10+ is still required; do not resolve or install dependencies
during an unrelated request.

For a first build, prefer code-only local extraction. Keep output project-local
under `graphify-out/` and confirm the project excludes it from version control
unless the user deliberately chooses checked-in graph artifacts.

- Build or refresh only on explicit request. A request to query an existing map
  does not authorize a rebuild.
- Use `query`, `path`, or `explain` for bounded navigation. Verify important edges
  in source; extracted, inferred, and ambiguous edges are not equally strong.
- Query logging is off by default in the pinned release. Enable it only when the
  user chooses an explicit log path and retention policy.
- Semantic documents/media require a separately chosen model backend, disclosed
  network/data boundary, and the user's explicit approval.
- Remote ingestion, database connections, repository cloning, PR/network
  features, model-authored labels, watchers, Git hooks, MCP, cross-project
  graphs, and vendor update checks are separate opt-ins. Do not enable them
  during ordinary installation.
- Never enable or invoke Graphify work memory automatically. Do not call
  `save-result` or `reflect` unless a later reviewed policy explicitly permits it.
- Do not print, persist, or pass through provider credentials except by the
  selected tool's documented environment-variable mechanism.

Report build and query actions separately from configuration and background
activation. Provisioned, configured, invocable, and running are distinct states.
