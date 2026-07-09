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

## Step 3 — Write AGENTS.md (the valuable hour — don't rush it)

Rename `AGENTS.md.template` → `AGENTS.md` and fill every section **from evidence**:

1. Inspect the repo: project layout, dependency direction (`grep -r ProjectReference` for .NET, imports/package.json for TS), test projects, CI workflow commands.
2. Every command you write in AGENTS.md, **run first** — build, test, format, run. A wrong command in AGENTS.md poisons every future session.
3. Fill the security section with this project's real secret mechanism and forbidden paths.
4. Delete sections that don't apply (e.g. migrations when there's no DB).

## Step 4 — Activate the guardrails

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .claude/hooks/format-changed.sh
```

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

## Step 7 — Project skills (write from real workflows, not preemptively)

`security-checklist` ships generic. Add skills only for multi-step procedures this project actually repeats — migrations, deploys, db inspection. Copy the format of any `SKILL.md` (frontmatter `name` + `description` stating *when to use it*, then steps grounded in real commands). Rule: model = language knowledge, AGENTS.md = project facts, skill = procedure.

## Step 8 — Final gate (all must pass before calling it done)

- [ ] Build + full test suite green, using the exact commands written in AGENTS.md
- [ ] Format gate passes with **zero working-tree changes** afterwards
- [ ] Fake-secret test blocked (step 4); format-hook test fixed a file (step 4)
- [ ] `zizmor .github/workflows/` → zero findings
- [ ] Local-only mode: `git status` shows no AI files
- [ ] MCP servers approved in a fresh Claude session (`claude` → approve playwright/context7)
- [ ] Owner told what's ready to commit (the CI/analyzer/test files) — **never commit for him**
