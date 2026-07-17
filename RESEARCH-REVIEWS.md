# Research reviews — external material evaluated for the harness

Running log of outside ideas (posts, articles, tools) judged against the harness. The golden rule for admission is unchanged: **adopt principles and cheap pieces now; record install-conditions for machinery; reject what contradicts the security model.** Previous review (the "Agentic OS" post, 2026-07-09) lives in `reference-implementation.md`.

---

## Review 2026-07-12 — four posts brought by Manuel

### 1. "Claude Projects setup course" (X post)

**What it is:** A long guide to setting up Projects in the claude.ai chat app: custom instructions as a standing brief, a small precise knowledge base, retrieval testing, per-conversation model choice, maintenance habits, Cowork projects.

**Verdict: sound advice — but for a different tool than the coding harness.** Claude *Projects* live in the claude.ai app; the coding harness already implements every equivalent, better, in git:

| Post concept (claude.ai) | Harness equivalent (Claude Code) |
|---|---|
| Project instructions (standing brief) | `AGENTS.md` — versioned, verified commands |
| Knowledge base files | `.claude/skills/`, `docs/`, the repo itself |
| "One project per concern" | One repo = one project, already true |
| Scoped memory | Claude Code per-project memory (automatic) |
| Retrieval test | Not needed — files are read directly, not retrieved |

**Adopted:**
- The **retrieval-test mindset** generalizes: after writing a skill or AGENTS.md section, ask the agent in a fresh session to state the rule and watch whether it actually surfaces. A context file nobody can quote back is dead weight. (Cheap habit, no install.)
- The **precision-beats-volume rule** is a good restatement of why AGENTS.md stays short and skills stay one-procedure-each. Already policy; keep citing it when files bloat.

**Filed as a guide, not harness:** the full distilled setup lives in `GUIDE-claude-projects.md` (this repo) for when Manuel uses claude.ai/Cowork for *non-coding* work — study notes, research, writing. That's the tool it's actually about.

**Rejected:** nothing harmful; just don't confuse the two systems. Do not start maintaining project knowledge in claude.ai for the three code repos — it would fork the source of truth away from AGENTS.md.

### 2. "Obsidian vault + Claude via MCP" (X post, @chewadot)

**What it is:** Eight rules for an AI-maintained personal note vault: voice capture into one `inbox/`, immutable `raw/`, morning cron that files and backlinks, weekly synthesis file, graph density as the health metric, context auto-loaded into every session.

**Verdict: a good *personal knowledge* recipe; not harness material.** The harness already settled this split (see `reference-implementation.md` → "Notes and memory"): project knowledge → AGENTS.md; cross-session memory → Claude Code's built-in memory; human thinking → Obsidian, kept human.

**Worth keeping from it (if a note system is ever wanted):**
- One inbox, many outlets — a single capture point beats a filing decision at capture time.
- `raw/` immutability — never let the system rewrite what you actually said.
- The weekly synthesis is the one output a human actually rereads; recurring-themes-and-contradictions is a genuinely good prompt.
- Graph/link density as the only honest health metric — files accumulating without connections = warehouse, not second brain.

**Install-condition:** Manuel actually keeps notes in Obsidian regularly for ≥ a month by hand first (same rule as loops: make the manual version real before automating it). The cron+MCP machinery is Tier-2 (`HARNESS-TIERS.md`) and costs tokens daily forever — do not build it for a vault that doesn't exist yet.

### 3. "Copy Fable 5's brain into a cheaper model before July 12" (X post)

**Verdict: reject the premise, keep two kernels.**

The premise — that a model's capability can be extracted as a prose "operating manual" and transplanted into a cheaper model — is wrong. Reasoning quality lives in the weights, not in a pasted system prompt. A capable model given a "how to think" document does not become the bigger model; and the post's own proof (the 5%-vs-20% trap question) is theater — current mid-tier models catch that arithmetic with no manual at all. The urgency framing ("last days!") is marketing pressure; never act on deadline FUD.

**Kernel 1 (adopted into `HARNESS-TIERS.md` §cost):** the **asset vs throughput spending rule**. Anything reused for a month+ (a skill, a standing prompt, an architecture decision, a big irreversible choice) is an *asset* — spend the strongest model on it once. Anything discarded by Friday (drafts, chat, summaries) is *throughput* — run it on the cheap model. This is the correct way to split spend across model tiers regardless of which models exist.

**Kernel 2 (already practiced, now written down):** having the model **interview you about a repeat workflow and then write the skill file** is a genuinely good authoring technique — it extracts edge cases you'd forget to state. Use it whenever a new skill is born from a real recurring procedure. What makes the skill valuable is *your* workflow knowledge frozen into text — that part really is model-independent and durable.

**Rejected:** the extraction ritual, the transplant test, and any implication that a "manual" substitutes for picking the right model for hard work.

### 4. "What a loop is" + Mira ad (X post)

**Verdict: front half adopted into Tier 2; back half rejected outright.**

The loop theory is the best compact statement of agentic-loop discipline we've seen, and it agrees with the harness's existing philosophy:

- **The verifier is the heart.** Without a gate that can *fail* the work, a loop is the agent agreeing with itself. Our `scripts/verify.sh` is exactly that gate; any future loop wraps it.
- **The four-box test for whether a loop is warranted at all:** repeats ≥ weekly · something can automatically reject bad output · the agent can do the whole job · "done" is objective. Miss one box → stay manual. This is now the admission test in `HARNESS-TIERS.md`.
- **The build order:** reliable manual run → save as skill → wrap in loop (gate + stop condition + iteration cap) → only then schedule. Scheduling something unproven is how loops burn money overnight.
- **Cost mechanics:** every iteration re-sends a growing context; maker/checker doubles the bill; track **cost per accepted change**, and below ~50% acceptance the loop costs more than it gives.
- **Failure mode to design against:** the quiet half-done exit (agent declares victory early; loop keeps billing). Hard gates, iteration caps, and "on stop: report what changed and what still fails".

All of this is folded into `HARNESS-TIERS.md` Tier 2 with concrete Claude Code mappings (/loop, hooks, subagents, schedules).

**Mira (Telegram assistant): rejected, twice over.**
1. **Security:** it's a third-party service that wants OAuth into Gmail, Calendar, Linear, Stripe, "500+ apps", with long-term memory of everything it sees, running models chosen by the vendor. That is the opposite of the harness security model (secrets never leave the project's mechanism; every input is attacker-reachable). Connecting personal email/finance to it fails the "prefer the secure default" rule with no compensating control.
2. **Strategy:** Mira *is* the product category Alfred is being built in — a personal life-admin assistant with connectors, memory, and scheduled skills. It's useful as **competitive product research for Alfred** (their skill-phrasing UX, "trigger + action in one plain-language message", voice-first capture, group-chat catch-up are good feature ideas to evaluate in `docs/planning/`), not as infrastructure to hand Manuel's life to.

---

## Review 2026-07-12 (second pass) — official Claude Code docs: permissions & sandboxing

Read the current official docs (permissions, sandboxing) to check the harness against what the tool actually enforces in mid-2026. Findings:

**Confirmed our design:**
- Precedence is deny → ask → allow, and a deny at any scope beats an allow at any other scope. Hooks can't override deny rules; a blocking hook (exit 2) even beats allow rules. So the layered setup (global denies + project denies + PreToolUse guard) is defense-in-depth, not redundancy.
- Bash rules are compound-command aware (`git status && git commit` — each subcommand matched separately), so `Bash(git commit:*)` deny can't be smuggled past with `&&`.
- Read/Edit deny rules follow gitignore semantics: a bare filename matches at any depth, so `Read(.env)` ≡ `Read(**/.env)`. Simplified the deny lists accordingly (`.env` + `.env.*` covers everything).
- Known limitation: Read deny rules bind Claude's file tools and recognized file commands (cat/head/sed), **not** arbitrary subprocesses (a Python script opening the file). The OS-level answer is the sandbox (below).

**Adopted:**
- `disableBypassPermissionsMode: "disable"` in `~/.claude/settings.json` — self-lockout of bypass mode, machine-wide. No workflow here ever needs bypass; removing the possibility is free hardening.
- `git commit` / `git push` denies promoted from per-project to **global** user settings — user-scope deny beats any project allow, so no future repo can accidentally re-enable agent commits.
- `ask` rules noted as available middle tier (deny → **ask** → allow) — the right tool when something should be possible but always eyeballed (e.g. `Bash(dotnet ef database update *)` if migration application ever needs prompting). None installed yet; document-first.

**Recorded with install-condition — OS sandbox (`/sandbox`):**
Claude Code's Bash sandbox (macOS Seatbelt) enforces filesystem/network limits at the OS level — the only layer that binds *subprocesses*, closing the "script reads .env" gap, and it holds even under prompt injection. Recipe and caveats in `HARNESS-TIERS.md` §1-hardening. Not enabled today because: `docker` is incompatible (alfred's dev loop is compose-based, so `docker *` would need `excludedCommands`, weakening the point), and Go-based CLIs (`gh`) hit TLS issues under Seatbelt. Install-condition: running anything less attended than today (loops/schedules from Tier 2 — enable the sandbox *first*), or a low-docker project wanting the extra layer cheaply.

## Review 2026-07-12 (third pass) — "should the harness teach patterns / language dos-and-don'ts?"

Manuel asked whether to add skills encoding obvious programmer/designer/language knowledge. Researched Anthropic's skill-authoring guidance (start minimal, add from *observed failure modes*; skill descriptions cost one line until invoked; skill = how, standing context = when) and reviewed every harness component for bloat vs gaps.

**Verdict — written up in full in `GUIDE-what-goes-where.md`:**
- Language/pattern knowledge the model already has (L0): never encode — verified restatement is bloat.
- The legitimate "C# patterns skill" already exists and is free: **analyzers** (Sonar caught 5 real findings in scaffold code this week; xunit.v3 analyzers forced correct cancellation tokens). Anything checkable by a tool gets a tool, not prose.
- Skills are justified only as *procedures* (migrate, db) or *default-shifters* where the model is capable but defaults badly (web-designer's anti-slop bar). The five role skills pass this test; a "C# tutorial skill" does not.
- Post-cutoff drift is handled by context7 on demand + version checks at scaffold time; freeze a "gotchas" note only after the same mistake happens twice.
- Measured the whole harness: AGENTS files 730–930 words, skills 290–770 — no bloat today, nothing missing at the enforcement layer. Admission test added to the guide for every future candidate.

## Review 2026-07-12 — audit of an AI-performed bootstrap (solo-master)

A second AI applied this template to the new solo-master project; its work and its self-audit were reviewed in detail. Its audit findings were **verified accurate** (all five package-version claims checked against live NuGet; the global.json/CI mismatch, missing vuln gate, missing Sonar layer, missing standing goals, and missing Codex guard were all real and are now fixed). What it got **wrong in the doing** became the "Lessons" section of `BOOTSTRAP.md` — eight concrete don'ts, the biggest being: it argued against the owner's standing local-only policy instead of implementing it, left every AI file committable, and wrote AI-signature text into the committable README.

## Review 2026-07-15 — three posts + three video transcripts brought by Manuel

Six items this round: three X posts (context engineering / "8x", designing with AI, Obsidian second brain) and three YouTube transcripts (harness & loop engineering, Chip Huyen's *AI Engineering* summarized, an "AI engineer roadmap"). The transcripts are learning material more than harness material — their distilled value went into the new `GUIDE-ai-engineering-learning.md` (concepts, terminology, roadmap). What follows is the harness verdict per item.

### 1. "Anthropic engineers merge 8x more code — context engineering" (X post)

**Fact-check first.** The 8x stat is real — Anthropic's own report ("How AI Is Transforming Work at Anthropic", Q2 2026) says the typical engineer merges ~8× as much code per day as in 2024, and >80% of merged code is authored by Claude. Two distortions in the post: Anthropic explicitly caveats that lines-of-code "almost certainly overstates the true productivity gain", and the claim that "nothing about the model changed" is false — the model generations changed enormously over that period. The referenced article is also real: [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (Sept 2025). Trust the sources, not the framing.

**Verdict: validation, not news.** Every mechanism the post prescribes already exists here, mostly in stronger form:

| Post's prescription | Harness reality |
|---|---|
| 3-layer stack (global / project / task) | `~/.claude/CLAUDE.md` + role skills / `AGENTS.md` + project skills / plan mode + the prompt |
| AGENTS.md as the error-collecting file | Already the source of truth; retro skill is the error→law pipeline |
| Memory file read at start, updated at end | Claude Code auto-memory, per project, already on |
| MCP for outside context | context7 + Playwright installed; more on real need only |
| "Context stack loading sequence" | This is just what Claude Code does; no ritual needed |

**Adopted (one cheap habit):** the post's "context-engineered task" brief is a good default shape for nontrivial prompts — four lines: *goal (and why) · relevant files · constraints (which AGENTS.md rules bite) · success criteria*. Costs nothing, front-loads what plan mode would otherwise have to dig for. Use it; don't template it into a file.

**Rejected:** the weekend "build all layers" plan (built long ago), and the implied metric — merged-LOC is exactly the metric the tiers doc already replaced with **cost per accepted change**.

### 2. "Designing with AI — taste is the gap" (X post)

**What it is:** content marketing (affiliate Mobbin link, TasteSkill promo) wrapped around a sound core process: define meaning → collect references → map structure → build component-by-component → custom assets.

**Verdict: the core process agrees with the harness; the product placements are noise.** The `web-designer` role skill is precisely the post's "Method 1" done right — a default-shifter against AI slop — and its quality bar already demands intent before pixels.

**Adopted (habits, no file changes — the admission test in `GUIDE-what-goes-where.md` keeps them out of skills until a real failure justifies a line):**
- **Reference-driven prompting.** For any UI work that matters, collect 3–5 real screenshots/links first and hand them over with "combine the direction, don't copy". An inspiration folder per project is a *human* habit, not agent machinery.
- **Component-by-component beats "build the site".** Already how the harness works everywhere else (smallest verifiable unit); now explicitly the rule for UI too.
- **"Let AI interview you" for design direction** — same technique already adopted for skill authoring (review 2026-07-12 #3, kernel 2); works for brand/meaning questions too.

**Rejected:** buying third-party "design skills" (unreviewed prompt packs are supply-chain risk for the context layer — same class of concern as unreviewed plugins), and tool-shopping (Quiver, Flow, Lummi) with no current need.

### 3. "Claude reads it, links it, files it — second brain for $0" (X post)

**What it is:** the same AI-maintained-Obsidian-vault concept as review 2026-07-12 #2, now with concrete artifacts — all verified real: [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) (MIT), built on Karpathy's LLM-wiki pattern (his gist exists), plus kepano's official obsidian-skills.

**Verdict: install-condition unchanged — a hand-kept Obsidian habit must survive a month first** (`HARNESS-TIERS.md` §2.7). What this post changes: *if* the condition is ever met, start from the claude-obsidian repo instead of hand-building — it already implements the rules worth keeping (inbox, immutable raw/, lint/synthesis, hot cache). §2.7 updated with the pointer.

**Rejected outright: pointing the three code repos' CLAUDE.md at a shared vault** (the post's "real unlock"). That forks project truth away from AGENTS.md — the exact failure mode review 2026-07-12 #1 closed. Code knowledge lives in the repo; the vault, if it ever exists, is for the human's non-code thinking.
**Security notes for later:** the marketplace-plugin install path and the Obsidian Local REST API plugin both widen attack surface — if activated, read the skills/plugin code first, prefer the filesystem MCP over the REST plugin, and treat ingested web content as data, never instructions (standing rule).

### 4–6. The three transcripts (harness & loops · Chip Huyen's *AI Engineering* · AI-engineer roadmap)

**Verdict: education, not installation.** Sean's harness/loop video is an accurate intro whose every mechanism the harness already implements with harder edges (its "end-loop guardrails" = the five-line loop spec; its memory taxonomy maps 1:1 to existing pieces — see the glossary in the new guide). The Chip Huyen summary is a faithful sketch of a genuinely good book (O'Reilly, 2025) — the eval/tracing/guardrail material is exactly what Alfred's Assistant module will need, so it anchors the roadmap. The Codesmith roadmap is a Python-first bootcamp plan; its *project-based, deploy-something-real* philosophy is right, its stack is wrong for a .NET/TS developer — rebuilt on Manuel's stack and real projects in the guide.

**One cheap piece adopted from Sean's video — the permission-wait notification.** Claude Code blocked on a permission prompt while you're elsewhere is pure dead time. Claude Code has a native `Notification` hook event for exactly this. Recipe (macOS, zero tokens, `~/.claude/settings.json`):
```jsonc
"hooks": {
  "Notification": [{ "hooks": [{ "type": "command",
    "command": "osascript -e 'display notification \"Claude needs input\" with title \"Claude Code\" sound name \"Glass\"'" }] }]
}
```
Documented here rather than installed — Manuel flips it (or asks for it) if the dead-time problem is real for him.

**New file this review produced:** `GUIDE-ai-engineering-learning.md` — the terminology the transcripts teach, mapped to where each concept already lives in this harness, plus a staged learning roadmap that rides on Alfred instead of toy projects.

### Addendum 2026-07-15 — "Claude Projects full course" (X post, @cyrilXBT)

**Duplicate of review 2026-07-12 #1.** Same content point-for-point (standing-brief template, precision-beats-volume, retrieval test, layers, Cowork — down to the identical "read every file in this folder" command); everything substantive already lives in `GUIDE-claude-projects.md`. Only novelties are plan trivia (free caps, 20 files/30 MB) that change no decision. Its "Code Project" template remains the rejected fork-the-truth anti-pattern for the code repos. These setup posts recirculate in near-identical variants — future copies need no new review unless they contain a feature the guide lacks.

## Review 2026-07-15 (second pass) — external read-only harness review, verified and applied

A full external review of the harness (produced by Codex) was verified claim-by-claim before acting. **Scorecard: 13/15 findings confirmed exactly** (line refs, registry versions, and permission modes all checked out — including npm-exact MCP versions and NuGet-exact ReportGenerator 5.5.10), one confirmed-with-correction, one pushed back.

**Corrections to the review itself:**
- Its symlink advice was unsafe as written: a symlinked `.agents/skills` dir hits a known Codex discovery bug (openai/codex#11314) — the exact shape it praised in solo-master. Implemented as real dirs with per-skill links instead; live discovery still needs testing in a Codex session (CLI not on PATH here).
- Its `matcher = "^Bash$"` suggestion for the publish guard was rejected: the guard self-filters (exits 0 without a command field), and a wrong tool-name in a matcher would silently disable it — fail-safe beats fail-silent.
- Retiring alfred's auto-memories: rejected. They mirror *template-repo* docs, which alfred sessions never load — the memories are the carrier, not duplication (unlike the car-dealer memories deleted earlier the same day, which mirrored the always-loaded global CLAUDE.md).
- Ratchet redesign: declined; documented as a stateful ratchet instead (loud, local-only, owner commits the baseline).

**Applied (full detail in `HARNESS-PARITY.md` 2026-07-15 note):** honest MANUAL mode (empty stable allows + `ask: ["Bash"]`), global Codex publish guard, `.agents/skills` bridges ×4, solo-master hook dedup (its hooks.json used `$CLAUDE_PROJECT_DIR` — a Claude-ism, dead under Codex), MCP + ReportGenerator pins, `--output-version 1`, state-dir permissions (700/600), backup→recovery upgrade (`restore-project.sh`, exclusions-before-files, gitleaks fatal, `.git-local-state/` captured), template's own gitleaks hook (tested against a staged fake PAT) + secret-scan CI, deploy skill `disable-model-invocation`, explicit md excludes, stale Codex docs superseded, tiers §2.8 pre-activation checklist, `gh auth login` documented in MACHINE-SETUP + `~/.config/gh/**` added to global denies.

**Best adopted idea: `audit-harness.sh`** — the executable meta-audit (the review's strongest point; every check maps to a real finding prose didn't prevent). First run immediately caught a false positive in itself (bypass lockout lives under `permissions.*`) — which is the tool working: claims get tested, including the auditor's.

**Standing lesson:** the parity matrix's "no Codex use in this repo → no guard needed" assumption expired silently the day Codex started reviewing all repos. Install-conditions need re-checking when *usage* changes, not only when files change — that's now the audit script's job.

### Addendum — second external pass on the applied fixes (same day)

The reviewer re-checked the applied work before commit and caught **one real blocker: the appended Codex hook snippet created a duplicate `[features]` table** (one already existed at line 72 for `js_repl`), which makes the *entire* config fail to load — guard wired but dead, and my audit's grep-for-the-string check couldn't see it. Root cause on my side: I read only the first 30 lines of `config.toml` before appending. Fixed by merging `hooks = true` into the existing table; the template snippet and MACHINE-SETUP step 2.5 now warn against blind-appending; `audit-harness.sh` now verifies the config actually *loads* (`codex --strict-config doctor` when the CLI is present, duplicate-table static scan otherwise). **Lesson, now mechanical: never grep for a config's presence — test that it parses/loads.**

Also applied from the second pass: `sandbox-mode.sh` (×4) now writes `"autoAllowBashIfSandboxed": false` so a future sandbox activation can't bypass MANUAL's ask-every-Bash contract (tiers recipe updated to match); backup's gitleaks prerequisite moved *before* any writes; restore validation extended to `.codex/.harness/.githooks/docs` and made worktree-safe (`git rev-parse --git-path`); snapshot drift check is now symmetric (rsync dry-run with the backup's own filter — catches new live files, not just changed ones); `~/.codex` state files recreated as 644 by Codex are a **documented accepted exception** (the 700 directory is the boundary; other accounts cannot traverse to them) instead of a repeating warning.

Confirmed by the reviewer's own testing: **Codex skill discovery works** — fresh isolated sessions saw every project skill and all five global role skills; the guard script blocked representative commit/push forms and passed read-only commands; the no-matcher decision held up.

**Third pass (same day):** the doctor check itself was judging the *overall* `codex doctor` exit code, which also fails on unrelated TERM/connectivity/auth checks — a false "config does not load" in non-interactive environments. Now it inspects only `checks.config.load.status` from `codex --strict-config doctor --json`, with a full-TOML-parse fallback (tomllib when available, duplicate-table scan on older Pythons) when the CLI or its JSON is absent. Hard-coded home paths removed from the audit (template stays portable), and the two doc statements the fixes had outrun (state-file 600 claim, "discovery pending") corrected. Honest count: **68 PASS + 4 info, 0 FAIL, 0 WARN** — the info lines are documented exceptions, not suppressed warnings. Note: the JSON path follows the reviewer's spec but only the static fallback could be exercised here (no codex CLI on PATH); their environment confirms the doctor behavior.
