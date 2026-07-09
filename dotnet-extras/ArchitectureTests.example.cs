// Example architecture-rule tests (NetArchTest.Rules + xUnit + FluentAssertions).
// ADAPT: derive the rules from the project's ACTUAL csproj references first
//   (grep ProjectReference */[Pp]roject.csproj) — a rule that contradicts the real
//   graph fails immediately and teaches nothing. Typical clean-architecture rules:
//   Domain → nothing; Application → Domain only; Infrastructure implements Application;
//   presentation layers never referenced by anyone.
// Project setup: a test project referencing every production project, with
//   <PackageReference> to NetArchTest.Rules. Tag with Category=Architecture so
//   it can be skipped via: dotnet test --filter "Category!=Architecture"

using System.Reflection;
using FluentAssertions;
using NetArchTest.Rules;
using Xunit;

namespace MyApp.ArchitectureTests;

[Trait("Category", "Architecture")]
public class LayerDependencyTests
{
    private const string Domain = "MyApp.Domain";                 // EDIT
    private const string Application = "MyApp.Application";       // EDIT
    private const string Infrastructure = "MyApp.Infrastructure"; // EDIT
    private const string Api = "MyApp.Api";                       // EDIT
    private const string EntityFrameworkCore = "Microsoft.EntityFrameworkCore";

    private static void AssertNoDependency(string assembly, params string[] forbidden)
    {
        var result = Types.InAssembly(Assembly.Load(assembly))
            .ShouldNot()
            .HaveDependencyOnAny(forbidden)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"{assembly} must not depend on [{string.Join(", ", forbidden)}], " +
            $"but these types do: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }

    [Fact]
    public void DomainDependsOnNothing()
        => AssertNoDependency(Domain, Application, Infrastructure, Api, EntityFrameworkCore);

    [Fact]
    public void ApplicationNeverReachesOutward()
        => AssertNoDependency(Application, Infrastructure, Api, EntityFrameworkCore);

    [Fact]
    public void InfrastructureNeverDependsOnPresentation()
        => AssertNoDependency(Infrastructure, Api);
}
