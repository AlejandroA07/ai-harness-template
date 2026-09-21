# Token costs

This is the template's central cost ledger. Static sizes are measured from files; token counts are estimates at four UTF-8 bytes per token. Runtime measurements are loaded from `catalog/token-measurements.json` so regenerating this inventory cannot erase observed samples.

## What consumes context or tokens

| Source | When it costs | Control |
| --- | --- | --- |
| System and developer instructions | Every session | Product-owned; measure, do not duplicate locally |
| Global and project guidance | Every applicable session | Keep AGENTS/CLAUDE lean and remove repetition |
| Skill names and descriptions | Skill discovery | Audit unused skills; keep descriptions concise |
| Skill bodies | When invoked or selected | User-only for deliberate workflows; progressive disclosure |
| Skill references | When opened | Keep details in one referenced file; no duplicate README |
| Built-in tool schemas | Every request when loaded eagerly | Disable unused optional tools only after reviewing the capability trade-off |
| Deferred and MCP tool schemas | When the client loads them; they may show zero cost while deferred | Keep tools on demand and record deferred versus loaded cost separately |
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
| global/AGENTS.md | 2182 | 546 |
| global/CLAUDE.md | 2182 | 546 |

## Static capability inventory

Metadata is the approximate always-discovered cost. Body cost is paid only when invoked. Resource bytes do not enter context unless the agent reads them; executable scripts can often run without being loaded. The module column prevents workflows from being counted as a second copy of their required skill bodies.

| Capability | Module | Invocation | Metadata est. tokens | Body est. tokens | Resource files / bytes |
| --- | --- | --- | ---: | ---: | ---: |
| ask-alfred | workflows | user-only | 25 | 2549 | 1 / 4406 |
| code-review | skills | model-or-user | 109 | 1639 | 0 / 0 |
| codebase-design | skills | model-or-user | 71 | 1545 | 2 / 5250 |
| diagnosing-bugs | skills | model-or-user | 44 | 2267 | 2 / 1964 |
| domain-modeling | skills | model-or-user | 42 | 792 | 2 / 5065 |
| grill-me | workflows | user-only | 16 | 7 | 0 / 0 |
| grill-with-docs | workflows | user-only | 31 | 16 | 0 / 0 |
| grilling | skills | model-or-user | 41 | 421 | 0 / 0 |
| handoff | skills | user-only | 24 | 168 | 0 / 0 |
| implement | workflows | user-only | 55 | 436 | 0 / 0 |
| improve-codebase-architecture | workflows | user-only | 39 | 1449 | 1 / 6685 |
| prototype | skills | model-or-user | 48 | 685 | 2 / 13052 |
| research | skills | model-or-user | 62 | 131 | 0 / 0 |
| security-checklist | skills | model-or-user | 76 | 838 | 0 / 0 |
| tdd | skills | model-or-user | 39 | 847 | 2 / 3695 |
| teach | workflows | user-only | 17 | 2332 | 4 / 8387 |
| to-questionnaire | skills | user-only | 27 | 690 | 0 / 0 |
| to-spec | workflows | user-only | 41 | 733 | 0 / 0 |
| to-tickets | workflows | user-only | 66 | 1352 | 0 / 0 |
| wait-what | skills | user-only | 16 | 51 | 0 / 0 |
| wayfinder | workflows | user-only | 54 | 2896 | 0 / 0 |
| writing-for-agents | skills | model-or-user | 31 | 2704 | 1 / 2651 |

## Tool adapter inventory

Skill adapters have normal discovery/body costs. MCP configuration bytes are not MCP schema tokens; runtime schema cost stays unmeasured until the client actually loads it.

| Integration | Platform | Adapter | Source | Metadata est. tokens | Body est. tokens | Config bytes | Runtime schema |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| archify | both | skill | integrations/archify/SKILL.md | 35 | 281 | — | not-applicable |
| context7 | claude | mcp | components/mcp/claude-context7.json | — | — | 126 | measure-when-loaded |
| context7 | codex | mcp | components/mcp/codex-context7.toml | — | — | 84 | measure-when-loaded |
| graphify | both | skill | integrations/graphify/SKILL.md | 32 | 591 | — | not-applicable |
| playwright | claude | mcp | components/mcp/claude-playwright.json | — | — | 123 | measure-when-loaded |
| playwright | codex | mcp | components/mcp/codex-playwright.toml | — | — | 81 | measure-when-loaded |

## Runtime measurement protocol

Record runtime samples in `catalog/token-measurements.json`; this generated file is only a view.

1. Start a fresh representative project session and record date, CLI version, model, project, and enabled MCPs.
2. Claude: run `/context` before invoking a skill and again after the representative workflow. Record the component breakdown Claude displays.
3. Codex: run `/status` before and after the same workflow. Record the total/context delta; Codex does not currently expose Claude's component-level breakdown.
4. Compare repeated samples only when the model, project, and enabled tools are equivalent.

| Date | Agent/version | Model | Project | Scenario | MCPs | Measured result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-31 | Claude Code 2.1.220 | Opus 5 | Harness session | Before optional-tool trim | 2 deferred tools | System tools 11.2k; total 30.1k / 1m | User-provided /context sample |
| 2026-07-31 | Claude Code 2.1.220 | Opus 5 | Harness session | After optional-tool trim | 2 deferred tools | System tools 6.1k; total 25.1k / 1m | User-provided /context sample; saved 5.1k system-tool tokens (46%) |
| 2026-07-31 | Claude Code 2.1.220 | Opus 5 | Harness session | Before custom-agent removal | 2 deferred tools | Custom agents 12.6k (156); total 25.1k / 1m | User-provided /context sample |
| — | Claude Code 2.1.220 | Opus 5 | Harness session | After custom-agent removal | 2 deferred tools | Pending | Start a fresh session and run /context |

## Audit triggers

- Review a skill when it has not been used for several projects, its body grows materially, or another skill duplicates its job.
- Reconsider extensive user stories when measured planning cost is high relative to the clarity they add.
- Reconsider an MCP when it is enabled but rarely called.
- Prefer scripts for deterministic repeated operations; prefer references for detail needed only sometimes.
- Archive retired material outside discovery paths. Archived files have zero normal context cost.
