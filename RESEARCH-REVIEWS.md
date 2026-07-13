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
