# Harness tiers — what runs now (Pro) and what waits for real budget (Max / API)

The harness is deliberately split in two tiers. Everything in **Tier 1 is active today** and fits a Pro subscription used interactively. Everything in **Tier 2 is documented, ready, and dormant** — each item has an *activation condition* and a *setup guide*, so turning one on is a 15-minute decision, not a research project.

## Why the split exists (read this before activating anything)

**The economics.** A subscription bills a flat rate for interactive use; autonomous machinery bills per token and compounds:
- A loop re-sends its whole growing context every iteration. Ten passes ≠ 10× one prompt; it's 10 prompts that each get bigger.
- Maker/checker (one agent works, a second verifies) roughly doubles every run — and it's also the single biggest quality lever, so Tier 2 assumes you pay it.
- Scheduled/cloud agents run whether or not you look at the results.

**The metric that decides everything: cost per accepted change.** Not tokens spent, not loops run. If a loop produces ten results and you throw away six, you're doing the review work it was supposed to save. Below ~50% acceptance, shut it off.

**The spending rule (asset vs throughput).** Anything you'll still be using in a month — a skill, a standing prompt, an architecture decision, a hard irreversible call — is an **asset**: spend the strongest model on it, once. Anything discarded within days — drafts, summaries, chatter — is **throughput**: cheapest model that clears the bar. Most people misallocate in both directions.

**The philosophy guard.** Tier 1 is pull-not-push: Manuel decides when things run, sees every result, and the harness's deny rules never loosen. Tier 2 adds push (schedules, loops, fleets) — which is why every Tier 2 item requires its own verifier gate. Autonomy without a gate is spend without progress.

---

## Tier 1 — active now (Pro plan, interactive)

The complete current inventory; per-file details in `reference-implementation.md`.

| Layer | Components |
|---|---|
| Context | `AGENTS.md` (source of truth) · `CLAUDE.md` (thin import) · project skills (`security-checklist`, `retro`, plus per-repo: `migrate`, `deploy`, `db`, `new-feature`) · global role skills (`web-designer`, `backend-engineer`, `fullstack-engineer`) |
| Guardrails | deny rules: secrets unreadable, `git commit`/`git push` blocked for agents (Claude via settings, Codex via PreToolUse guard `guard-git-publish.sh`) · gitleaks pre-commit (self-tested) · format-on-stop hook · AUTO/MANUAL autonomy switch |
| Verification | `scripts/verify.sh` (the final vote) · standing goals + `verify-goals.sh` (run manually) · analyzers (built-in + SonarAnalyzer) with `TreatWarningsAsErrors` or warning ratchet · architecture tests · CI: format gate, locked restore, vulnerable-package gate, tests, gitleaks history scan, CodeQL, Dependabot, zizmor-clean workflows |
| Workflow | plan mode first · feature branches · `/verify` → `/code-review` → `/security-review` before PR · retro skill weekly-ish · feed repeated agent mistakes back into AGENTS.md as one-line laws |

Tier 1 habits that cost nothing and are easy to forget:
- **The self-checking loop as a prompt.** You don't need loop infrastructure to get loop behavior in one session: give the agent the task + strict success criteria + "verify each pass against the criteria, fix the weakest point, stop only when all pass or after N tries". That's a loop with you as the scheduler — free, and it's also the *proving ground* every Tier 2 loop must pass through first.
- **Fresh-context review.** A new session reviewing finished work catches what the session that wrote it cannot. `/code-review` and `/security-review` already do this; use them instead of asking the same session "are you sure?".
- **The retrieval test for context files.** After changing AGENTS.md or a skill, ask a fresh session to state the rule. If it can't quote it, the file isn't working.

### Tier 1 hardening option — the OS sandbox (`/sandbox`)

Ready but not enabled (decision 2026-07-12, see `RESEARCH-REVIEWS.md`). Permission rules bind Claude's tools; the sandbox binds **every subprocess at the OS level** (macOS Seatbelt) — the only layer that survives prompt injection and covers "a script opens the file itself".

```jsonc
// ~/.claude/settings.json (all projects) or .claude/settings.local.json (one project)
{
  "sandbox": {
    "enabled": true,
    "excludedCommands": ["docker *"],   // docker is incompatible — required for alfred/car-dealer
    "credentials": {
      "files": [
        { "path": "~/.ssh", "mode": "deny" },
        { "path": "~/.aws/credentials", "mode": "deny" }
      ]
    }
  }
}
```

Or interactively: `/sandbox` → choose auto-allow (fewer prompts, sandbox is the boundary) or regular permissions. Deny rules still apply either way; network domains prompt on first use.

Now wired as a dormant switch: `.claude/sandbox-mode.sh on|off|status` (template `project/.claude/`, installed in alfred 2026-07-13, tested) writes exactly this config into the project's `.claude/settings.json` — turning it on is one command, off restores dormancy.

**Enable when:** anything runs less attended than today — it is a *prerequisite* for every Tier 2 loop/schedule below. **Why not default-on now:** `docker` (alfred's whole dev loop) and Go CLIs like `gh` need exclusions, and every exclusion is a hole; on a fully interactive workflow the marginal value is small. Revisit at first Tier 2 activation.

---

## Tier 2 — dormant capabilities (activate on Max plan / API budget / real need)

Each item: **what** · **activate when** · **how**. The universal build order applies to all of them:

> **1.** get one manual run reliable → **2.** freeze the instructions as a skill → **3.** wrap in a loop with a hard gate + stop condition + iteration cap → **4.** only then put it on a schedule.
> Skipping ahead — scheduling something never proven by hand — is how systems burn money overnight while producing nothing.

And the admission test (all four boxes, or it stays manual):
- [ ] the task repeats at least weekly
- [ ] something automatic can *reject* bad output (test, build, linter, measurable condition)
- [ ] the agent can do the whole job end to end
- [ ] "done" is objective, not taste

### 2.1 Standing-goals heartbeat (cheapest — activate first)

**What:** re-verify the invariants in `.claude/goals/` on a schedule instead of manually. Catches silent regressions (unset hooksPath after a re-clone, scanner breakage, workflow drift) while you're away.
**Activate when:** you notice you haven't run `verify-goals.sh` in over a week, or you're away from a project for stretches.
**How:** it's one cron line per repo — the script and ledger already exist:
```bash
crontab -e
30 7 * * * cd ~/alfred && ./.claude/verify-goals.sh >> .claude/goals/cron.log 2>&1
35 7 * * * cd ~/car-dealer && ./.claude/verify-goals.sh >> .claude/goals/cron.log 2>&1
40 7 * * * cd ~/solo-master && ./.claude/verify-goals.sh >> .claude/goals/cron.log 2>&1
```
No tokens involved (pure shell). Check `goals/ledger.tsv` for FAILs, or have the retro skill read it.

### 2.2 Recurring loops (`/loop`) for chore queues

**What:** Claude Code re-runs a prompt/skill on an interval or self-paced until a condition holds — burn down an analyzer-warning backlog, keep dependency PRs green, migrate a pattern across a codebase.
**Activate when:** the four-box test passes AND a real queue of well-specified chores exists AND `verify.sh`/goals history has looked boring for weeks (the harness is stable enough to trust unattended).
**How:**
1. Prove the chore once manually in a normal session.
2. Write it as a skill with the exact commands and a **hard list of what it must never touch**.
3. Wrap in a loop spec — every serious loop has all five lines:
```text
GOAL:      <objective condition, e.g. "warnings-baseline.txt reaches 0">
EACH PASS: run gate → read failures → pick the single highest-impact one → smallest fix → re-run gate
VERIFY:    scripts/verify.sh exits 0 (the loop may never redefine the gate)
STOP:      goal reached, OR 8 iterations, OR any NEVER-rule would be violated
ON STOP:   summarize what changed, what remains, and the pass/fail evidence
```
4. Run it attended once (`/loop <interval> /<skill>` or self-paced). Only after several boring supervised runs, consider 2.4.
**Budget guards:** iteration cap always; token/cost review after each run; kill below 50% accepted-change rate.

### 2.3 Maker/checker subagents and custom agents

**What:** split the agent that writes from the agent that judges. The writer can be fast/cheap; the reviewer strict and stronger. This is most of the quality in every serious loop, because the model that did the work grades its own homework too kindly.
**Activate when:** any Tier 2 loop goes live (bundle them), or when unattended output starts reaching `main` without your eyes on every diff.
**How:**
- Built-in today, no setup: `/code-review` and `/security-review` already run fresh-context review — always between "agent done" and "Manuel merges".
- Custom: define a read-only reviewer in `.claude/agents/reviewer.md` (frontmatter: model + tools limited to Read/Grep/Bash-readonly; body: the security-checklist + "attack the conclusion, report findings only"). Loops then end with: spawn reviewer → findings must be empty or addressed before ON STOP reports success.
- Rule: **the checker never edits.** It fails work; the maker fixes it. Merged roles collapse back into self-grading.

### 2.4 Scheduled cloud agents (`/schedule` routines)

**What:** cloud-side Claude Code runs on cron — a morning "read goals ledger + CI + Dependabot, fix the trivial, report the rest" routine; a weekly automated retro.
**Activate when:** 2.2's loop has run supervised and boring for ≥2 weeks, and the outputs are worth reading daily. This is the most push-shaped, most-billed item — activate last.
**How:** `/schedule` in Claude Code → describe the routine + cadence; point it at the proven skill from 2.2; give it the loop spec's STOP/ON STOP lines verbatim. Results come to you; the deny rules still hold (it can never commit/push — you merge).
**Known gap to solve at activation (verified 2026-07-15):** `AGENTS.md`/`CLAUDE.md` are git-excluded in all three repos (the no-AI-signature rule), so anything that *clones from GitHub* — cloud routines, remote agents, CI-side agents — sees **no instructions at all**. Any cloud activation must first decide how the context reaches the clone (inline it in the routine prompt, or point the routine at the local checkout).

### 2.5 Deep review on demand (`/code-review ultra`)

**What:** multi-agent cloud review of a branch or PR — several reviewers in parallel, cross-checked findings. The heavyweight checker for changes that matter.
**Activate when:** a change is large, security-sensitive, or touches money/auth — Alfred's finance/auth modules are exactly the profile. Billed per run; treat as an *asset* spend (it protects an irreversible merge).
**How:** on the branch: `/code-review ultra` (or `/code-review ultra <PR#>`). Manuel triggers it himself — agents can't and shouldn't.

### 2.6 Parallel fleets and worktrees

**What:** N agents on N isolated worktrees chewing a partitioned backlog (mass migration, framework upgrade, lint-fix across everything), each gated by `verify.sh`, merged one reviewed PR at a time.
**Activate when:** a genuinely partitionable batch job appears (100+ same-shaped changes) — not before; fleets amplify whatever discipline exists, including none.
**How:** partition the work into independent units → one skill describing the per-unit transformation (proven manually on 3 units first) → agents in worktree isolation, one unit each → every unit passes the gate → human-reviewed PRs. Never let a fleet share a working tree or push anywhere.

### 2.7 Obsidian vault automation (from research review #2)

**What:** AI-filed personal notes: inbox → auto-filed + backlinked, weekly synthesis.
**Activate when:** a hand-maintained Obsidian habit has actually survived a month. **How:** see `RESEARCH-REVIEWS.md` §2 for the rules worth keeping (single inbox, immutable raw/, weekly synthesis, link-density as the health metric); wire the morning filing as a 2.4-style scheduled routine only after the manual habit is real. If activated, start from the MIT-licensed [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) (Karpathy's LLM-wiki pattern; implements those rules already — review its skill code before install, and never point the code repos' CLAUDE.md at the vault; see review 2026-07-15 §3).

### 2.8 Git autonomy ladder (built and dormant — default OFF)

**What:** let the agent do git itself, in graduated levels: `commit` (local commits on feature branches; Manuel reviews and pushes) → `push` (feature branches only; bare push, force-push, remote deletes, and any push to main stay mechanically denied) → `pr` (may open GitHub PRs; Manuel merges). The pieces are already installed per repo: `.claude/git-autonomy.sh` (the switch — rewrites only the git entries in `.claude/settings.json`) and `.claude/skills/git/SKILL.md` (the agent procedure; step 0 is the status check, at OFF it refuses).
**Activate when:** an unattended workflow (2.2 loop / 2.4 routine) produces verified work that piles up faster than hand-committing it stays sane — or reviewing diffs in the working tree becomes the bottleneck. Start at `commit`, live with it for weeks before considering `push`; `pr` only alongside 2.3 maker/checker.
**How:** `.claude/git-autonomy.sh commit|push|pr` (Manuel only — the skill forbids the agent to touch the switch). Two locks by design: the script also prints the one manual edit needed in `~/.claude/settings.json`, whose global deny always wins until removed by hand. `off` restores full dormancy.
**Non-negotiables that survive activation:** verify.sh green before any commit, ≤200 lines per commit, gitleaks hook never bypassed, no AI attribution in commits/PRs, never merge, and the agent never raises its own level.

---

## The activation ladder, in one picture

```
you are here
    │
    ▼
Tier 1  interactive, pull-not-push, flat-rate ───────────── active
    │
    │  (free)        2.1 goals cron heartbeat
    │  (four boxes)  2.2 one proven loop, attended, capped
    │  (with 2.2)    2.3 maker/checker split
    │  (2.2 boring   2.4 scheduled routines
    │   for 2 weeks)
    │  (per event)   2.5 ultra review on big merges
    │  (per event)   2.6 fleets for batch jobs
    │  (bottleneck)  2.8 git autonomy: commit → push → pr
    ▼
Tier 2  autonomous, push, metered ──────────────── each item gated
```

Two rules survive every tier: **no agent ever loosens a deny rule** — only Manuel's hand on a switch does (2.8's ladder, the sandbox toggle), and less autonomy is always allowed, less safety never — and **`scripts/verify.sh` stays the final vote** — no agent, loop, schedule, or fleet ever gets to redefine what "done" means.
