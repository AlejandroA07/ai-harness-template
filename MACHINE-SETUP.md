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

The command reports `FOUND`, `MISSING`, or `OPTIONAL`. Install anything marked `MISSING`, then rerun. On Windows, prefer `winget`; on macOS, prefer Homebrew; on Linux, use the vendor's supported package path.

## 2. Apply

Review the dry run, then:

```powershell
node scripts/machine-setup.mjs --apply --replace-guidance
```

`--replace-guidance` is required only when existing global guidance differs. Settings are merged: unrelated permissions and hooks are preserved.

The apply step:

- installs the global Claude and Codex guidance;
- disables Claude and Codex auto-memory;
- disables Claude's automatic Git attribution;
- removes the optional Claude built-ins listed in `components/claude-tool-policy.mjs` while retaining Bash and PowerShell;
- installs the machine-wide command/secret guard;
- generates Claude/Codex skill adapters and safely links them into their official user locations;
- enables this template's Git hooks.

It does not enable, remove, or reconfigure MCP servers.

The harness uses Claude's built-in agents for delegation and skills for reusable workflows. It intentionally installs no files under `~/.claude/agents/`; the audit fails when custom agents are present because every discovered description adds startup context. Setup never deletes unknown custom agents automatically.

## 3. Trust and verify hooks

Codex requires interactive trust for changed non-managed hooks. Open a new Codex session, run `/hooks`, inspect the generated command, and trust it. This step cannot be automated without bypassing the safety feature.

Then run:

```powershell
node scripts/audit.mjs
node scripts/verify.mjs
```

The audit will continue to warn about Codex hook trust because the public CLI does not expose a stable non-interactive trust-status check.

## 4. Context-cost baseline

After restarting both agents, capture the first runtime samples described in `TOKEN-COSTS.md`:

- Claude: `/context`
- Codex: `/status`

Record the CLI version, model, project, enabled MCPs, and measurement method. Do not parse transcripts or private agent caches.

## Recovery

Setup is idempotent. Rerun the dry run after upgrades. It stops rather than overwriting an unknown skill or invalid JSON configuration. Retired machine skills should be moved to the external archive before retrying a reported conflict.
