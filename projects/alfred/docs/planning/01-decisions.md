# Decisions — July 2026 planning session

> Each decision lists the reasoning so future-you doesn't re-litigate it. Nothing here is irreversible, but changing one should require a new reason, not just a new mood.

## D1. The product is Alfred, not a metadata-driven app-builder platform

Two research documents existed:

1. **Alfred** — a personal AI butler for life admin (capture, plan, remind, learn).
2. **AI-Native Metadata-Driven Platform** — a B2B SaaS where an AI customizes a business app per tenant by editing metadata (entities, workflows, dashboards) instead of code.

These are **two different products**. The metadata platform is a company-sized effort (metadata engine, dynamic UI renderer, workflow engine, rules engine, versioning, multi-tenancy) and its own risk section in the Alfred research already warned against it: *"Trying to model 'anything in life' generically before validating concrete scenarios can create unusable abstractions."*

**Decision:** Build Alfred. Do not build the generic platform.

**What we borrow from the metadata doc** (the good ideas, scoped down):

- **UI-as-data, narrowly.** Dashboard layout, module toggles, card order on the Today view, reminder aggressiveness, and theme live in a `user_preferences` JSONB column. That's the entire "metadata engine."
- **"AI modifies the app" = AI edits that preferences record** through the same confirmed-command pattern as everything else ("Alfred, hide the training module and put finance on top" → `update_ui_preferences` command → user confirms). The AI never generates UI code or arbitrary schema.
- **Component registry mindset.** The frontend renders a fixed set of trusted components (cards, lists, charts); configuration chooses which and in what order. No dynamic component generation.
- **Versioned, explainable AI changes.** Every AI-proposed action is a draft the user confirms — already an Alfred principle (§18 of the research).

This gives the owner the feature he actually wanted ("the person or the AI can modify the UX") without building a platform first.

## D2. Verdicts on the shared X posts and tools

### PageAgent (alibaba/page-agent) — not relevant now
A JavaScript in-page GUI agent: drop a script tag into an *existing* web app and users can drive its UI with natural language (it reads the DOM and clicks buttons like a user). Real project, MIT-licensed, built on browser-use.

- It solves the problem of **retrofitting** AI onto a click-heavy app you can't rewrite.
- Alfred is greenfield and AI-first: Alfred calls **application commands directly** (create_reminder, log_expense). Having an AI simulate mouse clicks on our own UI would be slower, more fragile, and less safe than calling our own API.
- Possible future use: accessibility/voice-driving of the manual UI. Park it.

### PixelRAG (StarTrail-org/PixelRAG) — not relevant now
Pixel-native retrieval: index screenshots of pages instead of parsed HTML, retrieve with a vision-language model. Impressive for web-scale RAG/scraping pipelines.

- Alfred's MVP has **no web-scraping or corpus-retrieval need**.
- The "collect all of Aristotle's works" idea belongs to a far-future research/knowledge module; even then, an LLM with web-search/web-fetch tools (built into the Claude API as server-side tools) covers it with zero infrastructure. PixelRAG would only matter if we ever build our own large-scale visual index — we won't.
- Park it. Re-evaluate only if a knowledge module needs bulk ingestion of visually complex documents.

### pi (Mario Zechner) and Hermes (Nous Research) — different category
Both are **agent harnesses**: pi is a minimal terminal *coding* agent (a slim Claude Code alternative); Hermes is a self-hosted personal automation agent ("Claude Code + personal butler + cron daemon" for one technical user).

- Neither is a component you embed in a multi-user product. They are single-user tools that assume the operator trusts them with a machine.
- **Hermes is philosophically interesting** — it's the "personal butler" idea for hackers — worth skimming its skill/memory design for inspiration, but you cannot ship it to your wife and friends as an app.
- **Do we need "an agent"?** Yes, in the plain sense: Alfred is an LLM in a tool-calling loop (intent → propose structured command → confirm → execute → respond). No, in the framework sense: for the MVP a direct tool-use loop via the Anthropic C# SDK (`BetaToolRunner`) is enough. Microsoft Agent Framework (.NET, GA 1.0 since April 2026, successor of Semantic Kernel + AutoGen) is the upgrade path if orchestration ever gets complex (multi-agent, workflows). Start without a framework.

## D3. Stack: .NET, not Java/Spring

The original research assumed PostgreSQL + Spring Boot + Java + React (it came from a conversation that fixed that stack). The owner is a .NET/C#/TypeScript developer.

**Decision:** ASP.NET Core (.NET 10) modular monolith. Everything the research says about Spring Modulith module boundaries translates 1:1 to .NET project/namespace boundaries. Details in `03-technical-architecture.md`.

## D4. Frontend: React + TypeScript PWA, not Blazor

- The owner knows TypeScript; AI-assisted coding is strongest in the React ecosystem; chat/streaming UIs and component libraries are far richer there.
- A responsive, installable **PWA** covers the phone use-case for the family-testing phase (home-screen install, offline shell, web push notifications — supported on iOS since 16.4).
- Blazor would give one language but a weaker mobile feel and smaller ecosystem for this kind of dynamic UI. Revisit only if maintaining TS becomes a real pain.

## D5. Personal-first, private-by-default — refined (2026-07-10)

Personal-first and private-by-default stand. **Amended:** a minimal 2-person Household (partner link) moves INTO the MVP, because the anchor use case (couple's monthly money split) is inherently two-person. Sharing is implemented as one generic mechanism — per-resource `ShareGrant` (resource, grantee = household|person, role) — so "share a finance category with my partner" and "share one study topic with one friend" are the same feature. Full model in `04-finance-and-sharing-model.md`. Broader sharing (goals, events, >2 members, editor roles) stays post-MVP.

## D7. Finance is the anchor module

The product idea originated in the couple's Excel money workflow (categories, shared vs personal costs, monthly share amount + settlement). The MVP is re-ordered finance-first: replacing that spreadsheet is proof #1, Alfred-the-assistant is proof #2. Category-level sharing scope (`personal|shared` with per-expense override) and configurable household split modes (`all_shared | by_category | separate`) are the core design. Details in doc 04.

## D8. AI provider: the user chooses among options WE wire up; usage is metered as in-app cost

Iteration history: (1) Anthropic-only — rejected; (2) app-level config — too static; (3) bring-your-own-key — rejected by the owner: users shouldn't handle API keys. **Final: the app wires up multiple providers with its own server-held keys; each user picks between the offered options** (with plain-language cost + privacy/risk cards), and their consumption is metered per user. Family phase (2–4 users): meter is informational, owner's accounts pay. Future commercial phase: the same meter becomes in-app cost, most likely prepaid credits, with per-user caps and rate limits protecting the app's wallet (which exist from day one). Technically: `IChatClient` keyed factory + `UsageRecord` table. Details in doc 03.

## D9. Stack re-confirmed after considering alternatives

Considered "faster/easier" alternatives to the D3/D4 stack: full-TS Next.js + Supabase (fastest to first demo, but pushes domain logic into a BaaS and abandons the owner's C# strength), Firebase (lock-in, weak relational fit for the finance model — settlements and splits are relational math), Blazor-only (weaker mobile/chat-UI ecosystem). None beats .NET modular monolith + React PWA + Postgres *for this owner and this domain*. Stack stands; revisit only if M0–M1 friction proves otherwise.

## D6. Cost posture

Phase 1 (self + wife + a few friends): target **≈ $0–5/month infrastructure** plus pay-per-use LLM API (expect single-digit dollars/month at this usage). Architecture must not preclude later commercialization (see `03-technical-architecture.md` §Scaling path).

## Explicitly not doing (reaffirmed + new)

Everything in §25 of the original research, plus:

- No metadata/plugin engine, no dynamic entity system, no tenant-customizable schema.
- No PageAgent/DOM-driving agent inside our own UI.
- No scraping/RAG infrastructure.
- No agent framework until a concrete need appears (multi-agent orchestration, complex workflows).
- No native mobile app in phase 1 (PWA instead).
- No bank sync, no email OAuth integration in MVP (paste-in email text is fine).
