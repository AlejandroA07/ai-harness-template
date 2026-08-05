---
name: grill-with-docs
description: Sharpen a repository-backed plan through a one-question-at-a-time interview while maintaining its domain glossary and durable architectural decisions.
---

Run a `grilling` session using `domain-modeling`.

Read the root `CONTEXT.md` and relevant `docs/adr/` entries first. Look up facts in the repository or trusted sources instead of asking the user. Ask decisions one at a time with a recommendation.

Update `CONTEXT.md` inline only when project-specific terminology is resolved. Offer an ADR only when the decision is hard to reverse, surprising without context, and the result of a real trade-off.

Do not implement. When the decisions are complete, recommend `to-spec` or, for genuinely small work, ask whether the user wants to proceed directly to `implement`.
