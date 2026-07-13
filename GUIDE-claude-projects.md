# Guide — Claude Projects (claude.ai) done properly

Scope: the **claude.ai chat app** (and Cowork), for non-coding work — studying, research, writing, life admin. For the three code repos, this guide does **not** apply: `AGENTS.md` + skills are the source of truth there, and maintaining a parallel knowledge base in claude.ai would fork it. (Judgment call in `RESEARCH-REVIEWS.md` §1.)

## What a Project actually is

Three things in one persistent workspace:
1. **Custom instructions** — a standing brief applied to every conversation in the project.
2. **Knowledge files** — documents available to every conversation, retrieved per query (not all loaded at once).
3. **Scoped conversations** — chats grouped under the project.

The trap everyone hits: **conversations do not share history with each other.** Only the instructions and files carry forward. Design both for a reader with zero history.

## The five rules that make one work

**1. One project per concern.** "C# studies", "Alfred product research", "Job applications" — never "Work". Mixing concerns dilutes retrieval, which is the entire mechanism.

**2. Instructions = a standing brief, not a role line.** Structure that works:

```
ROLE — who Claude is, writing for whom (assume zero prior context)
WHAT THIS PROJECT IS FOR — the 2–3 tasks every request relates to
HOW TO RESPOND — tone, format, length; "don't ask clarifying questions
  unless blocked: make a reasonable assumption, state it, proceed"
WHAT TO ASSUME — domain facts to treat as given
NEVER — the hard bans
```

Behavior rules go in instructions; reference material goes in knowledge files. Mixing the two layers is the quiet way projects underperform.

**3. Knowledge = few, tight, named files.** 1–3 pages each; a 3-page voice/spec doc beats a 40-page manual because signal density drives retrieval. Descriptive filenames ("Alfred money-map vocabulary v2"), not "notes". 3–5 real examples of good output teach more than any instruction.

**4. Test retrieval before trusting it.** New file → new chat → "Based on <file> in the project knowledge, what does it say about X? Quote it." Generic answer = the file isn't reaching the model (too vague a name, buried, or failed to process). Five minutes, once, per critical file.

**5. Maintain or delete.** Outdated knowledge is worse than none — it's confidently wrong context, followed faithfully. When something changes, update the file; review instructions quarterly.

## Extras worth knowing

- **Model per conversation:** a project doesn't lock the model. Routine drafting → fast model; deep synthesis → strong model. Same instructions either way. (Same asset-vs-throughput logic as `HARNESS-TIERS.md`.)
- **Three personalization layers stack:** account-wide profile instructions (universal preferences — set once, stop repeating them per project) → project instructions (what makes *this* project different) → styles (one-off per chat). Use each for only its job.
- **Thinking conversations count.** Working through decisions inside the scoped project (not just issuing tasks) is what makes later outputs match your judgment, not only your format.
- **Cowork projects** add persistent scoped memory, a real local folder, and scheduled tasks. Same setup logic; higher ceiling. Good first command in one: *"Read every file in this folder, summarize what this workspace is, what I use it for, and what instructions you'll follow; ask before assuming."* Treat its scheduled tasks with the same discipline as `HARNESS-TIERS.md` §2.4 — prove the manual version first.

## Starter templates that map to Manuel's actual life

- **Study project (per subject — e.g. "C# mastery"):** instructions define the learning method (explain-first, delayed recall checks — same philosophy as solo-master); knowledge holds the syllabus, your error log, and 2–3 model answers you rated good.
- **Alfred product-research project:** instructions define the product vocabulary (money map, ShareGrant, draft→confirm) and "structure findings as: claim, evidence, implication for Alfred"; knowledge holds competitor notes (e.g. the Mira feature list), positioning drafts, decided constraints. Keep it strictly product-side — implementation truth stays in the repo.
- **Writing/portfolio project:** instructions carry voice and bans; knowledge carries your 3 best pieces and an audience note.
