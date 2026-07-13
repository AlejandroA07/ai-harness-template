# Guide — what knowledge goes where (and what stays out)

Answers a recurring question (last asked 2026-07-12): *"should the harness teach patterns and dos-and-don'ts — obvious things for programmers, designers, even the specific language?"*

Short answer: **don't restate what the model knows; do encode where the model's *defaults* differ from your standards; prefer machine enforcement over prose; grow everything else from real incidents.** The long answer is the ladder below. Anthropic's own skill guidance agrees: start minimal, add instructions incrementally *from observed failure modes*, not preemptively.

## The five layers — put each piece of knowledge at the lowest layer that holds it

### L0 — the model's weights (free, always loaded)
Language syntax and idioms, SOLID, common patterns, REST conventions, SQL, testing basics, security fundamentals — the "obvious things for programmers." **Never encode these.**
**Test:** open a fresh session and ask cold ("what are the dos and don'ts of async C#?"). If the model states your rule unprompted, writing it down is pure bloat — it costs context and buys nothing.

### L1 — machine enforcement (zero context cost, can't be ignored)
Things the model *knows* but doesn't reliably *do* under pressure: formatting, nullability discipline, dead code, security patterns, dependency rules, secrets hygiene.
**This layer IS the "C# patterns skill" — it's called an analyzer.** SonarAnalyzer + `AnalysisLevel latest-recommended` + `TreatWarningsAsErrors` encode hundreds of language dos-and-don'ts, enforce them at compile time, cost zero tokens, and work on human code too. Proof from this week: Sonar caught 5 real issues in freshly scaffolded template code (including a disabled-CSRF attribute); xunit.v3's analyzers forced correct cancellation-token usage the moment we migrated.
Same principle: `.editorconfig` for style, architecture tests for boundaries, deny rules + hooks for behavior, gitleaks for secrets, verify.sh for "done".
**Rule: if a candidate "pattern" can be checked by a tool, install the tool and write nothing** — "write nothing" means the tool *replaces* the prose rule, not that tools are free.

> **This does not conflict with the lean-dependency law.** That law is about *production* dependencies — code that ships inside the app, is attacker-reachable, and carries supply-chain risk; those always need proposal + approval + lock files. L1 tooling is *build-time only*: analyzers run in the compiler and are absent from the published app, scanners (gitleaks, zizmor) live on the machine/CI, tests are never deployed. The owner's global rule already blesses this category ("standard security/quality tooling is fine to commit"). Dev tools still aren't free — each adds build time, false-positive noise, and a version to maintain — so a new one must also earn its place by catching something real (Sonar did on day one; a second overlapping linter would not). One tool per job, no overlaps.

### L2 — AGENTS.md (loaded every session — the most expensive real estate)
Only two kinds of content earn a place:
1. **Facts the model cannot know:** this repo's commands, architecture, paths, secret mechanism.
2. **Deviations from mainstream defaults** — places where the model's statistically-likely guess is wrong *for this project*: "minimal APIs, no controllers", "no styling framework", "modules never reference each other", the product vocabulary. This is where "how NOT to do things here" lives, one line each.
**Budget: ~1 page (~900 words — all three projects are currently at 730–930).** When it grows past that, move procedure out to skills and delete anything L0 already covers. Feed it via the standing rule: *the agent gets something wrong twice → one sentence here* (the retro skill is the pipeline).

### L3 — skills (cost one description line until invoked — then their full text)
Two legitimate species, nothing else:
1. **Procedures** — multi-step workflows with project-specific facts where a wrong step is expensive (migrate, db, deploy, security-checklist). The *how*; AGENTS.md holds the *when*.
2. **Default-shifters** — quality bars for domains where the model is *capable but defaults badly*. The proof case is `web-designer`: the model can produce good design but defaults to "AI slop" (centered card, gradient, shadow soup); the skill shifts the default and gives a reject-your-own-work bar. The role skills (backend-engineer, fullstack-engineer, devops, architecture-designer) are this species — order-of-work + quality bar + traps, deliberately *not* language tutorials.
**Test for a new skill:** does it change what the model would otherwise produce? If a fresh session already behaves that way, the skill is a restatement. Keep each under ~1 page; description says what + when, in third person.

### L4 — live documentation (for what the model can't know yet)
Post-cutoff knowledge — new framework versions, changed APIs, current package versions — does **not** get written into skills preemptively (it rots, and confidently-wrong beats missing). The harness answer is already installed: the **context7 MCP** fetches current docs on demand, and package versions get checked against the registry at scaffold time (BOOTSTRAP lesson #3).
**Freeze into a file only after the same post-cutoff mistake happens twice** — then it's an incident-born "gotchas" note in AGENTS.md, dated, with the wrong and right form. Never a speculative ".NET 10 skill".

## The admission test (run on every candidate addition)

1. **Would a fresh session already do this correctly?** → yes: reject (L0).
2. **Can a tool check it?** → yes: analyzer/test/hook/deny rule, write no prose (L1).
3. **Is it a fact or deviation specific to this project?** → AGENTS.md, one line (L2).
4. **Is it a repeated procedure, or a domain where the model's default output is reliably below your bar?** → skill (L3).
5. **Is it knowledge newer than the model?** → context7 on demand; encode only after the second incident (L4).
6. Still unsure → don't add it. The retro will resurface it if it actually matters.

## Part-by-part review of the current harness (2026-07-12)

| Component | Layer | Size now | Verdict |
|---|---|---|---|
| AGENTS.md ×3 | L2 | 730–930 words each | ✅ healthy; at budget. Watch alfred — it grows with each module; when >1 page, push module detail into per-module docs/skills |
| CLAUDE.md ×3 | L2 | 3–7 lines | ✅ correct (thin import, no duplication) |
| Analyzers (built-in + Sonar), TWE/ratchet | L1 | 0 tokens | ✅ the real "language patterns" layer; keep versions current |
| Architecture tests | L1 | 0 tokens | ✅ boundaries machine-enforced (16 tests alfred / 5 car-dealer) |
| deny rules + publish guard + gitleaks + format hook | L1 | 0 tokens | ✅ behavior enforced, not requested |
| verify.sh + goals | L1 | 0 tokens | ✅ "done" and invariants machine-checked |
| Project skills (migrate, db, deploy, security-checklist, retro, new-feature) | L3-procedure | 290–350 words each | ✅ all born from real workflows; commands verified live (db skill's wrong schema assumption caught by testing — keep that discipline) |
| Role skills ×5 (global) | L3-default-shifter | 450–770 words each | ✅ within budget; they pass the "changes the default output" test. Don't grow them past ~1 page; prune any line that's pure L0 |
| context7 + Playwright MCP | L4 / verification | tool defs only | ✅ context7 is the anti-"outdated idiom" answer; Playwright is the "prove it in the real app" answer |
| Template docs (799 lines total) | owner docs | not loaded by agents | ✅ zero context cost — documentation lives here precisely so the agent-loaded files stay small |

**Net verdict: no bloat today, and nothing important missing at L1/L2.** The gap Manuel worried about ("missing obvious things") is covered by L0+L1: the model supplies the knowledge, the analyzers and tests catch the lapses. What the harness deliberately does *not* have — language-tutorial skills — stays out by the admission test above.

## If you still want a "patterns" file someday

Make it an **incident ledger, not an encyclopedia**: a dated list of things an agent in *this* codebase actually got wrong twice, each entry three lines (what it did / what's right here / why). It starts empty. The retro skill mines the week's failures into it. The moment an entry can become an analyzer rule, editorconfig line, or test — promote it to L1 and delete the prose. An empty ledger is the harness working, not a gap.
