# AI Harness Template

A reusable, cross-platform workflow for Claude Code and Codex. It keeps durable project truth reviewable, makes nontrivial work move from decisions to specifications to vertical implementation tickets, and backs the important safety rules with executable checks.

## Start here

- New machine: follow [MACHINE-SETUP.md](MACHINE-SETUP.md), beginning with `node scripts/machine-setup.mjs`.
- New or existing project: follow [BOOTSTRAP.md](BOOTSTRAP.md), beginning with `node scripts/bootstrap.mjs <project-path>`.
- Token cost: review [TOKEN-COSTS.md](TOKEN-COSTS.md) and update it with `node scripts/token-costs.mjs --write`.
- Audit: run `node scripts/audit.mjs`, or add `--project <path>` for one project.
- Verify this template: run `node scripts/verify.mjs`.

All mutating setup commands are dry-run by default and require `--apply`.

## Active structure

| Path | Purpose |
| --- | --- |
| `skills/engineering/` | Canonical engineering workflows |
| `skills/productivity/` | Canonical user/productivity workflows |
| `skills/invocation-policy.json` | Minimal user-only policy; inventory is discovered automatically |
| `components/` | Deterministic guards, Git checks, and conditional MCP templates |
| `project/` | Portable project skeleton and CI templates |
| `global/` | Claude and Codex machine guidance/settings templates |
| `scripts/` | Dependency-free Node setup, generation, audit, cost, and verification tools |

Claude adapters are generated with Claude's `disable-model-invocation` metadata. Codex adapters are generated with `agents/openai.yaml`. The workflow body has one canonical source.

## Workflow

- Use `grill-with-docs` for a repository-backed idea that fits one planning session.
- Use `wayfinder` when the decisions span several sessions.
- Convert resolved decisions with `to-spec`, then `to-tickets`.
- Run each approved ticket in a fresh `implement` session.
- Use `ask-alfred` when you cannot remember the appropriate entry point.

GitHub Issues is canonical when the project is on GitHub. Ignored Markdown under `.scratch/` is the local fallback.

Historical snapshots and retired components are kept outside discovery paths under `C:\Users\aleja\ai-workspaces\archive\` on this machine.
