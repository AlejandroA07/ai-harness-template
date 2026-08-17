# Machine setup

The setup is Windows-first on this machine and portable to macOS/Linux. It never installs missing tools silently and never changes configuration in dry-run mode.

## 1. Required tools

- Node.js 18 or newer (Node 22 recommended)
- Git
- GitHub CLI (`gh`)
- Claude Code
- Codex CLI
- Gitleaks
- Zizmor

.NET SDK and Docker are conditional: install them only for projects that use them. Pin .NET projects with `global.json`; pin application dependencies with their normal lock files.

Run the inventory:

```powershell
node scripts/machine-setup.mjs
```

The command first preflights skill reconciliation, before any machine configuration can be written, and then reports each tool as `FOUND`, `MISSING`, or `OPTIONAL`. Install anything marked `MISSING`, then rerun. On Windows, prefer `winget`; on macOS, prefer Homebrew; on Linux, use the vendor's supported package path.

## 2. Apply

Review the dry run, then:

```powershell
node scripts/machine-setup.mjs --apply --replace-guidance
```

`--replace-guidance` is required only when existing global guidance differs. Settings are merged: unrelated permissions and hooks are preserved, while explicitly retired harness-owned rules are removed.

The apply step:

- installs the global Claude and Codex guidance;
- disables Claude and Codex auto-memory;
- disables Claude's automatic Git attribution;
- removes the optional Claude built-ins listed in `components/claude-tool-policy.mjs` while retaining Bash and PowerShell;
- installs the machine-wide command/secret guard;
- reconciles the visible user skills to the canonical `skills/` inventory, generates Claude/Codex adapters, and safely links them into their official user locations;
- enables this template's Git hooks.

It does not enable, remove, or reconfigure MCP servers.

The canonical `skills/` tree is the complete source of truth for harness-managed user skills. After apply, every visible skill directory or link under `~/.claude/skills/` and `~/.agents/skills/` is either a canonical harness link or has been moved to a recoverable archive under `~/.ai-harness-skill-archive/<session>/<claude|codex>/`. This includes an older manual copy whose name is now canonical and any case-variant spelling of a canonical name. The synchronizer never deletes the displaced entry. The two skill roots themselves must be absent or real directories; linked roots fail closed before enumeration. Hidden platform-managed entries and ordinary non-skill files are left alone; Codex system and plugin skills outside these two directories are not owned by the harness.

The reviewed 22-skill inventory and the deliberately excluded skills are listed in `POCOCK-SKILLS-COMPARISON.md`. A skill absent from the canonical tree is not part of this harness, even when a historical or manually installed copy still exists on the machine.

The harness uses Claude's built-in agents for delegation and skills for reusable workflows. It intentionally installs no files under `~/.claude/agents/`; the audit fails when custom agents are present because every discovered description adds startup context. Setup never deletes unknown custom agents automatically.

## 3. Trust and verify hooks

Codex requires interactive trust for changed non-managed hooks. Open a new Codex session, run `/hooks`, inspect the generated command, and trust it. This step cannot be automated without bypassing the safety feature.

Then run:

```powershell
node scripts/audit.mjs
node scripts/verify.mjs
```

`audit.mjs` checks whether the template is correctly applied to the machine or selected project. `verify.mjs` tests the template repository itself, including its executable security gates; exit code `0` is the only definition of done.

The audit enforces the same exact visible skill inventory and rejects linked skill roots, noncanonical entries, case variants, stale links, and missing canonical links. It will continue to warn about Codex hook trust because the public CLI does not expose a stable non-interactive trust-status check.

## 4. Context-cost baseline

After restarting both agents, capture the first runtime samples described in `TOKEN-COSTS.md`:

- Claude: `/context`
- Codex: `/status`

Record the CLI version, model, project, enabled MCPs, and measurement method. Do not parse transcripts or private agent caches.

## Recovery

Setup is idempotent. Rerun the dry run after upgrades. The dry run reports every skill that will be archived before apply. Apply moves displaced skill directories and links to the external archive automatically, then installs the exact canonical inventory. It stops before machine writes when an entry cannot be reconciled safely, the archive path is not a real directory, or JSON configuration is invalid. Restore an archived entry by moving it out of the archive after first removing or relocating the harness link that replaced it.

## Known limitation

The settings, hooks, and harness source run under the same OS user as the agent. Audit and Git review detect drift, but they cannot make those control files tamper-proof while still allowing the agent to maintain the harness. A stricter maintenance-mode or OS-permission boundary requires a separate design decision.
