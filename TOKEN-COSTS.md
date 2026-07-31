# Token costs

This is the template's central cost ledger. Static sizes are measured from files; token counts are estimates at four UTF-8 bytes per token. Runtime measurements remain separate because model, CLI version, enabled tools, project, and conversation state change the result.

## What consumes context or tokens

| Source | When it costs | Control |
| --- | --- | --- |
| System and developer instructions | Every session | Product-owned; measure, do not duplicate locally |
| Global and project guidance | Every applicable session | Keep AGENTS/CLAUDE lean and remove repetition |
| Skill names and descriptions | Skill discovery | Audit unused skills; keep descriptions concise |
| Skill bodies | When invoked or selected | User-only for deliberate workflows; progressive disclosure |
| Skill references | When opened | Keep details in one referenced file; no duplicate README |
| MCP tool schemas | While the MCP is enabled | Enable Context7, Playwright, and other MCPs only per project |
| Conversation messages and tool output | During the session | Start implementation tickets fresh; avoid dumping broad output |
| Specs, issues, ADRs, and code | When read | Load the relevant artifact, not the entire history |
| Subagents and parallel research | Per agent/session | Use only for independent work whose time or isolation benefit pays for it |
| Images and attachments | When included | Include only the fidelity needed for the decision |
| Compaction and handoffs | When crossing context boundaries | Reference existing artifacts instead of duplicating them |

## Claude built-in tool policy

Claude Code loads built-in tool schemas into every request. The harness removes the following optional tools with bare permission denials, while retaining both Bash and PowerShell:

- `Artifact`
- `CronCreate`
- `CronDelete`
- `CronList`
- `EnterWorktree`
- `ExitWorktree`
- `Monitor`
- `NotebookEdit`
- `PushNotification`
- `RemoteTrigger`
- `ScheduleWakeup`
- `SendUserFile`
- `ShareOnboardingGuide`
- `TaskOutput`
- `Workflow`

This is a capability trade-off, not just a permission-prompt change. Re-run the runtime protocol after changing the list.

## Static global guidance

| File | Measured bytes | Estimated tokens |
| --- | ---: | ---: |
| global/AGENTS.md | 1589 | 398 |
| global/CLAUDE.md | 1589 | 398 |

## Static skill inventory

Metadata is the approximate always-discovered cost. Body cost is paid only when invoked. Resource bytes do not enter context unless the agent reads them; executable scripts can often run without being loaded.

| Skill | Invocation | Metadata est. tokens | Body est. tokens | Resource files / bytes |
| --- | --- | ---: | ---: | ---: |
| ask-alfred | user-only | 39 | 322 | 0 / 0 |
| code-review | model-invoked | 108 | 1647 | 0 / 0 |
| codebase-design | model-invoked | 71 | 1535 | 1 / 2559 |
| diagnosing-bugs | model-invoked | 44 | 2096 | 1 / 645 |
| domain-modeling | model-invoked | 59 | 792 | 2 / 5065 |
| grill-me | user-only | 16 | 7 | 0 / 0 |
| grill-with-docs | user-only | 42 | 154 | 0 / 0 |
| grilling | model-invoked | 41 | 164 | 0 / 0 |
| handoff | user-only | 24 | 168 | 0 / 0 |
| implement | user-only | 55 | 434 | 0 / 0 |
| improve-codebase-architecture | user-only | 39 | 1456 | 1 / 6685 |
| prototype | model-invoked | 48 | 646 | 2 / 12596 |
| research | model-invoked | 62 | 131 | 0 / 0 |
| security-checklist | model-invoked | 76 | 838 | 0 / 0 |
| tdd | model-invoked | 39 | 758 | 2 / 3695 |
| teach | user-only | 17 | 2332 | 4 / 8387 |
| to-spec | user-only | 41 | 704 | 0 / 0 |
| to-tickets | user-only | 66 | 1313 | 0 / 0 |
| wayfinder | user-only | 54 | 2943 | 0 / 0 |

## Runtime measurement protocol

Record runtime samples in the table below. Never parse private transcripts or agent caches.

1. Start a fresh representative project session and record date, CLI version, model, project, and enabled MCPs.
2. Claude: run `/context` before invoking a skill and again after the representative workflow. Record the component breakdown Claude displays.
3. Codex: run `/status` before and after the same workflow. Record the total/context delta; Codex does not currently expose Claude's component-level breakdown.
4. Compare repeated samples only when the model, project, and enabled tools are equivalent.

| Date | Agent/version | Model | Project | Scenario | MCPs | Measured result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-31 | Claude Code 2.1.220 | Opus 5 | Harness session | Before optional-tool trim | 2 deferred tools | System tools 11.2k; total 30.1k / 1m | User-provided `/context` sample |
| 2026-07-31 | Claude Code 2.1.220 | Opus 5 | Harness session | After optional-tool trim | 2 deferred tools | System tools 6.1k; total 25.1k / 1m | User-provided `/context` sample; saved 5.1k system-tool tokens (46%) |
| 2026-07-31 | Claude Code 2.1.220 | Opus 5 | Harness session | Before custom-agent removal | 2 deferred tools | Custom agents 12.6k (156); total 25.1k / 1m | User-provided `/context` sample |
| — | Claude Code 2.1.220 | Opus 5 | Harness session | After custom-agent removal | 2 deferred tools | Pending | Start a fresh session and run `/context` |

## Audit triggers

- Review a skill when it has not been used for several projects, its body grows materially, or another skill duplicates its job.
- Reconsider extensive user stories when measured planning cost is high relative to the clarity they add.
- Reconsider an MCP when it is enabled but rarely called.
- Prefer scripts for deterministic repeated operations; prefer references for detail needed only sometimes.
- Archive retired material outside discovery paths. Archived files have zero normal context cost.
