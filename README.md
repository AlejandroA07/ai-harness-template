# AI Harness Template

Portable starter kit for the AI coding harness: context files (AGENTS.md), guardrails (permissions, hooks, secret scanning), and verification (CI security, analyzers, architecture tests). Tool-agnostic where possible — works with Claude Code today, adaptable to Codex or others (see the mapping table in `reference-implementation.md`).

| Read this | When |
|---|---|
| `MACHINE-SETUP.md` | New machine — tools, global Claude config, carrying this template around |
| `BOOTSTRAP.md` | New (or existing) project — step-by-step, executable by a human or an AI agent; includes the "Lessons" list of real bootstrap mistakes |
| `reference-implementation.md` | The full write-up of the original implementation: component inventory, on/off toggle table, Claude↔Codex mapping, roadmap |
| `HARNESS-TIERS.md` | What runs now on a Pro plan vs. what's documented-and-dormant for Max/API budget (loops, schedules, fleets, maker/checker) — with activation conditions and setup guides |
| `RESEARCH-REVIEWS.md` | Running log of outside ideas evaluated: what was adopted, what was recorded with install-conditions, what was rejected and why |
| `HARNESS-PARITY.md` | Component matrix across the three live projects — what's leveled everywhere, what's a justified difference, what's proposed |
| `GUIDE-claude-projects.md` | Setting up claude.ai Projects properly — for non-coding work only (never for the code repos) |
| `GUIDE-what-goes-where.md` | The knowledge-encoding ladder: what belongs in the model / analyzers / AGENTS.md / skills / live docs — and the admission test that keeps the harness lean |
| `GUIDE-ai-engineering-learning.md` | AI-engineering concepts & terminology mapped to where each already lives in this harness, plus a staged learning roadmap (model calls → RAG → tools → evals) that rides on Alfred |

Contents:

```
project/            # copy into a repo root, then follow BOOTSTRAP.md
  .claude/          #   agent permissions, format-on-stop hook, security-checklist skill,
                    #   harness-mode.sh (AUTO/MANUAL autonomy switch),
                    #   dormant switches, default OFF (tiers doc): git-autonomy.sh + git
                    #   skill (levels commit→push→pr), sandbox-mode.sh (OS sandbox)
  .harness/         #   tool-neutral hooks: guard-git-publish.sh (blocks agent commit/push,
                    #   wire into Codex PreToolUse — see BOOTSTRAP step 7b)
  .githooks/        #   gitleaks pre-commit (modern `gitleaks git` syntax)
  .mcp.json         #   Playwright + Context7 MCP servers
  .github/          #   CodeQL, Dependabot, secret-scan job (committed — no AI signature)
  AGENTS.md.template
  CLAUDE.md
dotnet-extras/      # analyzers snippet + architecture-tests example (.NET projects)
global/             # ~/.claude machine-wide settings + personal CLAUDE.md template
  skills/           #   role skills for ~/.claude/skills: web-designer, backend-engineer,
                    #   fullstack-engineer, devops, architecture-designer
                    #   (quality bars + procedures, not language tutorials)
```

Golden rule of the whole harness: **you don't review every line an AI writes, so the harness has to** — context teaches the agent, guardrails are enforced by tooling not trust, and verification (tests, scanners, CI) is the judge.
