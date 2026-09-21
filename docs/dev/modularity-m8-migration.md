# M8: full-profile migration and compatibility

M8 closes the modularization sequence with an explicit full managed machine
profile. It composes the existing receipt-backed Skills and Global configuration
lifecycles for Claude and Codex, enforces the exact 22-capability inventory, and
can migrate the checkout-bound layout created by the legacy machine setup.

## Commands

Always preview against an isolated target first. A fresh full-profile plan is:

```text
node scripts/setup.mjs plan --profile full --platform both --scope machine --target <absolute-home>
node scripts/setup.mjs apply --profile full --platform both --scope machine --target <absolute-home>
node scripts/setup.mjs apply --profile full --platform both --scope machine --target <absolute-home> --apply
node scripts/setup.mjs audit --profile full --platform both --scope machine --target <absolute-home>
node scripts/setup.mjs remove --profile full --platform both --scope machine --target <absolute-home>
node scripts/setup.mjs remove --profile full --platform both --scope machine --target <absolute-home> --apply
```

For a target previously configured by `machine-setup.mjs`, supply the exact old
checkout path explicitly:

```text
node scripts/setup.mjs plan --profile full --platform both --scope machine --target <absolute-home> --legacy-root <absolute-old-checkout>
node scripts/setup.mjs apply --profile full --platform both --scope machine --target <absolute-home> --legacy-root <absolute-old-checkout> --apply
node scripts/setup.mjs audit --profile full --platform both --scope machine --target <absolute-home>
```

`plan` and `apply` without `--apply` are read-only. Migration recognizes only
the exact canonical guidance, hook definitions and skill links rendered for the
supplied legacy root. Edited guidance, altered or duplicate hooks, unrelated
links, case variants, additional visible skills, custom Claude agents and unsafe
paths stop the whole preflight before writes. Review those items rather than
claiming them through a fabricated receipt.

## Result and compatibility boundary

Both platforms receive independent versioned skill and global-configuration
receipts under `<target>/.ai-harness/installations/`. Discovery links and guard
runtimes point into that stable target-owned store, so deleting or moving the old
checkout does not break the installation. The current checkout remains necessary
to plan future updates; installed audit/removal uses retained ownership evidence.
An additional sealed `full-managed` receipt binds the exact canonical selection,
the four component receipt revisions and machine-control ownership. Full-profile
audit therefore rejects a partial selective installation even when both platforms
and global configurations are otherwise healthy.

Unrelated settings, hooks, permission denials, hidden platform entries and
ordinary files in discovery directories are preserved. Values already present
in the legacy configuration are recorded conservatively as prior state rather
than retroactively claimed. The full profile does not install optional Tool
integrations, mutate projects, remove custom agents, transfer interactive Codex
hook trust, or remove unrelated target content.

The full profile preserves the complete-profile tool preflight: Node.js, Git,
GitHub CLI, Claude, Codex, Gitleaks and Zizmor are required; .NET and Docker are
reported as optional. Commands use literal argument arrays and never a command
shell. When `<absolute-home>` resolves to the current user's actual home, the
profile also owns `core.hooksPath=.githooks` in the source repository and, on
Windows, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in the current user's environment.
The receipt records prior non-secret state and removal restores it only while the
managed value is unchanged. Plans for isolated fixture homes report these controls
as inactive and never alter the developer's repository or environment.

The legacy `machine-setup.mjs`, `sync-skills.mjs` and `audit.mjs` commands remain
available for an unmigrated checkout-bound profile. `sync-skills.mjs` and therefore
`machine-setup.mjs` now refuse a receipt-backed skill target: mixing the two modes
would invalidate ownership and restore checkout-bound links. After migration use
only `setup.mjs --profile full` for the combined profile, or the matching module
lifecycle for a deliberate selective change. Full-profile removal previews and
then removes the four bound component ownership shares and aggregate receipt;
each component still applies its own restoration and conflict rules.

The four component publishers share a target lock but publish sequentially rather
than as one cross-module transaction. Each component rechecks preconditions and
rolls back its own failed publication. If a later component stops, the error lists
completed components; preserve any recovery state and rerun the read-only plan.
Repeated apply converges and is a no-op once all four components are current.

No physical source folders moved in M8. The catalog, generators and existing
source paths already have clear ownership, and moving them would add compatibility
risk without improving the installed runtime boundary. The migration itself is
the supported source-checkout move: it replaces every validated old checkout
reference with target-owned payloads or the current reviewed guidance pointer.

## Evidence and limits

The registered full-profile fixtures create the complete legacy layout for both
platforms in temporary targets, including a checkout path containing a space.
They prove read-only planning, exact adoption, preservation of unrelated settings
and hidden entries, deletion of the old checkout, sealed full-profile audit,
idempotent apply, combined removal, machine-control restoration, required-tool
denial, stale-state rejection and fail-closed handling of changed links, extra
skills, custom agents and altered ownership evidence. They also prove the legacy
synchronizer cannot overwrite a migrated profile.

The Windows portability job runs the full-profile fixture alongside the existing
process and lifecycle suites. Local M8 verification on 2026-09-22 ran on macOS:
`node scripts/verify.mjs` exited 0 with 195 tests, 193 passed and two Windows-only
shim tests skipped; whitespace, Gitleaks, Zizmor and syntax checks passed. A
successful GitHub Windows run and CodeQL result remain release evidence to check
before merging. No real user profile or live platform trust state was changed.

Security-checklist verdicts:

| Area | Verdict and evidence |
|---|---|
| Access and identity | Pass for local scope: the caller supplies an absolute target and explicit legacy root; remote identity and sessions are not applicable. |
| Inputs and outputs | Pass: platform/scope/profile are fixed, receipts retain strict schemas, environment prior state is limited to the non-secret `0`/`1` policy value, and errors report roles without configuration values or secrets. |
| Injection and navigation | Pass: external tools receive literal argument arrays with fixed command/configuration names; link targets must exactly match paths derived from the explicit legacy root, and linked roots/unsafe descendants remain denied. |
| Browser and network | Not applicable: migration performs no browser, server or network operation. |
| Files and abuse | Pass: preflight covers all four payload/configuration components plus machine controls, ambiguous ownership is preserved, publishers stage and roll back owned writes, and legacy mode is blocked after receipts exist. Upload and rate-limit controls are not applicable. |
| Dependencies and delivery | Pass: no dependency was added; the existing immutable CI action pins and least-privilege workflow remain intact. |
| Regression evidence | Pass locally: happy path, moved checkout, repeat apply, removal, tool denial, external-state restoration and denied ownership paths are registered in the repository and Windows CI suites. Remote Windows and CodeQL results remain explicit release checks. |
