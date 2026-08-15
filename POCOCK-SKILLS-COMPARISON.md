# Harness and mattpocock-skills — reviewed integration

Decision record updated 2026-08-15. The reviewed upstream source is [`mattpocock/skills`](https://github.com/mattpocock/skills) at full commit `8b78b531ab965735c5dc74f6f7a219e1e37326df`, the commit currently pinned by Anthropic's official marketplace.

## Decision

Do not install the full Pocock plugin beside this harness. Claude namespaces plugin skills rather than merging them with local skills, and Codex also does not merge duplicate local skill names. Concurrent installation therefore creates competing descriptions and unpredictable routing.

Instead, keep one canonical local skill set with explicit ownership:

- **Exact** — reviewed upstream Markdown is copied without workflow changes. These paths may be updated mechanically.
- **Adapted** — upstream workflow plus a documented harness-specific delta. These paths are reported for review and are never overwritten.
- **Local** — harness-owned behavior with no upstream equivalent.

The ownership and pin live in [`skills/upstream-sources.json`](skills/upstream-sources.json). `node scripts/upstream-skills.mjs` audits drift; `--apply-exact` is allowed only on a clean `feature/*` branch against a full SHA. The tool accepts Markdown resources only, rejects symlinks and executable resources in exact skills, and never executes upstream code.

## Current inventory

| Ownership | Skills |
| --- | --- |
| Exact upstream (14) | `codebase-design`, `domain-modeling`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `improve-codebase-architecture`, `prototype`, `research`, `tdd`, `teach`, `to-questionnaire`, `wait-what`, `writing-for-agents` |
| Adapted (7) | `ask-alfred` (upstream `ask-matt`), `code-review`, `diagnosing-bugs`, `implement`, `to-spec`, `to-tickets`, `wayfinder` |
| Local (1) | `security-checklist` |
| Deliberately excluded | `resolving-merge-conflicts`, `setup-matt-pocock-skills`, `triage`, `wizard` |

There are 22 canonical skills: 12 user-only and 10 model-invoked. Current static sizes and invocation costs are generated in [`TOKEN-COSTS.md`](TOKEN-COSTS.md).

## Why the adapted skills differ

### `ask-alfred`

The router keeps upstream's complete main flow, Wayfinder warning, smart-zone/context hygiene, and phase-boundary decision tree. It removes routes to the four excluded skills and points engineering flows at the tracker/domain contracts produced by harness bootstrap.

### `code-review`

Standalone review retains upstream's fixed-point three-dot comparison. When called from `implement`, it instead reviews `git diff --cached`. This is essential: upstream's fixed-point-to-`HEAD` diff cannot see a newly implemented, uncommitted patch. The tracker source is `docs/agents/issue-tracker.md`, with GitHub/local fallback when an older project has not regenerated it.

### `diagnosing-bugs`

The feedback-loop, minimization, hypothesis-ranking, bisection, fix, and post-mortem flow follows upstream. The evidence rule is deliberately stronger: never read a secret and redact it afterward. Use environment references and the project secret mechanism, and accept only user-supplied pre-redacted artifacts. Both Bash and PowerShell HITL templates are available.

### `implement`

This remains the largest deliberate extension. It adds the eligible-branch gate, intended-path staging, TDD at agreed seams, conditional security review, staged two-axis review, the project verification gate, and a clean local commit. These are not cosmetic differences; they enforce the harness's definition of done and fix the uncommitted-diff gap in upstream composition.

### `to-spec` and `to-tickets`

Both retain upstream synthesis, test-seam, vertical-slice, dependency-edge, expand/contract, and prototype-snippet behavior. They use the bootstrap-generated GitHub-or-local tracker contract and apply only `ready-for-agent`; no separate setup or triage state machine is required.

### `wayfinder`

The map, fog/frontier, ticket types, one-decision-per-session, create-then-wire, and resolution flow follows upstream. Tracker-specific operations come from `docs/agents/issue-tracker.md`. GitHub uses native sub-issues and blocked-by edges with numeric database IDs; local Markdown records the equivalent edges explicitly. GitLab, Jira, and Linear variants are intentionally absent.

## What was gained from upstream

- Round-based grilling over a decision-tree frontier.
- Stronger routing, smart-zone guidance, and an ordered phase-boundary tree.
- Self-contained HTML logic prototypes and upstream UI prototype guidance.
- `prototype/<name>` evidence branches that are never merged into the default branch.
- Secret-safe diagnostic evidence, strengthened to the harness's never-read rule.
- Active-development/YAGNI scope for architecture audits.
- Harness-neutral subagent wording and design-it-twice guidance.
- TDD's shared `codebase-design` vocabulary.
- `writing-for-agents`, `to-questionnaire`, and `wait-what`.

## Bootstrap replaces the useful setup behavior

Pocock's separate setup skill interviews the user after installation and writes tracker/domain agent documentation. This harness already has a project installer, so a second installer would create two owners for the same files.

Bootstrap now adopts the useful architecture:

1. Detect GitHub from the remote; otherwise select ignored local Markdown.
2. Write `docs/agents/issue-tracker.md` once, including deterministic GitHub operations and Wayfinder behavior.
3. Validate existing domain configuration rather than assuming it is correct.
4. Detect possible multi-project structure only for supported user stacks: Node/TypeScript, .NET, and Java.
5. Default an ordinary repository to single-context. When structural signals exist, require a semantic choice between `--domain-layout=single` and `--domain-layout=multi`; structure alone never creates domain boundaries.
6. Write `docs/agents/domain.md`. Create `CONTEXT.md`, `CONTEXT-MAP.md`, and ADRs lazily only when real domain knowledge exists.

This matches Pocock's tracker/domain contract architecture while preserving deterministic dry-run/apply, existing `AGENTS.md` ownership, security policy, and cross-platform support.

## Labels and authorship

`ready-for-agent` describes workflow state and is retained. `ready-for-human` and the triage role/state machine are not used.

The policy now targets the actual unwanted behavior: model/tool self-attribution or authorship claims in branch names, commits, PRs, comments, code, reviews, reports, and repository documentation. Ordinary workflow language is not prohibited. The branch guard separately rejects tool-branded branch prefixes.

## Prototype Git policy

Prototype branches are a narrow exception alongside Wayfinder research branches:

- create `prototype/<name>` from the default branch, preferably in a separate worktree;
- commit the runnable prototype and record the question/verdict;
- never merge the branch into the default branch;
- push only to `origin`, only after explicit approval for that individual push, and only as the current same-named branch.

This preserves Pocock's primary-source workflow without weakening the no-feature-push rule.

## Update procedure

1. Obtain a reviewed upstream checkout at a full commit SHA.
2. Run `node scripts/upstream-skills.mjs --source <checkout> --source-commit <sha>`.
3. Review every adapted-skill report, classify any new upstream skill, and update the manifest's reviewed commit only after that review is complete.
4. On a clean `feature/*` branch, run `node scripts/upstream-skills.mjs --source <checkout> --ref <sha> --apply-exact`; apply mode verifies both the checkout and the manifest pin with Git and does not accept the read-only fixture declaration.
5. Regenerate adapters and token costs, run focused tests, then run `node scripts/verify.mjs`.

## Primary references

- [Pocock plugin ADR](https://github.com/mattpocock/skills/blob/main/.agents/adr/0002-ship-as-a-claude-code-plugin.md)
- [Pocock changelog](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [GitHub issue dependency API](https://docs.github.com/en/rest/issues/issue-dependencies)
- [GitHub sub-issue API](https://docs.github.com/en/rest/issues/sub-issues)
