predicate: dotnet test --configuration Release --filter "FullyQualifiedName~ArchitectureTests" --nologo --verbosity quiet
born: 2026-07-12
source: 2026-07-12 harness review — module-boundary rules (modules reference only SharedKernel) encoded as tests; ~4s predicate, the heaviest here
status: satisfied
last-pass: 2026-07-14
on-violation: a module dependency rule was violated; the failing test names the offending assembly/type — fix the dependency, never the rule
