# BOOTSTRAP — apply the AI harness to a project

Audience: a human, or an AI coding agent told *"read BOOTSTRAP.md and apply this harness to this project."*
Prerequisite: the machine is set up per `MACHINE-SETUP.md`. Everything here is idempotent — safe to re-run.

**Agent ground rules while bootstrapping:** never commit or push (the owner does that himself); fill templates with facts you verified by running commands, never guesses; if the project contradicts an assumption below (no Docker, no GitHub, monorepo), say so and adapt rather than forcing the template.

## Step 0 — Decide visibility (ask the owner if unclear)

- **Local-only (Manuel's default):** AI files never enter git. You'll use `.git/info/exclude` in step 2.
- **Committed:** team projects where everyone's agent should share the config. Skip the exclude edits, commit everything except real secrets.

## Step 1 — Copy the skeleton

From the repo root:

```bash
cp -R ~/dev/ai-harness-template/project/. .
```

This brings in: `.claude/` (settings, format hook, security-checklist skill), `.githooks/pre-commit`, `.mcp.json`, `CLAUDE.md`, `AGENTS.md.template`, and `.github/` templates.

## Step 2 — Local-only mode: hide AI files from git

Append to `.git/info/exclude` (this file itself is never committed):

```
# Local-only AI tooling
AGENTS.md
CLAUDE.md
.claude/
.mcp.json
.githooks/
```

Verify: `git status --porcelain` must show **no** AI files. The `.github/` templates stay visible — they're meant to be committed (no AI signature).

> **Brand-new project (no code yet)?** Before step 3, run the `architecture-designer` skill (decision ladder: qualities → shape → dependency sentence → data ownership → architecture tests → ADR) and the `devops` skill (day-one pipeline baseline). Their outputs become the Architecture and Commands/CI sections below.

## Step 3 — Write AGENTS.md (the valuable hour — don't rush it)

Rename `AGENTS.md.template` → `AGENTS.md` and fill every section **from evidence**:

1. Inspect the repo: project layout, dependency direction (`grep -r ProjectReference` for .NET, imports/package.json for TS), test projects, CI workflow commands.
2. Every command you write in AGENTS.md, **run first** — build, test, format, run. A wrong command in AGENTS.md poisons every future session.
3. Fill the security section with this project's real secret mechanism and forbidden paths.
4. Delete sections that don't apply (e.g. migrations when there's no DB).

## Step 4 — Activate the guardrails

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .claude/hooks/format-changed.sh .claude/harness-mode.sh \
         .claude/git-autonomy.sh .claude/sandbox-mode.sh .claude/verify-goals.sh
.claude/harness-mode.sh auto   # initialize the autonomy switch (writes settings.local.json)
.claude/git-autonomy.sh off    # stamp the dormant git system's OFF marker into settings.json
```

Edit the auto-mode allowlist inside `.claude/harness-mode.sh` to include this project's build/test/format commands. The owner switches autonomy anytime with `.claude/harness-mode.sh auto|manual|status` — MANUAL turns hooks off, makes every edit/command ask first, and unloads MCP servers to spare tokens. Deny rules are never affected by the mode.

Two more switches ship **dormant (default OFF)** and stay that way until the owner personally flips them — see `HARNESS-TIERS.md` for activation conditions: `.claude/git-autonomy.sh off|commit|push|pr|status` (graduated git access for the agent, paired with the `git` skill; §2.8) and `.claude/sandbox-mode.sh on|off|status` (OS-level sandbox; Tier 1 hardening). Agents never touch either switch.

Adapt `.claude/hooks/format-changed.sh` if the project's formatter isn't `dotnet format`/`prettier`.
Add project-specific deny rules to `.claude/settings.json` (key material paths, data directories), and allow-rules for this project's build/test commands (copy the shape of the existing entries).

**Verify the secret scan (do not skip — a broken hook looks identical to a working one):**

```bash
echo 'aws_key = "AKIA4X7QZ2J9K3M8N5P1"' > leak-test.txt && git add leak-test.txt
.githooks/pre-commit; echo "exit: $?"    # MUST print a BLOCKED message and exit 1
git reset -q leak-test.txt && rm leak-test.txt
```

**Verify the format hook:** deliberately misformat one source file, run
`CLAUDE_PROJECT_DIR=$(pwd) .claude/hooks/format-changed.sh`, confirm the file is fixed.

## Step 5 — CI security (committed; carries no AI signature)

1. `.github/workflows/codeql.yml`: set `languages:`, keep/delete the build steps per the comments inside.
2. `.github/dependabot.yml`: keep only the real ecosystems.
3. Paste the `secret-scan` job from `.github/workflows/secret-scan-job.yml.snippet` into the project's CI workflow.
4. Pin any unpinned actions and check the lot: `zizmor .github/workflows/` until **zero findings**. Resolve SHAs with:
   `git ls-remote https://github.com/<owner>/<repo> "refs/tags/<tag>^{}"` (empty result ⇒ lightweight tag: drop the `^{}`).

## Step 6 — Language-specific verification layer

**.NET:** apply `dotnet-extras/analyzers.props.snippet` (analyzers + toggle + CI format-gate split — read its warning about `--verify-no-changes`), and create an architecture-test project from `dotnet-extras/ArchitectureTests.example.cs` **after** deriving the real dependency rules. Add Stryker: `dotnet new tool-manifest` (if none) + `dotnet tool install dotnet-stryker`.

**TypeScript/React:** `tsconfig` `strict: true`; ESLint with `typescript-eslint` strict + `eslint-plugin-security`; Prettier; Vitest; Playwright for E2E. CodeQL language `javascript-typescript` (no build steps needed).

**All stacks — the deterministic gate:** fill in `scripts/verify.sh.template` with this project's real build/lint/test commands, rename to `verify.sh`, `chmod +x`. AGENTS.md's definition of done points at it — run every command you put in it to prove it exits 0 before finishing. Optional warning ratchet pattern documented inside.

**Standing goals:** `.claude/verify-goals.sh` re-verifies the invariants in `.claude/goals/` (four stack-agnostic ones ship with the template: hooks-path active, no `.env` tracked, gitleaks self-test, zizmor-clean workflows). Add one goal per finished thing worth keeping true — predicate must be a cheap, read-only shell command, verified to actually detect the broken state. Run manually or via cron.

## Step 7 — Project skills (write from real workflows, not preemptively)

`security-checklist` ships generic. Add skills only for multi-step procedures this project actually repeats — migrations, deploys, db inspection. Copy the format of any `SKILL.md` (frontmatter `name` + `description` stating *when to use it*, then steps grounded in real commands). Rule: model = language knowledge, AGENTS.md = project facts, skill = procedure.

## Step 7b — If Codex (or any second agent) is in play: mirror the guards

Claude's deny rules live in `.claude/settings.json` and bind only Claude. Every other agent needs the *same* mechanical enforcement — a rule enforced for one agent and trusted for another is not enforced.

1. Copy `project/.harness/hooks/guard-git-publish.sh` into the repo's `.harness/hooks/` and `chmod +x` it. It blocks `git commit` / `git push` at the PreToolUse level for any agent whose hook engine calls it.
2. Wire it in `.codex/config.toml`:

```toml
[features]
hooks = true

[[hooks.PreToolUse]]

[[hooks.PreToolUse.hooks]]
type = "command"
command = '/bin/bash "$(git rev-parse --show-toplevel)/.harness/hooks/guard-git-publish.sh"'
timeout = 10
statusMessage = "Checking command against publish guard"
```

3. **Test it** (a guard you haven't seen deny is decoration):

```bash
printf '%s' '{"tool_input":{"command":"git commit -m x"}}' | .harness/hooks/guard-git-publish.sh   # must print a deny JSON
printf '%s' '{"tool_input":{"command":"git status"}}' | .harness/hooks/guard-git-publish.sh        # must print nothing
```

## Lessons — mistakes an agent actually made bootstrapping a project (don't repeat them)

Recorded 2026-07-12 from reviewing an AI-performed bootstrap of a new project. Each of these looked fine at a glance and was wrong.

1. **Don't re-litigate the owner's standing policies.** The bootstrap left every AI file committable and wrote a "visibility recommendation" arguing AGENTS.md should be committed — directly against the owner's global "repos carry no AI signature" rule. A standing owner rule is an input, not a discussion point. Default to it; if you disagree, flag it *separately* while still implementing the rule.
2. **Pin the CI SDK from `global.json`, not a floating version.** It wrote `global.json` with `rollForward: latestPatch` + version `10.0.201`, then had CI install `dotnet-version: "10.0.x"`. setup-dotnet resolves that to the newest 10.0 SDK, which `latestPatch` may refuse (wrong feature band) → CI breaks later for no visible reason. Always use `global-json-file: global.json` in setup-dotnet, or consciously choose `latestFeature`.
3. **Check current package versions at scaffold time.** It scaffolded with template-default versions that were already one to four majors behind (and one deprecated). `curl https://api.nuget.org/v3-flatcontainer/<package>/index.json` takes seconds. New project = newest stable of everything, verified by the gate.
4. **Don't ship tooling that nothing uses.** coverlet was installed but no step collected coverage. Every installed-but-unwired tool is a future "why is this here". Wire it or remove it.
5. **A one-time check is not a gate.** It ran the fake-secret test, zizmor, and vuln scan once, checked the boxes, and built no standing goal or CI job for any of them. What isn't re-verified regresses silently — put it in `.claude/goals/` or CI, or it doesn't count.
6. **Enforce every law for every agent.** It denied `git commit` for Claude in `.claude/settings.json` and left Codex — the agent it was actually configured for — with no guard at all. See step 7b.
7. **Keep the AI signature out of committable files.** It wrote "integrated Codex/Claude development harness" into README.md and linked README to the local-only planning docs. README, CI, and scripts are committed — they must read as a normal engineering repo. Grep committable files for agent/AI-tooling mentions before finishing.
8. **The vuln gate is part of the baseline, not an upgrade.** `dotnet list package --vulnerable --include-transitive` as a CI job (fail on findings) ships with the first workflow, not "later".

## Step 7c — Write the operating card

Create `.claude/HARNESS.md` (local-only): a one-page card with this project's harness inventory, the operating commands (`harness-mode.sh`, `git-autonomy.sh`, `sandbox-mode.sh`, `verify-goals.sh`, `verify.sh`), what's deliberately deferred (with triggers), and the local-only policy. Copy the shape from any existing project's card. Point to it from `CLAUDE.md`. This is the answer to "what harness does this repo have?" without re-deriving it — keep it in sync when the harness changes, like AGENTS.md.

## Step 8 — Final gate (all must pass before calling it done)

- [ ] Build + full test suite green, using the exact commands written in AGENTS.md
- [ ] Format gate passes with **zero working-tree changes** afterwards
- [ ] Fake-secret test blocked (step 4); format-hook test fixed a file (step 4)
- [ ] `zizmor .github/workflows/` → zero findings
- [ ] Local-only mode: `git status` shows no AI files
- [ ] MCP servers approved in a fresh Claude session (`claude` → approve playwright/context7)
- [ ] Owner told what's ready to commit (the CI/analyzer/test files) — **never commit for him**
