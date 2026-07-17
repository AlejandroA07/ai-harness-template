# MACHINE-SETUP — rebuild the harness on a fresh machine (macOS)

Audience: a human, or an AI agent told *"read MACHINE-SETUP.md and set this machine up."*
Everything is idempotent. After this, use `BOOTSTRAP.md` per project.

## 1. Core tools

```bash
# Homebrew (if missing): https://brew.sh
brew install git gh gitleaks zizmor node
brew install --cask docker        # or Docker Desktop / OrbStack by preference

# .NET SDK — match the version in the project's global.json
brew install --cask dotnet-sdk

# Claude Code
npm install -g @anthropic-ai/claude-code
```

Authenticate: `gh auth login` (GitHub) and run `claude` once to log in.

**About `gh auth login`:** it's the GitHub CLI's one-time interactive sign-in (browser + device code). Pick GitHub.com and the default scopes (`repo`, `read:org`) — grant no more. The token lands in the macOS keychain (fallback: `~/.config/gh/hosts.yml` — that path is in the global Claude deny rules; agents never read it). It's required for: verifying repo visibility mechanically (`gh repo view <repo> --json visibility`), PR/issue/CI operations from the terminal, and any future git-autonomy `pr` level. git push/pull over SSH works without it — so it can lag, but the harness's private-repo checks are blind until it's done. As of 2026-07-15 this machine had it pending.

Verify: `git --version && gh --version && gitleaks version && zizmor --version && node --version && dotnet --version && docker info && claude --version` — every command must succeed.

## 2. Global Claude configuration (applies to every project on the machine)

1. **Security deny rules** — merge the `permissions` block from `global/claude-settings.json` into `~/.claude/settings.json`, preserving any existing keys. These block every project's agent from reading `.env` files, SSH/AWS keys, and certificates, and from force-pushing or bypassing hooks.
2. **Personal preferences** — copy `global/CLAUDE.md` to `~/.claude/CLAUDE.md` and edit to taste. This is how "I commit myself" and "repos must not look AI-assisted" follow you to every project without relying on per-project memory.
3. **Role skills** — copy the folders in `global/skills/` to `~/.claude/skills/`. These are cross-project quality bars and procedures (web-designer, backend-engineer, fullstack-engineer, devops, architecture-designer) that any repo's sessions can invoke; project-specific procedures still live in each repo's `.claude/skills/`. `architecture-designer` + `devops` are the pair to invoke when starting a brand-new project, alongside `BOOTSTRAP.md`.
4. **Codex parity** — if Codex is used on this machine, copy `global/codex-AGENTS.md` to `~/.codex/AGENTS.md`. It mirrors the personal preferences from step 2 (Codex never reads `~/.claude/CLAUDE.md`) and tells Codex to treat each repo's `AGENTS.md` + skills + `verify.sh` as authoritative. Without it, Codex gets the project rules but none of the personal ones. (Gap found and closed 2026-07-15.)
5. **Codex publish guard (machine-wide)** — copy `global/codex-hooks/guard-git-publish.sh` to `~/.codex/hooks/` (chmod +x) and add the hook block from `global/codex-hooks/config-snippet.toml` to `~/.codex/config.toml`. **Do not blind-append:** `hooks = true` must be merged into the *existing* `[features]` table if one exists — a duplicate `[features]` makes the whole config fail to load and every hook silently dead (happened 2026-07-15; `audit-harness.sh` now checks config load). Blocks agent `git commit`/`git push` in every repo, mirroring the global Claude denies. Best-effort (Codex documents incomplete interception on some shell paths) — the gitleaks hook and prose rules stay as the other layers. No `matcher` on purpose: the script self-filters, so a tool-name rename can never silently disable it.
6. **Codex skill discovery** — `mkdir -p ~/.agents/skills` and symlink each folder from `~/.claude/skills/` into it (per-skill links inside a real directory; a symlinked `.agents/skills` dir itself hits openai/codex#11314 and is NOT discovered). Repeat per repo: `.agents/skills/<name> -> ../../.claude/skills/<name>`, and add `.agents/` to `.git/info/exclude`. Verify discovery in an actual Codex session before trusting it.
7. **State privacy** — `chmod 700 ~/.claude ~/.codex ~/.agents`: the directory permission is the security boundary (contents are unreachable by other accounts regardless of file modes). A one-time `chmod 600` on existing files is nice-to-have, but Codex recreates state files as 644 — that's an accepted exception while the parent stays 700, and `audit-harness.sh` documents it (and hard-fails if the directory ever stops being 700). Run the audit after setup and whenever something feels off.

Verify: start `claude` anywhere and ask it to read a `.env` path — it must be denied.

## 3. Get this template onto the machine

This folder (`~/dev/ai-harness-template/`) is the single source of truth and lives *outside* any repo. Carry it to a new machine by one of:

- **Private git repo (recommended):** `cd ~/dev/ai-harness-template && git init && gh repo create ai-harness-template --private --source=. --push` — then on the new machine: `git clone` it. It contains no secrets, but keep it private anyway.
- Copy the folder via AirDrop/rsync/backup.

Keep it updated: when a harness idea proves itself in a real project, fold it back into the template and `reference-implementation.md`.

This repo is also the **versioned backup of every project's local-only harness state** (their `AGENTS.md`, `.claude/`, `docs/`, … are git-excluded in the projects themselves, so without this they have no recovery). Run `./backup-projects.sh` before committing here — it mirrors each project into `projects/<name>/` and secret-scans the snapshots (`.gitleaks.toml` allowlists only the fake self-test key).

## 4. Per-project

Follow `BOOTSTRAP.md`. For the original reference implementation (WestcoastCars/car-dealer) see `reference-implementation.md` — the full inventory, toggle table for every component, and the Claude↔Codex mapping.

## Known traps (learned the hard way — check these first when something's quiet)

- **gitleaks ≥ 8.19 changed its CLI**: `gitleaks protect --staged` runs, prints "no leaks", and scans *nothing*. Use `gitleaks git --pre-commit --staged`. Always run the fake-secret test from BOOTSTRAP step 4 after wiring the hook.
- **`dotnet format --verify-no-changes --severity info` + analyzers**: the gate fails on every analyzer finding, not just style. Split into `whitespace` + `style` subcommands (see `dotnet-extras/analyzers.props.snippet`).
- **`core.hooksPath` is per-clone** — re-run `git config core.hooksPath .githooks` after every fresh clone; it is not carried by the repo.
- **Claude project memory is per-machine and per-folder** — global preferences belong in `~/.claude/CLAUDE.md`, not in memory.
