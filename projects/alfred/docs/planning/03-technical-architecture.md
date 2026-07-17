# Technical Architecture

## Stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Backend | **ASP.NET Core, .NET 10 (LTS), C#** | Owner's primary skill. Modular monolith — same architecture the research recommended, .NET flavor. |
| ORM / DB | **PostgreSQL + EF Core (Npgsql)** | Relational for all core domain data; JSONB only for UI preferences and AI draft payloads (per research §24). Free tiers exist; runs in Docker locally. |
| Frontend | **React 19 + TypeScript + Vite**, installable **PWA** | Owner knows TS; best ecosystem for chat/streaming UI; PWA covers phones in phase 1. Styling: **Tailwind + shadcn/ui** (reconfirmed 2026-07-15) — not yet installed; introduce when the first real UI work starts (M1 money map), through the repo's dependency-proposal and pnpm supply-chain rules. Plain CSS per component until then. |
| AI | **Microsoft.Extensions.AI `IChatClient` abstraction** over a swappable provider | No provider lock-in; every major provider (OpenAI, Anthropic, Google, Ollama, OpenRouter) has an `IChatClient` adapter. Provider choice below in §AI design. |
| Background jobs | **Hangfire** (or .NET `BackgroundService` to start) | Reminder scheduling, escalations, daily digest, weekly review generation. Runs inside the monolith — no extra infra. |
| Notifications | **Web Push (VAPID)** | Free, works on installed PWAs incl. iOS 16.4+. |
| Auth | **ASP.NET Identity + `MapIdentityApi`, cookie sessions** (settled 2026-07-15, implemented in M0) | Boring and fine. Invite-code registration **implemented** (2026-07-15): register requires `X-Invite-Code` header, checked constant-time against `Identity:InviteCode` config (`Identity__InviteCode` env in deployment); unset = registration closed. Custom `POST /api/auth/logout` added (`MapIdentityApi` has none). Still open from the day-one baseline: **rate limiting on auth endpoints** — required before any non-local deployment. |

Deliberately absent: microservices, message brokers, Redis, agent frameworks, metadata engines. One deployable unit: the API serves the built SPA as static files → one container.

## Solution layout (modular monolith)

```
Alfred.sln
  src/
    Alfred.Api/            → ASP.NET Core host, endpoints, static SPA
    Alfred.Modules.Identity/
    Alfred.Modules.Households/   (partner link, ShareGrant table — see doc 04)
    Alfred.Modules.Reminders/
    Alfred.Modules.Purchases/
    Alfred.Modules.Finance/      (categories, expenses, split/settlement, savings goals)
    Alfred.Modules.Calendar/
    Alfred.Modules.Assistant/    (Alfred: chat, intent, commands, drafts)
    Alfred.Modules.Notifications/
    Alfred.SharedKernel/         (user context, domain events, common types)
  web/                     → React + TS + Vite PWA
  tests/
```

Each module owns its domain model, use cases (commands/queries), EF configuration, and public API. Modules talk via interfaces or in-process domain events (`MediatR` notifications or plain C# events) — e.g. `PurchaseCreated` → Reminders module schedules the return reminder. Enforce boundaries with project references (module projects don't reference each other's internals) — the .NET equivalent of Spring Modulith.

## AI design

### The core pattern (from the research, unchanged)

```
User text/voice
→ LLM with tool definitions (the 9 MVP commands; see doc 02)
→ Tool call = proposed structured command (a DRAFT, stored in Assistant module)
→ UI renders draft card → user confirms
→ Confirmation executes the normal application use case (same code the manual form uses)
→ Domain event → reminders/notifications react
```

The AI is an input/reasoning layer. Domain modules stay the source of truth and enforce all rules. The AI never writes to domain tables directly.

### Provider strategy: abstract first, choose by testing

**Architecture decision:** all AI calls go through `Microsoft.Extensions.AI`'s `IChatClient` interface (function calling + structured output are part of the abstraction). Provider and model IDs live in configuration. Consequences:

- Switching provider = config change + adapter package, zero domain-code changes.
- We can run classification on the cheapest provider and chat on a better one, independently.
- We can A/B two providers on real usage before committing.

Two jobs, two slots:

1. **Classifier** (inbox triage, entity extraction): tiny prompts, structured output. Any budget model is fine.
2. **Alfred chat** (conversation, planning, tool calls, later web-search research): needs *reliable tool calling* — this is where cheap models fail subtly (wrong dates, malformed args), and a wrong amount/date in a finance app costs trust. Judge by tool-call reliability, not benchmarks.

### Provider options (prices ≈ July 2026, per 1M tokens in/out — re-verify before building)

| Provider / model class | ~Price | Tool calling | Built-in web search | Notes |
|---|---|---|---|---|
| **Google Gemini Flash** (e.g. 3.1 Flash / Flash-Lite) | ~$0.10–0.15 / $0.40–0.60 | Good | Yes (grounding) | Strongest cost/quality for both slots; generous free tier for dev. **Default candidate.** |
| **OpenAI GPT mini/nano tier** (e.g. GPT-5.x Mini) | ~$0.15–0.5 / $1–2 | Good | Yes (Responses API) | Safe mainstream choice; huge .NET ecosystem support. |
| **DeepSeek V3.x** | ~$0.14 / $0.28 | OK | No (needs Tavily/Brave etc.) | Cheapest by far; weaker tooling ecosystem; data goes to a China-based provider — a real consideration for finance data. |
| **Anthropic Claude Haiku 4.5** | $1 / $5 | Very good | Yes (server-side tool) | Classifier or budget-chat slot. |
| **Anthropic Claude Sonnet 5** | $3 / $15 (intro $2/$10 to Aug 2026) | Excellent | Yes | Premium chat slot if tool-call reliability of cheaper models disappoints. |
| **OpenRouter** (meta-provider) | pass-through | varies | No | One API for all of the above — good for A/B testing phase. |
| **Ollama (local)** | $0 | weak-to-OK | No | Free dev/offline mode; also a privacy story ("your data never leaves the server") worth keeping as a supported option. |

### Provider is a USER choice — from options WE wire up (decided 2026-07-10; explicitly NOT bring-your-own-key)

The app holds the provider API keys (server-side secrets, one per wired-up provider). Users never handle keys — they **choose between the options we offer**, and what they consume is metered and surfaces as a cost inside the app.

- **Launch configuration (decided): cheapest + one fallback.** We wire up exactly two options to start — the cheapest capable model (Gemini-Flash-class) as the default for everyone, and one fallback/quality option (e.g. Claude or GPT mini-tier) used when the primary provider errors out or when a user explicitly prefers quality. More options only when the metrics justify them.
- **AI settings page**: pick among the wired-up options (e.g. "Google Gemini — cheapest", "Anthropic Claude — highest quality", possibly presented simply as Economy / Quality tiers). Each option shows a plain-language card: estimated cost at typical usage (from our own logged stats), data/privacy notes (which company processes your text), capability notes ("supports web research for Studies"). We explain risk and cost; the user decides.
- **Usage metering from day one — this is a stated priority.** Every AI request logs user, provider, model, tokens in/out, feature (chat / classification / research); a maintained price table converts tokens to cost. Purpose in the early phase is *learning*: how much each feature is actually used, what a typical user costs per month, which commands the AI gets wrong — the data that later prices the credit system and decides which providers are worth wiring up. Users see their running consumption on the settings page. In the family phase (2–4 users) it's informational only; the owner's provider accounts foot the (tiny) bill.
- **Billing phase (future, past 2–4 users)**: the same meter becomes real in-app cost — most likely **prepaid credits** (user tops up; AI usage draws down the balance) rather than post-hoc invoicing, because the app pays the providers and must never be exposed to unbounded user spend. Whether/how much margin sits on top of raw provider cost is a later product decision; the meter makes it a knob, not a rebuild. Payment rails (Stripe) are post-validation work.
- **Spend protection (required because WE pay the providers)**: per-user daily/monthly token caps with graceful "you've reached your limit" behavior, rate limiting on AI endpoints, and a global monthly budget alarm. These ship with the meter in the family phase already — they protect the owner's wallet too.
- **Fallback**: AI features off → app remains fully functional (every workflow has a manual path).

Implementation: keyed `IChatClient` factory resolves the provider per request from the user's selection; provider keys live only in server config/secret store; a `UsageRecord` table (user, provider, model, tokens in/out, computed cost, timestamp) feeds the settings-page meter, the caps, and any future billing.

**Dev plan unchanged underneath:** develop against Gemini-Flash-class + Ollama locally; measure tool-call reliability per provider at M4 so the offered option list and its cost cards are based on our own data, not marketing.

Cost controls regardless of provider: short context (recent turns + compact user-context block, not full history), provider-side prompt caching where available, per-user caps as above.

### Web search requirement (Studies research mode, M6)

The study-topic flow needs current, citable sources. Gemini, OpenAI, and Anthropic all offer server-side search/grounding tools through their APIs; DeepSeek/local would need a separate search API (Tavily, Brave). This is a selection criterion for the chat slot — one more reason the abstraction matters.

API key handling: server-side only, via user-secrets locally and environment variable in deployment. Never in the repo, never sent to the browser.

### User context / memory

A `user_context` table (or per-user markdown-ish blob to start): goals, priorities, income band if volunteered, preferences. Injected into Alfred's system prompt. User can view/edit/delete it on a settings page — this answers the research's memory-transparency question with the simplest possible mechanism. Fancy memory later.

## Hosting & cost plan

### Phase 1 — self + wife (target: ~$0)
- Run locally / on the home network is fine for week 1, but push notifications and "wife uses it from anywhere" want a real deployment quickly.

### Phase 2 — small deployment (target: €4–6/month)
**Recommended: one Hetzner CX22-class VPS (~€4/mo)** running Docker Compose: the app container + Postgres container + Caddy (automatic HTTPS). Reasons over PaaS free tiers:
- No cold starts / sleeping (Render free sleeps; Railway free credit is tiny).
- Postgres lives next to the app; nightly `pg_dump` to object storage (Backblaze B2 free tier) for backups.
- Fixed, predictable cost; nothing to migrate away from later.

Alternative if zero-ops is preferred: **Railway** (app, ~$5/mo credit-based) + **Neon free tier** (Postgres, 3 GiB) — fine too, slightly less predictable. Azure F1 free tier not recommended (cold starts, quotas, no always-on).

Domain: ~€10/year. Total: ≈ €5/month + LLM usage.

### Scaling path (if it ever becomes a product)
The monolith scales vertically a long way. When/if needed: managed Postgres (Neon/Supabase/RDS), container platform (Fly.io/Azure Container Apps), CDN for the SPA. Nothing in the architecture blocks this; multi-tenancy is already there (every row is user-scoped).

## Mobile / app-store path

1. **Now:** responsive PWA, install banner, Web Push. Covers family + friends.
2. **If store presence is wanted later:** wrap the same React app with **Capacitor** (near-zero rewrite, native push, store-distributable) — preferred over React Native (rewrite) or MAUI (second UI codebase). Costs: Apple Developer $99/year, Google Play $25 one-time, plus review/compliance work (privacy policy, data-deletion flow).
3. Selling it also means: payments (Stripe or store IAP), terms/privacy (GDPR — EU users, personal data: export + delete endpoints should exist early since they're cheap to add now and painful later), and a support channel. All post-validation concerns — noted, not planned.

## Security baseline (from day one)

- All endpoints authenticated + user-scoped queries (no cross-user access by construction: every query filters on `UserId`).
- AI-proposed commands validated server-side like any other input — the LLM is an untrusted client.
- Prompt-injection posture: Alfred's tools only touch the current user's data; no tool can read other users, send email, or reach the network. Inbox text is data, not instructions (system prompt states this; commands still require human confirmation).
- Secrets via env/user-secrets; `.gitignore` covers `.env`, AI tooling files per repo policy.
- HTTPS everywhere (Caddy), secure cookies, rate limiting on auth + AI endpoints.

## Open items (decide later, on purpose)

- Exact sharing/permissions model (post-MVP, with real usage data).
- Whether weekly review becomes proactive notifications (research §20 — configurable proactivity).
- Speech: Web Speech API is fine to start; a server-side Whisper-class STT only if browser STT annoys us.
- When (if ever) to introduce Microsoft Agent Framework: trigger = needing multi-step autonomous workflows or multiple cooperating agents, not before.
