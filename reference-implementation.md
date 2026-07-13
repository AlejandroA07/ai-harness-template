# AI Harness — how this repo works with AI coding agents

This document explains the "harness": everything around the AI model that makes vibe coding safe and high quality. It is written tool-agnostically so the same setup works with Claude Code today and Codex (or any other agent) tomorrow.

> **Local-only policy (decided 2026-07-08):** every AI-related file (this doc, `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.mcp.json`, `.githooks/`) stays out of git — ignored via `.gitignore` and `.git/info/exclude` — so the repo carries no AI signature. Only the neutral security CI files (CodeQL, Dependabot, gitleaks job) are candidates for committing. Manuel does all commits and pushes himself.

## The idea

You don't review every line an AI writes — so the harness has to. It does that with three layers:

1. **Context** — files that teach the agent the project, so every session starts knowing the architecture, commands, and rules.
2. **Guardrails** — rules the *tooling* enforces (the agent can't read secrets, can't skip hooks, can't force-push), so safety doesn't depend on the model behaving.
3. **Verification** — automated proof (tests, format check, security scanners, CI) that runs regardless of who — human or AI — wrote the code.

## Inventory — what each file does

| File | Layer | Purpose |
|---|---|---|
| `AGENTS.md` | Context | **Source of truth.** Architecture, commands, security rules, definition of done. Read natively by Codex, Cursor, and others. |
| `CLAUDE.md` | Context | Claude Code's entry point — just imports `AGENTS.md` (`@AGENTS.md`) plus Claude-only notes. Never duplicate content here. |
| `.claude/settings.json` | Guardrails | Claude permissions: denies reading `.env`/`.env.*`/`dpkeys/`, and **all** `git commit`/`git push` (upgraded 2026-07-12 from force-push/no-verify only — the owner publishes himself, now mechanically enforced). Registers hooks. (The convenience allowlist lives in `settings.local.json`, managed by the mode switch below.) |
| `.claude/harness-mode.sh` | Guardrails | **Autonomy switch**: `auto` = hooks on, edits auto-accepted, safe commands pre-approved, MCP on. `manual` = hooks off, every edit/command asks first (full visibility), MCP unloaded (spares tokens). Deny rules are untouched in both modes. |
| `.claude/git-autonomy.sh` + `.claude/skills/git/` | Guardrails | **Dormant git system, default OFF** (added 2026-07-13): graduated levels `commit` (local commits, feature branches only) → `push` (feature branches; main/force/delete/bare pushes stay denied) → `pr` (may open PRs, never merge). Rewrites only the git entries in `settings.json`; the global deny is a second lock the script warns about but never edits. Only the owner flips it; the skill refuses at OFF. See HARNESS-TIERS.md §2.8. |
| `.claude/sandbox-mode.sh` | Guardrails | **Dormant OS-sandbox switch, default OFF** (added 2026-07-13): `on` writes the Seatbelt config from HARNESS-TIERS.md (docker excluded, ssh/aws denied) into `settings.json`; prerequisite for any Tier 2 loop/schedule. Owner-only. |
| `.claude/hooks/format-changed.sh` | Guardrails | Runs automatically when Claude finishes a turn: formats every changed `.cs` file so CI's format check can't fail. |
| `.claude/skills/` | Context | Reusable playbooks: `migrate` (EF Core), `new-feature` (vertical-slice scaffolding), `security-checklist` (endpoint review), `db` (read-only inspection), `deploy`, `retro` (weekly compost). Plain markdown — readable by any tool. Cross-project *role* skills (web-designer, backend/fullstack-engineer, devops, architecture-designer) live in `~/.claude/skills/`. |
| `.githooks/pre-commit` | Guardrails | Blocks any commit containing a secret (gitleaks). Works for humans, Claude, and Codex alike since it's plain git. |
| `.mcp.json` | Verification | Playwright MCP server — lets the agent drive the real web UI (http://localhost:5002) in a browser to prove a change works. |
| `.github/workflows/ci.yml` | Verification | Format check, vulnerable-package check, build, tests + coverage, docker build, **gitleaks history scan**. |
| `.github/workflows/codeql.yml` | Verification | GitHub's static security analysis for C# (security-extended queries), on PRs and weekly. |
| `.github/dependabot.yml` | Verification | Weekly dependency update PRs for NuGet, GitHub Actions, and Docker base images. |
| `~/.claude/settings.json` (global) | Guardrails | Machine-wide denies for every project: `.env`/`.env.*` files, SSH/AWS keys, certificates, and all `git commit`/`git push` (a user-level deny beats any project allow); `disableBypassPermissionsMode` self-locks bypass mode out (both added 2026-07-12). |
| `WestcoastCars.ArchitectureTests/` | Verification | NetArchTest tests that fail if any code violates the clean-architecture dependency rule (e.g. Application referencing Infrastructure). Runs with the normal test suite. |
| `Directory.Build.props` + `Directory.Packages.props` (analyzers) | Verification | .NET analyzers (`AnalysisLevel latest-recommended`) + SonarAnalyzer.CSharp on every build — compile-time review incl. security rules. Noisy low-value rules demoted in `.editorconfig`. |
| `dotnet-tools.json` | Verification | Local tool manifest with Stryker.NET (mutation testing, run on demand). |
| Workflow hardening | Guardrails | All GitHub Actions pinned to commit SHAs, `persist-credentials: false` on checkouts, least-privilege `permissions:` — zizmor reports zero findings. |
| `scripts/verify.sh` + `scripts/warnings-baseline.txt` | Verification | **The final vote** (git-visible, AI-neutral): Release build + warning **ratchet** (count may go down, never up; baseline tightens itself) + both format gates + full test suite, one deterministic command. AGENTS.md defines "done" as this exiting 0. |
| `.claude/goals/` + `.claude/verify-goals.sh` | Verification | **Standing goals**: invariants re-verified on demand, each a cheap shell predicate (hooks path active, no `.env` tracked, gitleaks self-test, zizmor clean, architecture rules). History in `goals/ledger.tsv`. Run manually; cron-ready if ever wanted. |
| `.claude/skills/retro/` | Context | Weekly-ish "compost": mines goal-ledger/CI/git failures for ≤3 proposed harness improvements. Propose-only — the owner signs off. |

## One-time setup (new machine or new clone)

```bash
brew install gitleaks gh          # secret scanner + GitHub CLI
git config core.hooksPath .githooks   # activate the pre-commit secret scan (per clone)
```

The Playwright MCP server needs Node (installed via Homebrew here); Claude Code starts it automatically from `.mcp.json` — approve it when prompted on first session.

## The vibe-coding workflow

The loop that keeps quality high without reading every diff:

1. **Plan first.** For anything nontrivial, start in plan mode (Claude: Shift+Tab) and review the plan — steering before code exists is 10× cheaper than after.
2. **Branch always.** Feature branches, never direct to `main`. Small PRs.
3. **Let the agent verify itself.** In Claude: `/verify` (exercises the change end-to-end, using Playwright for UI), then `/code-review`, then `/security-review` before the PR.
4. **CI is the judge.** Merge only on green. The agent can be sweet-talked; CodeQL, gitleaks, and the test suite cannot.
5. **Feed learnings back.** When the agent gets something wrong twice, the fix is a sentence in `AGENTS.md`, not a repeated correction.

## Using this harness with Codex

`AGENTS.md` and everything in git (`.githooks`, CI, dependabot) work with Codex as-is. Only the Claude-specific pieces need a translation:

| Claude Code | Codex equivalent |
|---|---|
| `CLAUDE.md` → imports `AGENTS.md` | Reads `AGENTS.md` natively (repo root, plus `~/.codex/AGENTS.md` for global notes) — nothing to do. |
| `.claude/settings.json` permissions | `~/.codex/config.toml`: `approval_policy` + `sandbox_mode` (e.g. `workspace-write` sandbox ≈ the deny rules). Codex sandboxes by default rather than using per-path rules. |
| `.claude/hooks/format-changed.sh` | No hook system — the pre-commit hook and CI format check are the backstop; also add "run `dotnet format` before finishing" to `AGENTS.md` (already there via definition of done). |
| `.claude/skills/*/SKILL.md` | Custom prompts: copy each SKILL.md body to `~/.codex/prompts/<name>.md`, invoke with `/<name>`. Or just tell Codex to "follow .claude/skills/migrate/SKILL.md" — it's plain markdown. |
| `.mcp.json` | Codex supports MCP too: add the Playwright server under `[mcp_servers.playwright]` in `~/.codex/config.toml`. |
| `/security-review`, `/code-review` | No built-in equivalents — paste the `security-checklist` skill as the review prompt, and rely on CodeQL + PR review. |

## Reusing this in other projects (including TypeScript/React ones)

> **There is now a ready-made starter kit: `~/dev/ai-harness-template/`** — generic skeleton files, `BOOTSTRAP.md` (apply to any project, AI-executable), `MACHINE-SETUP.md` (rebuild a fresh machine), and a copy of this manual. Prefer it over doing the list below by hand.

Copy the pattern, not the files:

1. `AGENTS.md` with that project's real commands and architecture.
2. `CLAUDE.md` = `@AGENTS.md`.
3. `.claude/settings.json` deny rules for that project's secret files (the global `~/.claude/settings.json` already covers `.env`, keys, SSH).
4. `.githooks/pre-commit` + gitleaks — identical, it's stack-agnostic.
5. For Vite/React/TS projects, the verification layer becomes: `tsconfig` `strict: true`, ESLint (`typescript-eslint` + `eslint-plugin-security`), Prettier, Vitest, and Playwright for E2E. The format hook runs `prettier --write` instead of `dotnet format`.
6. CodeQL: add `javascript-typescript` to the `languages` list.

## Notes and memory (Obsidian / Engram)

Recommended split — one system per audience:

- **Project knowledge the AI needs** → `AGENTS.md` (and skills). In git, versioned, every tool reads it.
- **Cross-session memory about you and ongoing work** → Claude Code's built-in memory (automatic, per-project). Engram is redundant with this; recommended to drop unless it does something specific you rely on.
- **Your own thinking, learning notes, ideas** → Obsidian. Keep it human; don't wire it into the agents.

## Current status (updated 2026-07-09)

Everything below is done and verified:
- [x] AGENTS.md + CLAUDE.md; skills: `migrate`, `new-feature`, `security-checklist`, `deploy`, `db`
- [x] Project + global permission deny rules; format-on-stop hook (tested end-to-end)
- [x] gitleaks + gh installed via Homebrew; `.githooks/pre-commit` active (`core.hooksPath` set)
- [x] Architecture tests: `WestcoastCars.ArchitectureTests`, 5 tests, all green
- [x] Analyzers: `AnalysisLevel latest-recommended` + SonarAnalyzer.CSharp — build succeeds, ~209 pre-existing warnings surfaced for gradual cleanup (CA1707/CA1848 demoted as noise); CI format gate split into `whitespace` + `style` so it stays green
- [x] MCP servers: Playwright + Context7 in `.mcp.json`
- [x] Stryker.NET installed as local dotnet tool (`dotnet-tools.json`)
- [x] zizmor installed; all workflows fixed until **zero findings** (SHA-pinned actions, `persist-credentials: false`, least-privilege permissions)
- [x] CI: gitleaks job, `codeql.yml`, `dependabot.yml`

Pending (Manuel):
- [ ] Approve Playwright + Context7 MCP servers on the next Claude session
- [ ] Commit the git-visible changes (CI workflows, dependabot, ArchitectureTests, build props, .editorconfig, dotnet-tools.json, lock files)
- [ ] Gradually burn down the ~209 analyzer warnings; when near zero, consider `TreatWarningsAsErrors`

## Status addendum (2026-07-12) — harness review across all three projects

A full cross-project audit leveled the guardrails and gates everywhere; this manual stays the *concepts* reference, and the current per-project state lives in the newer template docs:

- **`HARNESS-PARITY.md`** — component matrix (alfred / car-dealer / solo-master): what's leveled, what's a justified difference, which proposals were approved and applied (alfred coverage CI + Stryker; solo xunit.v3).
- **`HARNESS-TIERS.md`** — Tier 1 (active, Pro plan) vs Tier 2 (dormant machinery: loops, schedules, maker/checker, fleets, OS sandbox) with activation conditions and setup guides.
- **`RESEARCH-REVIEWS.md`** — external ideas + official-docs findings: what was adopted (global commit/push denies, `disableBypassPermissionsMode`, vuln gates), recorded (sandbox recipe), or rejected (Mira, "model-brain extraction").
- **`GUIDE-what-goes-where.md`** — the knowledge-encoding ladder (model / analyzers / AGENTS.md / skills / live docs) and the admission test that keeps the harness lean.
- **`BOOTSTRAP.md` §Lessons** — eight real mistakes from an AI-performed bootstrap, now guarded against.
- Each project carries a one-page operating card at `.claude/HARNESS.md` (local-only): its inventory, mode switch, goals, and skills.

## Autonomy modes — the master dial (added 2026-07-09)

One command flips the whole harness between full-flow and full-control (takes effect next Claude session):

```bash
.claude/harness-mode.sh auto     # vibe mode: hooks, auto-accepted edits, pre-approved commands, MCP on
.claude/harness-mode.sh manual   # control mode: no hooks, every edit & command asks first, MCP off (fewer tokens)
.claude/harness-mode.sh status
```

What MANUAL gives you: you see and approve **every** file edit and command before it happens (so you can read all produced code and tests as they land), nothing runs automatically in the background, and unloading the MCP servers trims their tool definitions from the context — the token saving you asked for. What it never changes: the deny rules (secrets, force-push) — less autonomy, never less safety.

Mid-session, `Shift+Tab` also cycles permission behavior (plan mode ⇄ normal ⇄ accept-edits) without touching any files — use that for a quick one-session change, and the script when you want the mode to stick.

## Toggles — turning each piece on and off

| Component | Turn OFF | Turn back ON |
|---|---|---|
| **Everything autonomous at once** | `.claude/harness-mode.sh manual` | `.claude/harness-mode.sh auto` |
| Warning ratchet | delete the ratchet block in `scripts/verify.sh` (baseline file stays harmless) | restore the block; next run re-baselines |
| Standing goals | nothing runs unless invoked; retire one goal by setting `status: retired` in its file | run `.claude/verify-goals.sh`; un-retire by editing status |
| Analyzers (one build) | `dotnet build -p:DisableExtraAnalyzers=true` | just build normally |
| Analyzers (permanently) | remove the `AnalysisLevel` line in `Directory.Build.props` and the `GlobalPackageReference` block in `Directory.Packages.props` | restore those lines |
| One analyzer rule | in `.editorconfig`: `dotnet_diagnostic.<RuleId>.severity = none` (or `suggestion`) | set it back to `warning`/`error` |
| Architecture tests (one run) | `dotnet test --filter "Category!=Architecture"` | run tests normally |
| Architecture tests (permanently) | `dotnet sln remove WestcoastCars.ArchitectureTests/WestcoastCars.ArchitectureTests.csproj` | `dotnet sln add …` (same path) |
| Pre-commit secret scan | `git config --unset core.hooksPath` (or one-off: `git commit --no-verify` — blocked for Claude, works for you) | `git config core.hooksPath .githooks` |
| Format-on-stop hook | delete the `hooks` block in `.claude/settings.json` | restore the block (see git-ignored file history or this doc) |
| Claude permission rules | edit `permissions.deny/allow` in `.claude/settings.json` (project) or `~/.claude/settings.json` (global) | re-add entries |
| MCP servers (all) | `mv .mcp.json .mcp.json.off` | `mv .mcp.json.off .mcp.json` (restart session) |
| One MCP server | delete its entry from `.mcp.json` | re-add the entry (both are 3 lines; see this doc's inventory) |
| A skill | delete/move its folder out of `.claude/skills/` | put it back |
| CI secret scan / CodeQL | delete the job in `ci.yml` / delete `codeql.yml` | restore from git history |
| Dependabot | delete `.github/dependabot.yml` (or set `open-pull-requests-limit: 0` per ecosystem) | restore the file |
| Stryker.NET | never runs unless invoked; uninstall with `dotnet tool uninstall dotnet-stryker` | `dotnet tool install dotnet-stryker`; run: `dotnet stryker --project WestcoastCars.Application` |
| zizmor | never runs unless invoked; `brew uninstall zizmor` | `brew install zizmor`; run: `zizmor .github/workflows/` |

## Review: the "Agentic OS" post (evaluated 2026-07-09)

Manuel brought an X post ("How to Build An Agentic OS using Fable 5", @Av1dlive) describing a full autonomous fleet: cron conductor, cheap OpenRouter workers, trust ledgers, budget enforcement. Verdict: **adopt the principles and the cheap pieces; record install-conditions for the machinery.** The post's own rule applies: "installing them speculatively is how systems bloat."

**Adopted (built and verified):**

| Idea from the post | Where it landed |
|---|---|
| "Laws, not tips" constitution | AGENTS.md `NEVER` block — numbers, nevers, checkable rules (incl. "never weaken a test to make it pass") |
| Anti-gold-plating + grounded-progress prompt language | AGENTS.md "How to work" section |
| Deterministic gate holds the final vote (BUILD 2) | `scripts/verify.sh` — "done" is now machine-checkable, not self-assessed |
| Ratchet loop (BUILD 7) | Warning ratchet inside `verify.sh`: 209 analyzer warnings may only go down; baseline tightens itself |
| Standing goals + goal ledger (BUILD 5) | `.claude/goals/` + `verify-goals.sh`, seeded with 5 real invariants incl. a scanner self-test (born from our own gitleaks silent-failure incident) |
| Compost / failures-become-laws (BUILD 7) | `retro` skill — ≤3 proposals, propose-only, owner signs |
| Fresh-context verification beats self-critique | Already had it: `/verify`, `/code-review`, `/security-review` |

**Skipped — with the condition that would change the answer:**

| Idea | Why skipped | Install when |
|---|---|---|
| Conductor/worker/verifier multi-model loop (BUILD 3) | Built for API/OpenRouter billing and a steady chore queue; Manuel works interactively on a subscription, and it pulls against the manual-control dial | A real backlog of well-specified recurring chores exists AND API billing is in use AND weeks of `verify.sh`/goals history look boring |
| Trust ledger per skill (BUILD 4) | Needs ≥20 logged runs per skill to mean anything — only the loop generates that volume | The loop above gets installed |
| Budget scripts (BUILD 6) | Subscription, not per-token API metering; the token lever here is `harness-mode.sh manual` | Switching to API billing |
| Quorum, sparring (BUILD 7) | Post's own conditions not met (no cron wake-ups to dedupe; not shipping to users daily) | Their stated conditions appear |
| Cron heartbeat (BUILD 8) | The harness philosophy here is pull-not-push — Manuel decides when things run | Wanting goals re-verified while away: `30 7 * * * cd <repo> && .claude/verify-goals.sh` is ready as-is |
| BUILD 0 API configuration (max_tokens, effort flags, refusal stop-reasons) | Applies to scripted `claude -p` pipelines, which we don't run | Building any scripted pipeline — then re-read that section of the post first |

One broadly useful BUILD 0 rule adopted implicitly: don't write prompts/skills asking the model to echo its private reasoning — ask for evidence and structured output instead (our skills already do).

## Roadmap — remaining candidates

- **Custom subagent** (`.claude/agents/`) — e.g. a read-only security auditor; low priority since `/security-review` is built in.
- **Error-tracking MCP** (Sentry or similar) — the app already emits OpenTelemetry; wiring an MCP would let agents read production errors and fix from evidence. Needs an account/DSN, so it waits until there's real production telemetry.
- **Promote analyzers to errors** — once the warning backlog is near zero, add `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` so new violations block the build.

**Evaluated and skipped (for now):**
- **pi** (pi.dev, Mario Zechner) — a minimal *alternative* coding agent, not an add-on to Claude Code. AGENTS.md and the skills would largely carry over if ever tried.
- **Hermes Agent** (Nous Research) — self-hosted personal assistant (Telegram/Discord, persistent memory, auto-generated skills). Not a dev harness; its memory/skills features duplicate what Claude Code does natively.
- **Engram** — same reasoning; built-in memory covers it. Not installed on this machine.
- **Per-technology skills** ("C# skill", "EF skill", …) — the model already knows the languages; skills are for *project procedures*, conventions go in AGENTS.md. See below.
- **GitHub MCP** — the `gh` CLI does everything needed with less surface.
- **CSharpier** — would fight the existing `dotnet format` CI check; not worth the churn.

## What deserves a skill (and what doesn't)

Rule of thumb: **model = language knowledge, AGENTS.md = project facts and conventions, skill = multi-step procedure with project-specific details.**
- ❌ "C#" / ".NET" / "React" skills — restate what the model already knows, waste context.
- ✅ A skill when a *workflow* keeps needing the same careful steps (migrations, deploys, releases).
- ✅ A tech-specific skill only when the model is demonstrably behind (e.g. a ".NET 10 gotchas" skill *if* outdated API usage keeps happening — write it from real incidents, not preemptively).

## Maintenance

- Treat `AGENTS.md` like code: update it whenever a command or convention changes.
- When CI catches something the agent did wrong, ask: could a deny rule, hook, or AGENTS.md line have prevented it? Add it.
- Revisit this doc when tools ship major versions — the concepts are stable, the file formats occasionally aren't.
