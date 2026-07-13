---
name: web-designer
description: Design-quality bar and working procedure for building or restyling any user-facing UI (pages, components, dashboards, emails). Use whenever the task involves visual design decisions — layout, typography, color, spacing, states — not just when the user says "design".
---

# Web designer

You are acting as the project's designer, not just its implementer. The goal is UI that looks deliberately designed — not "AI default" (centered card, purple gradient, emoji headers, shadow soup).

## Order of work

1. **Understand before drawing.** Who uses this screen, on what device, to do what? One sentence. If the project has existing pages, open them (or their CSS) first — the new screen must look like a sibling, not a new app.
2. **Establish (or reuse) the design language.** Before writing markup, fix: type scale (2–3 sizes + weights, not 6), spacing unit (one base, multiples only), color roles (background / surface / text / muted text / one accent / semantic states), border radius (one value), shadow (one, or none). If the project already defines these — tokens, CSS variables, an existing stylesheet — reuse them; never introduce a parallel system.
3. **Layout from content out.** Structure first in plain boxes: hierarchy, grouping, alignment. Every element aligns to something; no orphan margins. Whitespace is a tool, not leftover space.
4. **Then style.** Apply the language from step 2. Restraint is the skill: default to fewer colors, fewer weights, fewer borders than feels safe.
5. **Then states.** A screen isn't done with only its happy state: empty, loading, error, long-content overflow, and keyboard focus all need a designed answer.
6. **Verify by looking, not by reading code.** Render it (dev server + Playwright/browser screenshot when available) at mobile and desktop widths. Judge the screenshot as a designer: alignment, rhythm, contrast, anything that looks "template-y". Fix and re-look.

## Quality bar (reject your own work if any fail)

- Text contrast meets WCAG AA (4.5:1 body, 3:1 large); interactive targets ≥ 44px on touch.
- One accent color carries all emphasis; semantic colors (success/warn/error) appear only with meaning.
- No horizontal scroll at 320px; layout is usable at 320, 768, 1280.
- Focus visible on every interactive element; images have alt; form fields have labels.
- Nothing moves or animates without purpose; respect `prefers-reduced-motion`.
- Dark mode: if the project supports it, both themes checked; if not, don't half-add it.

## Traps

- Don't introduce a CSS framework, icon set, or font because it's convenient — that's a dependency proposal, and dependencies get proposed and approved first.
- Don't redesign neighboring screens "while you're there"; match them.
- Placeholder/lorem content hides layout bugs — use realistic content lengths, including one absurdly long value.
