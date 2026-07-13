# Solo Master — AI Harness Integration Plan

> **Historical integration proposal (superseded).** The first commit is done and pushed. Visibility (local-only via `.git/info/exclude`), autonomy-mode, and Stop-hook decisions in this document were superseded by later owner decisions — current truth lives in `docs/06-harness-review-fixes.md` and `.claude/HARNESS.md`.


Status: baseline integrated; pending Manuel's review and first GitHub run  
Reference template: `/Users/manuelalmeida/dev/ai-harness-template`

## Goal

Adapt the useful parts of the existing harness to Solo Master without copying Claude-specific assumptions or installing speculative machinery.

The harness has three jobs:

1. **Context** — give coding agents accurate project facts.
2. **Guardrails** — prevent predictable unsafe actions through tooling.
3. **Verification** — decide whether a change is complete using repeatable checks.

## Scope decision

Solo Master is a standalone project rooted at:

```text
/Users/manuelalmeida/solo-master
```

This gives every harness component clear project scope:

- `AGENTS.md` provides repository guidance.
- `.codex/config.toml` provides trusted project-local Codex settings.
- `scripts/verify.sh` is the application quality gate.
- `.githooks` applies only to the Solo Master repository after `core.hooksPath` is configured.
- `.github/workflows` belongs directly to Solo Master.

The template can now be adapted from the repository root, but it should still not be copied unchanged. Commands, permissions, packages, CI, MCP servers, and architecture rules must be derived from the actual project.

## Visibility recommendation

Use two classes of files.

### Commit to Git

- `solo-master/AGENTS.md`
- `solo-master/scripts/verify.sh`
- neutral analyzer and formatting configuration;
- tests and test infrastructure;
- repository-local CI workflows;
- CodeQL, dependency-update, and secret-scan configuration;
- optionally `solo-master/.codex/config.toml` if it contains only safe team/project configuration.

These files describe or verify the software and are useful regardless of which agent writes code.

### Keep machine-local

- credentials and API keys;
- personal model and reasoning preferences;
- personal approval policy and sandbox preference;
- machine-specific notification commands;
- temporary MCP overrides;
- Claude-only settings if they are used only by one developer.

Do not hide `AGENTS.md` merely to remove an “AI signature.” It is project guidance, and its rules are useful to human contributors too. If Solo Master later becomes a shared project, committed guidance prevents different agents from inventing different workflows.

## Component mapping

| Harness template component | Solo Master decision |
|---|---|
| `AGENTS.md.template` | Adapt and commit after every command is verified |
| `CLAUDE.md` | Optional thin import of `AGENTS.md`; use only if Claude Code is used |
| `.claude/settings.json` | Do not treat as Codex configuration |
| `.claude/harness-mode.sh` | Do not port; Codex approval and sandbox settings already control autonomy |
| `.claude/hooks/format-changed.sh` | Prefer explicit verification first; add a Codex Stop hook only if missed formatting becomes a recurring problem |
| `.githooks/pre-commit` | Adapt, activate for this repository, and verify with a fake-secret test |
| `.mcp.json` | Translate only required servers; do not automatically load Context7 and Playwright |
| `.github` templates | Adapt at parent root with Solo Master paths and real commands |
| `scripts/verify.sh.template` | Adapt immediately after scaffolding and make it the final vote |
| analyzer snippet | Apply after package structure is known and versions are verified |
| architecture test example | Defer until dependency boundaries exist |
| standing goals | Add only cheap invariants with a demonstrated failure mode |

## Codex configuration

### `AGENTS.md`

The initial Solo Master guide should contain:

- one paragraph defining the product and current vertical slice;
- actual solution structure and dependency direction;
- tested commands for run, restore, build, format, test, and verification;
- package-management rules;
- EF Core migration rules after EF Core is introduced;
- the secrets mechanism and forbidden secret-bearing paths;
- a small set of enforceable `NEVER` rules;
- definition of done: `scripts/verify.sh` exits zero;
- instruction to keep changes within Solo Master unless a root CI/hook change is explicitly required.

Keep it concise enough that agents read the whole file. Move procedures into scripts or skills rather than expanding `AGENTS.md` indefinitely.

### `.codex/config.toml`

Create this only after deciding which project-local settings are needed. Candidate content:

- enable trusted project-local hooks when used;
- configure a browser-testing MCP only after a runnable UI exists;
- use timeouts appropriate for the .NET build and test suite;
- avoid project-level provider, credential, telemetry, notification, model, or personal approval settings.

Do not duplicate global Codex configuration.

### Hooks

Current Codex supports project-local lifecycle hooks. Use them only for deterministic, fast behavior.

Good candidates after the need is demonstrated:

- block obviously forbidden destructive commands;
- check touched paths stay within the requested scope;
- run a lightweight formatter on changed C# files at Stop.

Do not run the complete test suite on every lifecycle event. `scripts/verify.sh` and CI own comprehensive verification.

## Tool-independent guardrails

### Secret scanning

The Solo Master repository should have one active secret-scanning hook or equivalent wrapper.

Requirements:

- gitleaks must be installed or CI must fail clearly when the expected scanner is missing;
- use the current staged-change command supported by the installed gitleaks version;
- run a fake-secret self-test and verify a non-zero exit;
- redact secret values in output;
- never read real `.env`, key, certificate, or user-secret material during the test.

Configure `core.hooksPath` only after Solo Master has been initialized as its own Git repository. This setting will then apply only to Solo Master.

### Secrets in Solo Master

- Use .NET user secrets for development cloud-provider keys.
- Use environment variables in CI/deployment.
- Store only provider name, endpoint metadata, and model name in normal configuration.
- Do not store an Ollama endpoint as a secret unless it contains credentials.
- Never log prompts that may contain imported private learning material without an explicit logging policy.

### Dependency policy

- Propose new production dependencies before adding them.
- Prefer framework and Microsoft-maintained packages when they solve the need cleanly.
- Pin compatible major versions and preserve lock/central version files.
- Run vulnerable-package checks as part of CI.
- Configure Dependabot only for NuGet and GitHub Actions initially.

## Deterministic verification

`solo-master/scripts/verify.sh` should become the single local quality gate.

Initial order:

```text
restore
  → Release build
  → whitespace/style verification
  → unit tests
  → integration tests
```

Later additions must earn their place:

```text
architecture tests   after multiple dependency layers exist
browser smoke tests  after the first complete UI flow exists
AI evaluation tests  after structured AI grading exists
mutation tests       periodically, not on every local change
```

The script should:

- use `set -euo pipefail`;
- locate the Solo Master directory from the script path;
- work regardless of the caller's current directory;
- print a short label before each phase;
- return non-zero at the first failed gate;
- never rewrite source files in verification mode;
- match CI commands and filters exactly.

## Testing strategy

### Baseline

- Unit tests for pure application behavior.
- Integration tests through the real ASP.NET Core pipeline.
- One home-page smoke test in the foundation commit.

### First learning slice

- Domain tests for mastery requirements, attempts, assistance level, and state transitions.
- Persistence tests using SQLite rather than EF Core's in-memory provider when relational behavior matters.
- Page/handler integration tests for Learn and Mastery Check.
- Security tests showing assessment answers and tutor hints are unavailable in mastery mode.

### AI integration

- A deterministic fake `IChatClient` for application tests.
- Schema-validation tests for every structured AI response.
- Golden evaluation fixtures for strong, partial, wrong, misleading, and prompt-injection-like learner answers.
- Tests proving AI feedback cannot directly grant mastery.
- Provider smoke tests kept separate from the normal deterministic suite.

### Code execution

- Test process timeouts, output limits, temporary-directory cleanup, environment scrubbing, and failure reporting.
- Keep malicious-code tests local and controlled.
- Do not expose a code runner publicly until isolation has been reviewed independently.

## CI integration

Add workflows at:

```text
/Users/manuelalmeida/solo-master/.github/workflows/
```

The workflows run from the repository root and must use the same verification script used locally.

Initial CI jobs:

1. Solo Master deterministic verification.
2. Secret scan covering repository history as appropriate.
3. CodeQL for C#.
4. Dependency review on pull requests if available.

Pin actions to immutable commit SHAs, use least-privilege permissions, disable persisted checkout credentials unless needed, and run `zizmor` until there are no findings.

## MCP integration

### Add when useful

- In-app browser or Playwright for the first complete Learn → feedback → Mastery Check flow.
- Official OpenAI documentation MCP for OpenAI/Codex integration questions; it is already registered globally on this machine and requires a Codex restart.

### Defer

- Context7 until official documentation and repository sources are insufficient.
- Database MCP while SQLite can be inspected through normal tools and application tests.
- GitHub MCP when the GitHub CLI or installed GitHub connector already covers the workflow.
- Error-tracking MCP until production telemetry exists.

## Skills and reusable workflows

Do not create generic C#, .NET, EF Core, or Razor Pages skills. The model already knows the technology; project facts belong in `AGENTS.md`.

Create a project skill only after a procedure repeats and benefits from an exact playbook. Likely future candidates:

- author and validate a learning artifact;
- evaluate an AI grading prompt against the fixture set;
- create and inspect an EF Core migration;
- run the constrained C# exercise security checklist.

## Integration phases

### Phase A — foundation

- Write verified `AGENTS.md`.
- Create and prove `scripts/verify.sh`.
- Establish ignore rules for secrets, databases, build output, and local tooling.
- Add scoped CI.

### Phase B — guardrails

- Decide whether to activate a parent-repository gitleaks hook.
- Run the fake-secret self-test.
- Add analyzers and a warning ratchet.
- Harden workflows and verify them with `zizmor`.

### Phase C — application verification

- Add browser testing for the first real user journey.
- Add architecture tests only if project boundaries have been extracted.
- Add AI evaluation fixtures and security checks with the AI slice.

### Phase D — maintenance

- Add standing goals only for cheap invariants worth rechecking.
- Turn recurring failures into a script, test, hook, or concise `AGENTS.md` rule.
- Review harness cost and remove checks that are redundant or noisy.

## Harness definition of done

- [x] `AGENTS.md` contains only verified commands and current architecture.
- [x] `scripts/verify.sh` succeeds locally from outside the Solo Master directory.
- [x] CI is configured to run the same deterministic gate.
- [x] Secret scanning is self-tested with a fake credential.
- [x] Format checks leave the working tree unchanged.
- [x] Workflow hardening has zero `zizmor` findings.
- [x] No credentials or machine-specific personal settings are present in project files.
- [x] Browser/MCP configuration is deferred until a real learning flow needs it.
- [x] Architecture tests are deferred until dependency boundaries exist.
- [x] Harness and CI changes remain inside the Solo Master repository.
- [ ] CI and CodeQL complete successfully on GitHub after Manuel's first push.

## First harness action after approval

Scaffold the minimal application, run every candidate command, then write `AGENTS.md` and `scripts/verify.sh` from the observed results. The harness should describe and enforce the real project—not predict it.
