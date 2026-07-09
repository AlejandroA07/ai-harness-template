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
| `.claude/settings.json` | Guardrails | Claude permissions: denies reading `.env`/`dpkeys/`, force-pushes, and `--no-verify` commits; pre-approves safe commands (build/test/format). Registers hooks. |
| `.claude/hooks/format-changed.sh` | Guardrails | Runs automatically when Claude finishes a turn: formats every changed `.cs` file so CI's format check can't fail. |
| `.claude/skills/` | Context | Reusable playbooks: `migrate` (EF Core), `new-feature` (vertical-slice scaffolding), `security-checklist` (endpoint review). Plain markdown — readable by any tool. |
| `.githooks/pre-commit` | Guardrails | Blocks any commit containing a secret (gitleaks). Works for humans, Claude, and Codex alike since it's plain git. |
| `.mcp.json` | Verification | Playwright MCP server — lets the agent drive the real web UI (http://localhost:5002) in a browser to prove a change works. |
| `.github/workflows/ci.yml` | Verification | Format check, vulnerable-package check, build, tests + coverage, docker build, **gitleaks history scan**. |
| `.github/workflows/codeql.yml` | Verification | GitHub's static security analysis for C# (security-extended queries), on PRs and weekly. |
| `.github/dependabot.yml` | Verification | Weekly dependency update PRs for NuGet, GitHub Actions, and Docker base images. |
| `~/.claude/settings.json` (global) | Guardrails | Machine-wide denies for every project: `.env` files, SSH/AWS keys, certificates, force-push, `--no-verify`. |
| `WestcoastCars.ArchitectureTests/` | Verification | NetArchTest tests that fail if any code violates the clean-architecture dependency rule (e.g. Application referencing Infrastructure). Runs with the normal test suite. |
| `Directory.Build.props` + `Directory.Packages.props` (analyzers) | Verification | .NET analyzers (`AnalysisLevel latest-recommended`) + SonarAnalyzer.CSharp on every build — compile-time review incl. security rules. Noisy low-value rules demoted in `.editorconfig`. |
| `dotnet-tools.json` | Verification | Local tool manifest with Stryker.NET (mutation testing, run on demand). |
| Workflow hardening | Guardrails | All GitHub Actions pinned to commit SHAs, `persist-credentials: false` on checkouts, least-privilege `permissions:` — zizmor reports zero findings. |

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

## Toggles — turning each piece on and off

| Component | Turn OFF | Turn back ON |
|---|---|---|
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
