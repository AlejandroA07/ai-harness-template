# Bootstrap a project

Bootstrap installs the portable mechanical baseline. The agent still has to understand the project and tailor the parts that cannot be inferred safely.

## 1. Inspect the plan

```powershell
node scripts/bootstrap.mjs <project-path>
```

Add `--github` only when GitHub hosting is intended but cannot yet be detected.

The dry run reports each conditional component as `RECOMMENDED`, `NOT CURRENTLY`, or `BLOCKED`, with a trigger for reconsideration. It makes no changes.

## 2. Apply the mechanical baseline

```powershell
node scripts/bootstrap.mjs <project-path> --github --apply
```

The script installs or generates:

- root `AGENTS.md` and thin `CLAUDE.md` when missing;
- Claude and Codex project hooks;
- fail-closed Gitleaks and narrow Git-metadata hooks;
- cross-platform `node scripts/verify.mjs` from detected real commands;
- committed security/verification CI, CodeQL, and detected Dependabot ecosystems for GitHub projects;
- ignored `.scratch/` state and other local-only exclusions;
- `core.hooksPath=.githooks`;
- generated project-specific skill adapters when `.harness/skills/` exists.

Stable, portable, secret-free harness files are committed. Keep secrets, approval state, settings overrides, transcripts, caches, auto-memory, temporary handoffs, absolute machine state, and learning workspaces local.

## 3. Tailor from evidence

The bootstrapping agent must inspect the repository and replace every placeholder in `AGENTS.md`:

- actual purpose, stack, modules, ownership, and dependency direction;
- exact start, focused-test, migration, and package-management commands;
- generated/legacy/sensitive paths;
- the real secret mechanism;
- project-specific conventions and definition-of-done details.

Review `scripts/verify.mjs` against the project and CI. Local and CI verification must run the same gate. For legacy warnings or vulnerable dependencies, establish a reviewed ratchet; new projects start at zero.

Do not create project skills pre-emptively. Add a canonical `.harness/skills/<name>/SKILL.md` only after a project develops a repeated, non-obvious procedure such as migrations or deployment. Then run:

```powershell
node <harness-path>/scripts/generate-project-skills.mjs --project <project-path>
```

Commit the generated `.claude/skills/` and `.agents/skills/` adapters. Never edit them by hand; CI/audit checks drift.

## 4. Conditional components

- **Context7 MCP:** enable when current third-party documentation is repeatedly needed. Use the pinned Claude/Codex snippets under `components/mcp/` and commit the resulting project configuration.
- **Playwright MCP:** enable for a real browser UI. Use the pinned snippets under `components/mcp/`.
- **Architecture tests:** add only for a stable boundary whose dependency rule is worth enforcing.
- **Stricter .NET analyzers:** review built-in analyzers and current Sonar rules for .NET projects; explain dependency/warning impact and ratchet legacy warnings.
- **Mutation testing:** add only for a mature, high-risk suite and run it on demand.
- **Coverage:** run on demand, not on every pull request.
- **Deployment skill/infrastructure:** add when the project actually deploys; include rollback, migrations, health, traceability, and observability based on its real target.

MCPs are never enabled globally by bootstrap. Context7 and Playwright are independent of guards and skills.

## 5. Planning artifacts

Create these lazily:

- `CONTEXT.md`: project-specific glossary only.
- `docs/adr/NNNN-slug.md`: only for a hard-to-reverse, surprising decision with a real trade-off.
- GitHub Issues: specifications, Wayfinder maps/decision tickets, and implementation tickets.
- `.scratch/`: ignored local fallback when no GitHub remote exists.

Wayfinder uses its five routing labels: `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, and `wayfinder:task`. Do not add the rejected triage state machine.

## 6. Final gate

```powershell
node <harness-path>/scripts/audit.mjs --project <project-path>
node scripts/verify.mjs
```

Exercise the application where relevant. Only then stage the intended portable files and create the local feature-branch commit. Never push a feature branch.
