# Collections & Recipes

> Added 2026-07-10 from the recipe use case. Post-MVP module (milestone M7), designed now because it settles an important architectural question: how users get "their own modules" without us building a metadata platform.

## 1. The use case (verbatim intent)

The user creates a space called "Cooking" (or "Kitchen" — their name, their choice). Inside it: recipes. They can

- write a recipe by hand,
- ask the AI for suggestions ("something with chicken and leeks"),
- paste recipe **text**, or paste a **link** — and the AI extracts it into a predetermined recipe format, keeping the source,
- add **notes** to any recipe — and when shared, each note shows **who wrote it**,
- share a recipe (or the whole collection) with the partner via Household, or send it to a specific friend.

## 2. The design: Collections = user-named containers, cards from OUR templates

To the user it feels like creating their own module: they name it, pick an icon, it appears in their navigation. Underneath it is one fixed engine — no metadata platform:

```
Collection
  name ("Cooking"), icon, owner
  cards: [Card]

Card
  template_type: recipe | note | generic     ← fixed registry WE control, grows over time
  content: JSONB blocks per template
  source: manual | ai_suggested | imported_text | imported_url (+ the url)
  notes: [CardNote]

CardNote
  author (user), text, timestamp             ← attribution survives sharing

Recipe template (the first real template):
  title, servings, time
  ingredients[] (amount, unit, item)
  steps[] (ordered)
  tags, source, personal rating
```

- Same building blocks as everything else: JSONB block content (like study-topic sections), draft→confirm for AI-created cards, `ShareGrant` for sharing (collection-level or single card, to household or a specific person). "Sending" a recipe to a friend = a per-person grant; the friend sees it in their Household/Shared area. Out-of-app export (PDF/link) is a later nicety.
- Notes are append-style and attributed, so a shared recipe becomes a tiny collaboration surface ("less salt next time — Maria").
- New template types (book, place, wine, workout…) are **our** code additions to the registry — cheap to add, never user-defined schema. If years from now users truly need custom fields, that's a deliberate future decision, not a default.

## 3. AI import flow

```
User pastes text or URL (or asks for a suggestion)
→ link: fetch page (server-side web fetch — same capability Studies research mode needs)
→ cheap model extracts into the recipe template (structured output)
→ draft card shown with source attached
→ user confirms / edits / discards
```

Commands added in this phase: `create_collection`, `add_recipe` (from text / URL / AI suggestion), `add_card_note`. `share_item` already exists from the Studies phase.

Guardrails: URL fetching is server-side with an allowlist of content types, size limits, and no fetching of private/internal addresses (SSRF protection); imported content is data, never instructions.

## 4. Why this module matters strategically

Recipes are the second consumer (after Studies) of the same four primitives — **JSONB block content, template registry, draft→confirm AI creation, ShareGrant sharing**. If those four serve finance categories, study topics, and recipes without special-casing, the "apply save/plan/learn to anything" vision is proven with a boring, maintainable architecture. Every future module request ("gift ideas", "home maintenance", "wine list") should first be asked: *is this just a Collection template?* Most will be.
