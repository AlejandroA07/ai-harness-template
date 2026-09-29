# Machine setup

The setup is Windows-first on this machine and portable to macOS/Linux. It never installs missing tools silently and never changes configuration in dry-run mode.

Preview the receipt-backed full managed profile:

```powershell
node scripts/machine-setup.mjs
```

The target defaults to the current home directory. Use `--target
<absolute-home-path>` for an isolated target. Add `--legacy-root
<absolute-old-checkout>` only when migrating the exact layout created by the
retired checkout-bound setup. To select only one platform's
global guidance and settings, follow the [global lifecycle guide](docs/dev/modularity-m3-global-configuration.md).
It uses an explicit target and preserves unrelated configuration. Do not run
the full-profile audit to judge a selective installation; use the matching
`setup.mjs audit --module global-configuration` command.

## 1. Required tools

- Node.js 18 or newer (Node 22 recommended)
- Git
- GitHub CLI (`gh`)
- Claude Code
- Codex CLI
- Gitleaks
- Zizmor

.NET SDK and Docker are conditional: install them only for projects that use them. Pin .NET projects with `global.json`; pin application dependencies with their normal lock files.

The preview checks the required inventory:

```powershell
node scripts/machine-setup.mjs
```

Missing required tools block the plan. Missing optional tools are warnings. On
Windows, prefer `winget`; on macOS, prefer Homebrew; on Linux, use the vendor's
supported package path.

## 2. Apply

Review the dry run, then:

```powershell
node scripts/machine-setup.mjs --apply
```

Settings are merged: unrelated permissions and hooks are preserved, while
explicitly retired harness-owned rules are removed. Conflicting or ambiguous
existing state blocks the apply for review.

The apply step:

- installs the global Claude and Codex guidance;
- disables Claude's automatic Git attribution;
- removes retired harness-owned Claude tool denials while preserving secret-path denials;
- installs the machine-wide command/secret guard;
- installs the exact canonical skill inventory into a target-owned store and links it into the official user locations;
- enables this template's Git hooks.

Receipts under `~/.ai-harness/installations/` record ownership for later audit,
updates, restoration, and removal.

It does not enable, remove, or reconfigure MCP servers.

### Token-focused Claude CLI

Start a development session through the native tool allowlist:

```powershell
node scripts/claude-dev.mjs
```

Arguments are forwarded to Claude, for example `node scripts/claude-dev.mjs --model sonnet`. Customize the available developer tools in `global/claude-tools.json`; use `node scripts/claude-dev.mjs --print-tools` to inspect the active list. This launcher uses Claude's `--tools` option, so excluded built-ins are unavailable to the model instead of merely being rejected after selection. Direct `claude` launches and Claude Desktop do not use this allowlist.

The canonical `skills/` tree is the complete source of truth for harness-managed user skills. Existing visible skills, case variants, custom Claude agents, linked roots, or ambiguous ownership block setup for review. Hidden platform-managed entries and ordinary non-skill files are left alone; Codex system and plugin skills outside these two directories are not owned by the harness.

The reviewed 22-skill inventory and the deliberately excluded skills are listed in `POCOCK-SKILLS-COMPARISON.md`. A skill absent from the canonical tree is not part of this harness, even when a historical or manually installed copy still exists on the machine.

The harness uses Claude's built-in agents for delegation and skills for reusable workflows. It intentionally installs no files under `~/.claude/agents/`; the audit fails when custom agents are present because every discovered description adds startup context. Setup never deletes unknown custom agents automatically.

## 3. Trust and verify hooks

Codex requires interactive trust for changed non-managed hooks. Open a new Codex session, run `/hooks`, inspect the generated command, and trust it. This step cannot be automated without bypassing the safety feature.

Then run:

```powershell
node scripts/machine-setup.mjs audit
node scripts/verify.mjs
```

The machine audit checks the receipt-backed installation. `verify.mjs` tests the template repository itself, including its executable security gates; exit code `0` is the only definition of done.

The audit enforces the same exact visible skill inventory and rejects linked skill roots, noncanonical entries, case variants, stale links, and missing canonical links. It will continue to warn about Codex hook trust because the public CLI does not expose a stable non-interactive trust-status check.

## 4. Context-cost baseline

After restarting both agents, capture the first runtime samples described in `TOKEN-COSTS.md`:

- Claude: `/context`
- Codex: `/status`

Record the CLI version, model, project, enabled MCPs, and measurement method. Do not parse transcripts or private agent caches.

## Recovery

Setup is idempotent. Rerun the preview after upgrades. To preview complete
restoration and removal, run `node scripts/machine-setup.mjs remove`; add
`--apply` only after reviewing it. Conflicting external changes stop removal
instead of overwriting them.

## Known limitation

The settings, hooks, and harness source run under the same OS user as the agent. Audit and Git review detect drift, but they cannot make those control files tamper-proof while still allowing the agent to maintain the harness. A stricter maintenance-mode or OS-permission boundary requires a separate design decision.
