predicate: dotnet test WestcoastCars.ArchitectureTests --configuration Release --nologo --verbosity quiet
born: 2026-07-09
source: 2026-07-09 — clean-architecture dependency rules encoded as tests (the heaviest predicate here, ~30s; still worth it)
status: satisfied
last-pass: 2026-07-14
on-violation: a layer dependency was violated; the failing test names the offending types — fix the dependency, never the rule
