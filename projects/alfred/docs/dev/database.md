# Database & migrations — implementation notes

> Living doc — current truth about migrations here. The `--context` command and "never edit an applied migration" rule live in `AGENTS.md`; this is the detail behind them.

## Generated migrations are exempt from two analyzers

`.editorconfig`, section `[**/Migrations/*.cs]`: CA1861 and IDE0300 are both disabled there. Both fire on the `new[] { … }` EF emits for multi-column indexes, and without the exemption `dotnet format` and EF would rewrite each other's output forever — format normalises the array, the next `migrations add` regenerates it, format changes it back.

**Don't hand-fix generated migration style.** Regenerating undoes it, so any manual cleanup is wasted work that also creates spurious diffs.
