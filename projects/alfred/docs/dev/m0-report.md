# M0 Report — Skeleton, Harness & Every Decision Made

> Written 2026-07-10. This documents everything done in milestone M0: what exists, why it's shaped this way, every pattern used, and what was verified. Read top to bottom once; afterwards use it as a reference.
> Product plans live in `docs/planning/` — this file is about the *implementation*.

---

## 1. What exists now

```
~/alfred
├── Alfred.slnx                  ← solution (.slnx = new .NET solution format, default in .NET 10 SDK)
├── Directory.Build.props        ← rules applied to EVERY project (see §4)
├── Directory.Packages.props     ← all NuGet versions in one place (see §4)
├── .editorconfig                ← formatting + analyzer-severity tuning
├── docker-compose.yml           ← Postgres 17 for local dev
├── dotnet-tools.json            ← local dotnet tools (dotnet-ef)
├── README.md                    ← public-facing: how to run (committable, no AI signature)
├── scripts/verify.sh            ← THE definition of done (see §7)
├── src/
│   ├── Alfred.Api/              ← the only executable: HTTP host + composition root
│   ├── Alfred.SharedKernel/     ← shared abstractions (empty until modules need them)
│   └── Alfred.Modules.*/        ← Identity (real), 7 more (empty placeholders)
├── tests/Alfred.Tests/          ← xUnit + architecture tests
├── web/                         ← React 19 + TypeScript + Vite PWA (pnpm)
├── docs/                        ← NEVER committed (git-excluded): planning/ + dev/ (this file)
└── .github/                     ← CI + security workflows (committed — carries no AI signature)
```

Hidden, local-only (git never sees them): `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.mcp.json`, `.githooks/`, `docs/` — all listed in `.git/info/exclude` (a gitignore that itself never gets committed).

---

## 2. Backend — the modular monolith

### The pattern
One deployable app, but internally split into modules that behave like separate services without the operational cost of microservices. Rules:

- **`Alfred.Api`** is the only executable. It references every module and composes them in `Program.cs`. It contains no domain logic.
- **Each module** (`Alfred.Modules.X`) owns its domain: entities, use cases, its own `DbContext` and migrations, and its endpoint definitions.
- **Modules may reference `Alfred.SharedKernel` and nothing else.** Never each other. When Finance needs to react to something in Purchases, that goes through a domain event or an interface composed in the Api — never a direct project reference.
- This rule is **enforced by a test**, not by discipline: `tests/Alfred.Tests/ArchitectureTests.cs` loads every module assembly and fails if it references another module. Adding a module = add classlib + Api reference + one entry in the test's list.

### The module wiring pattern (copy this for every new module)
`Alfred.Modules.Identity` is the reference implementation. Every module exposes exactly two extension methods:

```csharp
services.AddIdentityModule(connectionString);   // registers DbContext, services, options
app.MapIdentityModule();                        // maps its endpoints under /api/<module>
```

`Program.cs` stays a short, readable list of `Add...Module()` + `Map...Module()` calls.

### Auth (Identity module — the one real module so far)
- **ASP.NET Core Identity** with `MapIdentityApi<AlfredUser>()` — the framework's built-in, battle-tested endpoints (`/api/auth/register`, `/login`, `/manage/info`, refresh, password reset plumbing) instead of hand-rolled auth. Hand-rolled auth is where security bugs live; we wrote ~40 lines total.
- **Cookie sessions** (`useCookies=true&useSessionCookies=true` on login) — right choice for a same-origin SPA: HttpOnly cookies mean tokens are never held in JavaScript.
- `AlfredUser : IdentityUser` adds `DisplayName`. Identity tables live in their own Postgres schema `identity` (each module gets its own schema — keeps ownership visible in the DB too).
- Password policy: min length 10, unique email required.

### Database & migrations
- **EF Core + Npgsql**, one `DbContext` per module, migrations live inside the module (`src/Alfred.Modules.Identity/Migrations/`).
- Create: `dotnet ef migrations add <Name> --project src/Alfred.Modules.Identity --startup-project src/Alfred.Api` (`dotnet-ef` is a repo-local tool: `dotnet tool restore` brings it).
- **Development-only auto-migrate on startup** (`Database.MigrateAsync()` guarded by `IsDevelopment()`). Before any shared deployment this becomes an explicit migration step — the guard is already written so it can't leak to prod.

---

## 3. Frontend — React PWA

- **Vite + React 19 + TypeScript**, from the official template (which now ships **oxlint** as the linter — Rust-based, very fast; `pnpm run lint`).
- **PWA** via `vite-plugin-pwa`: generates the service worker + web manifest so the app is installable on phones (Add to Home Screen) and can later receive Web Push. Icons are solid-color placeholders (`web/public/icon-192/512.png`) — replace with a real design whenever.
- **Dev proxy instead of CORS**: `vite.config.ts` forwards `/api` → `http://localhost:5037`. Browser thinks it's one origin, so no CORS headers needed, and cookies just work. In production the API serves the built SPA itself (`UseStaticFiles` + `MapFallbackToFile("index.html")` in `Program.cs`) — same one-origin story.
- `App.tsx` is a minimal login/register screen against the Identity endpoints + a logged-in placeholder. Deliberately no router, no state library, no styling framework yet — those get chosen when M1 gives them a real job (AGENTS.md tells agents not to introduce one unprompted).

---

## 4. Build hygiene (.NET) — the invisible quality layer

All in `Directory.Build.props` (applies to every project automatically):

| Setting | What it does |
|---|---|
| `TreatWarningsAsErrors` | A warning fails the build. Quality can't rot silently. |
| `AnalysisLevel = latest-recommended` | Microsoft's built-in analyzers incl. security rules (CA-series). |
| `RestorePackagesWithLockFile` | Every project gets `packages.lock.json`; CI restores `--locked-mode`, so a dependency can't silently change between my machine and CI — supply-chain + reproducibility. |

Plus:

- **Central Package Management** (`Directory.Packages.props`): every NuGet version is declared once, projects reference packages without versions. No version drift between projects.
- **SonarAnalyzer.CSharp** as a solution-wide analyzer (found real issues already during M0 — flagged empty placeholder classes and a sync-over-async `app.Run()`; both fixed).
- **`.editorconfig`**: formatting rules + two analyzer demotions per the harness template — `CA1707` (underscores in test names, conflicts with the xUnit convention `Method_does_thing`) and `CA1848` (LoggerMessage micro-optimization).
- Escape hatch: `dotnet build -p:DisableExtraAnalyzers=true` when you need a fast dirty build.

---

## 5. Package manager: npm → pnpm (your supply-chain question)

Your instinct was right. The wave of 2025 npm attacks (the chalk/debug hijack, Shai-Hulud worm) worked in two ways: malicious **install scripts** that execute on `npm install`, and **freshly-published hijacked versions** that get pulled minutes after the attacker publishes them. Important nuance: the *registry* is the same for every manager — what differs is how the client defends you.

**Switched to pnpm 11** (installed via Homebrew), which defends both vectors *by default*:

| Defense | How it works |
|---|---|
| **Install scripts blocked** | Dependencies' lifecycle scripts don't run unless explicitly allow-listed (`allowBuilds` in `web/pnpm-workspace.yaml`). The #1 attack vector, gone by default. |
| **`minimumReleaseAge: 4320`** (we set 3 days; v11 default is 1 day) | pnpm refuses to install any version published less than 3 days ago. Hijacked releases are typically detected and yanked within hours — the cooldown means they never reach us. |
| **Exotic transitive deps blocked** | Transitive dependencies can't come from git URLs/tarballs, only the registry. |
| **`--frozen-lockfile` in CI** | CI installs exactly what `pnpm-lock.yaml` says or fails. |

What changed: `web/package-lock.json` → `web/pnpm-lock.yaml`, new `web/pnpm-workspace.yaml` (settings), CI frontend job uses `pnpm/action-setup` (SHA-pinned), all docs/scripts say `pnpm run ...`. Dependabot's `npm` ecosystem entry covers pnpm lockfiles, no change needed.

Rule for future work (also written into AGENTS.md): never lower `minimumReleaseAge` or allow-list a package's build script just to make an install work — that's the attack surface.

---

## 6. CI & security (committed to GitHub — none of it looks AI-assisted)

`.github/workflows/ci.yml` — on every push/PR to main:
- **backend**: locked restore → format gate (split into `whitespace` + `style` checks, so third-party analyzer findings don't break the formatter gate) → Release build → tests.
- **frontend**: pnpm frozen install → lint → build.
- **secret-scan**: gitleaks over the full git history.

`.github/workflows/codeql.yml` — GitHub's semantic security analysis, matrix over `csharp` + `javascript-typescript`, `security-extended` query pack, weekly schedule.

`.github/dependabot.yml` — weekly dependency PRs for NuGet, npm(/web), GitHub Actions; minor/patch grouped into one PR.

Hardening details:
- **Every action is pinned to a commit SHA** (not a tag — tags can be moved to malicious commits; a SHA can't). New SHAs get resolved with `git ls-remote <repo> "refs/tags/<tag>^{}"`.
- **`persist-credentials: false`** on every checkout; `permissions: contents: read` as the default.
- **zizmor** (workflow security scanner) reports **zero findings** — re-run after any workflow edit: `zizmor .github/workflows/`.

These become active the moment you push to GitHub; nothing to configure there beyond creating the (private) repo.

---

## 7. The harness — what each piece is and what it does

Applied from `~/dev/ai-harness-template` per its BOOTSTRAP.md. Plain-language tour:

| Piece | What it is |
|---|---|
| `AGENTS.md` | The project brief every AI agent reads first: architecture, exact verified commands, security laws, the NEVER list, definition of done. Every command in it was actually run before being written down. |
| `CLAUDE.md` | Claude-specific pointer that includes AGENTS.md and adds Claude workflow notes (/verify, /code-review). |
| `.githooks/pre-commit` | Runs **gitleaks** on staged changes — a commit containing a secret is physically blocked. `git config core.hooksPath .githooks` activates it (already done). |
| `.claude/hooks/format-changed.sh` | After an AI session touches files, auto-formats them so the CI format gate never fails on style. |
| `.claude/harness-mode.sh auto\|manual\|status` | Your autonomy switch. AUTO (current): edits auto-accepted, this project's build/test/format/pnpm commands pre-approved. MANUAL: everything asks first. Deny-rules (secrets etc.) are unaffected by the mode. |
| `.claude/settings.local.json` | Machine-local output of that switch (18 allow rules currently). |
| `scripts/verify.sh` | The deterministic "am I done" gate: backend build → format+lint gates → tests → frontend build. Green = done; nothing else counts. |
| `.git/info/exclude` | Keeps ALL of the above plus `docs/` invisible to git — the repo shows no AI tooling. |

### Bugs found in the harness itself during M0 (both fixed, also in your template)

1. **`format-changed.sh` never ran its .NET branch.** It detected .NET with `ls ./*.sln ./*.csproj` — but `ls` exits non-zero when *any* glob is unmatched, so having a `.sln` but no root `.csproj` (i.e., every normal solution layout) silently disabled it. Also predates `.slnx`. Fix: `compgen -G` per pattern + `.slnx` added. **This proved BOOTSTRAP's own warning: "a broken hook looks identical to a working one" — always run the verification probes.**
2. **`dotnet format --include <many files>` silently no-ops** on larger file lists (observed with SDK 10.0.201 + slnx): exit 0, nothing formatted. The hook now formats the whole solution instead (seconds, always correct).

Both fixes are in this repo **and** ported to `~/dev/ai-harness-template` (uncommitted there — commit it when you get a chance).

### Verifications performed (BOOTSTRAP step 4/8 gates — all passed)
- Fake AWS key staged → pre-commit hook **BLOCKED** it (gitleaks found it, exit 1).
- Deliberately misformatted C# file → format hook fixed it.
- `git status` shows **zero** AI files and no `docs/`.
- `scripts/verify.sh` → ALL GREEN (after the pnpm migration too).
- zizmor → zero findings.
- End-to-end auth against real Postgres: `/api/health` ok, register 200, login 200, `/manage/info` returns the user.

Remaining from BOOTSTRAP's final gate (owner actions): approve MCP servers in a fresh `claude` session; commit.

---

## 8. Loose ends & deliberate deferrals

| Item | Status |
|---|---|
| `smoke@test.local` user | Exists in your local DB from verification (password `Sm0ke-test-pass!`). Harmless; delete via `docker compose down -v` (wipes the whole dev DB) or leave it. |
| PWA icons | Solid-color placeholders. Replace `web/public/icon-192.png`/`icon-512.png` when you have a design. |
| Stryker (mutation testing) | Deferred to M1 — pointless with only architecture tests; add when Finance has real logic. |
| Playwright E2E | Deferred to M1 for the same reason. |
| Standing goals (`.claude/goals/`) | Template ships three generic ones; project-specific goals get added as things worth keeping true accumulate. |
| First commit | Everything is uncommitted on `main`. Feature-branch rule applies from the second change onward; the initial scaffold commit on main is your call. |

Suggested first commit message: `Initial skeleton: modular monolith, Identity auth, React PWA (pnpm), Postgres, CI`

---

## 9. Post-M0 incident log

### 2026-07-10 — first CI run failed (CA1825) → SDK now pinned

First push to GitHub failed the backend build: `CA1825 Avoid unnecessary zero-length array allocations` on `ArchitectureTests.ModuleNames() => [.. ModuleAssemblies]`. Local build was green. Root cause: a **toolchain version gap** — CI asked for `dotnet-version: "10.0.x"` (= newest SDK, newer analyzers) while local runs 10.0.201; ironically the flagged collection expression had been introduced by our own `dotnet format style` pass. Two fixes:

1. The method now builds the `TheoryData` with an explicit loop — a shape neither the analyzer flags nor the formatter rewrites.
2. **`global.json` pins the SDK** (`10.0.201`, `rollForward: latestPatch`) and both workflows now use `global-json-file: global.json` instead of `dotnet-version: "10.0.x"` — local and CI compile with the same SDK, so `verify.sh` green actually predicts CI green.

Lesson recorded as a rule: any toolchain CI uses must be version-pinned to what runs locally (SDK via global.json; actions via SHA; node/pnpm versions in the workflow). When updating the local SDK, update `global.json` in the same commit.

### 2026-07-10 — CodeQL upload failed on the private repo (missing `actions: read`)

CodeQL *analysis* succeeded (all C#/TS files scanned) but the SARIF upload failed with `Resource not accessible by integration`. On **private repositories** the codeql-action's upload step also calls the Actions API and therefore needs `actions: read` in the job permissions — GitHub's own starter workflow includes it with exactly that comment; the harness template didn't. Added to `codeql.yml` here and in the template. The "Node 20 is being deprecated" lines in the same log are runner deprecation notices, not errors — SHA-pinned v4 actions run fine on Node 24.

If a future run fails with "GitHub Advanced Security must be enabled for this repository": that's a different thing — code scanning on private repos requires GitHub's paid Code Security add-on (it's free on public repos). Options then: keep the workflow (it activates the day the repo goes public) or disable the schedule until then.

## 10. Daily commands cheat sheet

```bash
docker compose up -d                                        # database
dotnet run --project src/Alfred.Api --launch-profile http   # API on :5037
cd web && pnpm run dev                                      # UI on :5173 (proxies /api)

scripts/verify.sh                                           # the "am I done" gate
.claude/harness-mode.sh manual                              # make the AI ask for everything
.claude/harness-mode.sh auto                                # back to full flow
```
