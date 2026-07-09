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

Verify: `git --version && gh --version && gitleaks version && zizmor --version && node --version && dotnet --version && docker info && claude --version` — every command must succeed.

## 2. Global Claude configuration (applies to every project on the machine)

1. **Security deny rules** — merge the `permissions` block from `global/claude-settings.json` into `~/.claude/settings.json`, preserving any existing keys. These block every project's agent from reading `.env` files, SSH/AWS keys, and certificates, and from force-pushing or bypassing hooks.
2. **Personal preferences** — copy `global/CLAUDE.md` to `~/.claude/CLAUDE.md` and edit to taste. This is how "I commit myself" and "repos must not look AI-assisted" follow you to every project without relying on per-project memory.

Verify: start `claude` anywhere and ask it to read a `.env` path — it must be denied.

## 3. Get this template onto the machine

This folder (`~/dev/ai-harness-template/`) is the single source of truth and lives *outside* any repo. Carry it to a new machine by one of:

- **Private git repo (recommended):** `cd ~/dev/ai-harness-template && git init && gh repo create ai-harness-template --private --source=. --push` — then on the new machine: `git clone` it. It contains no secrets, but keep it private anyway.
- Copy the folder via AirDrop/rsync/backup.

Keep it updated: when a harness idea proves itself in a real project, fold it back into the template and `reference-implementation.md`.

## 4. Per-project

Follow `BOOTSTRAP.md`. For the original reference implementation (WestcoastCars/car-dealer) see `reference-implementation.md` — the full inventory, toggle table for every component, and the Claude↔Codex mapping.

## Known traps (learned the hard way — check these first when something's quiet)

- **gitleaks ≥ 8.19 changed its CLI**: `gitleaks protect --staged` runs, prints "no leaks", and scans *nothing*. Use `gitleaks git --pre-commit --staged`. Always run the fake-secret test from BOOTSTRAP step 4 after wiring the hook.
- **`dotnet format --verify-no-changes --severity info` + analyzers**: the gate fails on every analyzer finding, not just style. Split into `whitespace` + `style` subcommands (see `dotnet-extras/analyzers.props.snippet`).
- **`core.hooksPath` is per-clone** — re-run `git config core.hooksPath .githooks` after every fresh clone; it is not carried by the repo.
- **Claude project memory is per-machine and per-folder** — global preferences belong in `~/.claude/CLAUDE.md`, not in memory.
