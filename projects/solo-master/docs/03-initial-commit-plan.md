# Solo Master — Initial Commit Plan

> **Historical plan (completed).** The repository is initialized, committed, and pushed; statements below about Git not being initialized are stale. Kept for history only.


Status: implemented; pending Manuel's review and commit  
Scope: the first code-bearing baseline in the standalone Solo Master repository

## Objective

Create a small, reproducible .NET foundation that builds and verifies cleanly before any learning feature is implemented.

The baseline should prove that the application can be developed safely. It should not contain speculative architecture, AI integration, curriculum generation, or placeholder feature layers.

## Repository context

Solo Master lives at:

```text
/Users/manuelalmeida/solo-master
```

This directory will be the Git repository root. Git has not been initialized yet; initialization is part of preparing the baseline:

```bash
cd /Users/manuelalmeida/solo-master
git init -b main
```

No remote, commit, or push should be created until the foundation contents and visibility choices have been reviewed.

Recommended commit message:

```text
feat(solo-master): establish project foundation
```

## Proposed baseline structure

```text
solo-master/
├── README.md
├── AGENTS.md
├── Directory.Build.props
├── Directory.Packages.props
├── global.json
├── SoloMaster.slnx
├── docs/
│   ├── 01-original-research-and-plan.md
│   ├── 02-research-refresh-and-proposed-plan.md
│   ├── 03-initial-commit-plan.md
│   └── 04-harness-integration-plan.md
├── scripts/
│   └── verify.sh
├── src/
│   └── SoloMaster.Web/
│       ├── Pages/
│       ├── Program.cs
│       ├── SoloMaster.Web.csproj
│       └── appsettings.json
└── tests/
    └── SoloMaster.IntegrationTests/
```

Do not create separate Domain, Application, and Infrastructure projects in the baseline. Begin with a single web application and an integration test project. Add a unit-test project with the first pure domain behavior rather than keeping an empty project. Extract boundaries when actual learning features make those boundaries useful.

## Decisions encoded in the baseline

- Target .NET 10 LTS and pin an SDK compatible with the machine and CI.
- Use Razor Pages.
- Use nullable reference types and implicit usings.
- Use central package management only if at least one external package is required; do not add it ceremonially.
- Keep warnings visible and prevent the warning count from increasing.
- Use SQLite only when the first persistence slice begins; do not add EF Core to an empty shell.
- Do not add an AI SDK in the baseline.
- Do not add Docker before there is a real deployment or isolation requirement.

## Baseline implementation sequence

### 1. Create the solution

- Create `global.json` using the verified installed .NET 10 SDK.
- Create the solution and Razor Pages project.
- Create an integration test project; add a unit-test project with the first domain behavior.
- Reference the web application from the integration tests only as needed.
- Run restore and build before recording commands anywhere.

### 2. Add one meaningful smoke test

- Add an application-factory integration test for the home page.
- Assert a successful response and one stable page marker.
- Avoid empty tests whose only purpose is making the suite green.

### 3. Establish deterministic verification

Create `scripts/verify.sh` that runs, in order:

1. restore with locked/reproducible inputs where supported;
2. Release build;
3. format verification;
4. complete test suite.

The exact commands must be executed successfully before being added to `AGENTS.md`.

### 4. Add project guidance

Create a concise `AGENTS.md` containing only verified facts:

- project purpose and current scope;
- directory layout;
- exact build, test, format, and run commands;
- dependency and package rules;
- secrets policy;
- definition of done using `scripts/verify.sh`;
- rules against weakening tests, gold-plating, committing secrets, or committing/pushing without an explicit request.

### 5. Add neutral safety files

- Ensure user secrets and local SQLite files are ignored.
- Add repository-local CI under `.github/workflows`.
- Configure dependency updates only for ecosystems actually present.
- Add CodeQL configuration appropriate for C#.
- Add secret scanning without claiming that a skipped scanner is a pass.

AI-specific local files should follow the harness visibility decision in `04-harness-integration-plan.md`.

## What the baseline must not contain

- Learning roadmap entities.
- The seven mastery dimensions.
- AI provider interfaces or prompts.
- Authentication or multi-user support.
- Repository pattern, mediator, CQRS, event bus, or generic result wrappers.
- Docker, Redis, PostgreSQL, vector databases, or embeddings.
- Generated sample curriculum.
- Fake production abstractions added only for a future possibility.

## Verification checklist

Before the baseline commit is ready:

- [x] `dotnet --version` matches `global.json`.
- [x] Restore succeeds from the Solo Master directory.
- [x] Release build succeeds with zero warnings.
- [x] Format verification exits zero and changes no files.
- [x] The integration test passes.
- [x] `scripts/verify.sh` exits zero when invoked outside the repository.
- [x] The web app starts locally using the documented command.
- [x] The home-page smoke test exercises the real ASP.NET Core pipeline.
- [x] No files have been staged by the harness setup.
- [x] The fake-secret test is blocked by the active pre-commit hook.
- [ ] The staged diff is reviewed before committing.

## Suggested commit boundaries

If the baseline becomes too large for one clear review, prefer these commits:

1. `docs(solo-master): add research and foundation plan`
2. `feat(solo-master): scaffold Razor Pages application`
3. `test(solo-master): add deterministic verification`
4. `ci(solo-master): add scoped security and quality checks`

If a single baseline commit remains small and understandable, use the recommended `feat(solo-master): establish project foundation` message.

## Exit condition

The initial foundation is ready only when a fresh session can read `AGENTS.md`, run one verification command, and receive deterministic proof that the empty application is healthy.
