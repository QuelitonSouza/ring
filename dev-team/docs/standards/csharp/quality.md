# C# Standards - Quality

> **Module:** quality.md | **Parent:** [index.md](index.md)

This module covers the static-analysis and build-quality gates every C# project MUST enforce: Roslyn
analyzers, `.editorconfig` + StyleCop, warnings-as-errors, nullable reference types, forbidden runtime
patterns, startup configuration validation, code coverage, and container security.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards. Ring
> standards are the baseline; `PROJECT_RULES.md` may add rules but must not weaken these.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Build Quality Gates](#build-quality-gates-mandatory) | `Directory.Build.props`, warnings-as-errors, nullable |
| 2 | [Roslyn Analyzers](#roslyn-analyzers-mandatory) | Analyzer packages, severity |
| 3 | [.editorconfig & StyleCop](#editorconfig--stylecop-mandatory) | Style enforcement in-build |
| 4 | [Forbidden Runtime Patterns](#forbidden-runtime-patterns-critical) | Console logging, async void, sync-over-async |
| 5 | [Startup Configuration Validation](#startup-configuration-validation-mandatory) | Fail-fast on bad config |
| 6 | [Code Coverage](#code-coverage-mandatory) | Threshold and collection |
| 7 | [Container Security](#container-security-conditional) | Non-root, pinned images |

---

## Build Quality Gates (MANDATORY)

**HARD GATE:** Quality settings live in a solution-root `Directory.Build.props` so they apply to every
project uniformly. Nullable reference types are enabled and warnings are treated as errors.

```xml
<!-- Directory.Build.props (solution root) -->
<Project>
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <LangVersion>12.0</LangVersion>

    <!-- Null-safety: MANDATORY -->
    <Nullable>enable</Nullable>

    <!-- Build fails on any warning: MANDATORY -->
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>

    <!-- Analyzers + style enforced during build: MANDATORY -->
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>

    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
  </PropertyGroup>
</Project>
```

### Why Each Setting

| Setting | Effect | Rationale |
|---------|--------|-----------|
| `Nullable=enable` | Compiler tracks null-flow | Eliminates most `NullReferenceException` at compile time |
| `TreatWarningsAsErrors=true` | Any warning breaks the build | Warnings are latent bugs; do not accumulate them |
| `AnalysisLevel=latest-recommended` | Enables the current recommended Roslyn ruleset | Keeps rules current per SDK |
| `EnforceCodeStyleInBuild=true` | `.editorconfig` style rules run at build | Style is enforced, not just suggested in the IDE |

### Nullable Discipline

`#nullable disable` is FORBIDDEN. Model absence explicitly.

```csharp
// FORBIDDEN: disabling nullability to silence warnings
#nullable disable

// FORBIDDEN: null-forgiving operator to paper over a real warning
var user = repository.Find(id)!; // Handle the null instead

// CORRECT: express nullability and handle it
User? user = await repository.FindAsync(id, ct);
if (user is null) return AppError.NotFound("User", id);
```

---

## Roslyn Analyzers (MANDATORY)

The .NET SDK ships the `Microsoft.CodeAnalysis.NetAnalyzers` (CA rules) — enabled by `AnalysisLevel`.
Add the following analyzer packages (as `PrivateAssets="all"` dev-only references):

| Package | Purpose |
|---------|---------|
| `Microsoft.CodeAnalysis.NetAnalyzers` | Built-in CA rules (bundled with the SDK) |
| `SonarAnalyzer.CSharp` | Bug + security + code-smell rules |
| `StyleCop.Analyzers` | Style consistency (naming, ordering, docs) |
| `Meziantou.Analyzer` | Additional correctness/async best-practice rules |

```xml
<ItemGroup>
  <PackageReference Include="SonarAnalyzer.CSharp" Version="9.*" PrivateAssets="all" />
  <PackageReference Include="StyleCop.Analyzers" Version="1.2.*" PrivateAssets="all" />
  <PackageReference Include="Meziantou.Analyzer" Version="2.*" PrivateAssets="all" />
</ItemGroup>
```

### Elevating Key Rules to Errors

Beyond warnings-as-errors, promote correctness-critical async/security rules explicitly in
`.editorconfig`:

```ini
# Async correctness
dotnet_diagnostic.CA2007.severity = warning   # ConfigureAwait on library awaits
dotnet_diagnostic.CA2016.severity = error     # Forward CancellationToken to methods that take one
dotnet_diagnostic.CA2012.severity = error     # Use ValueTasks correctly

# Reliability / security
dotnet_diagnostic.CA1062.severity = warning   # Validate public method arguments
dotnet_diagnostic.CA2100.severity = error     # Review SQL for injection
dotnet_diagnostic.CA5350.severity = error     # Do not use weak crypto
```

---

## .editorconfig & StyleCop (MANDATORY)

A solution-root `.editorconfig` (with `root = true`) defines formatting and style. With
`EnforceCodeStyleInBuild=true`, violations become build errors.

```ini
# .editorconfig
root = true

[*.cs]
indent_style = space
indent_size = 4
charset = utf-8-bom
end_of_line = crlf
insert_final_newline = true

# File-scoped namespaces (C# 10+)
csharp_style_namespace_declarations = file_scoped:error

# Prefer explicit types, expression bodies where clear, switch expressions
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_prefer_switch_expression = true:suggestion
dotnet_style_prefer_conditional_expression_over_return = true:suggestion

# Interfaces begin with I (error)
dotnet_naming_rule.interface_begins_with_i.severity = error
dotnet_naming_rule.interface_begins_with_i.symbols = interface
dotnet_naming_rule.interface_begins_with_i.style = begins_with_i
dotnet_naming_symbols.interface.applicable_kinds = interface
dotnet_naming_style.begins_with_i.required_prefix = I
dotnet_naming_style.begins_with_i.capitalization = pascal_case

# Silence StyleCop rules the team intentionally opts out of, e.g. XML docs on internals
dotnet_diagnostic.SA1633.severity = none   # File header
dotnet_diagnostic.SA1101.severity = none   # Prefix local calls with 'this'
```

### Format Commands

```bash
# Apply formatting + style fixes
dotnet format

# Verify only (CI gate — non-zero exit on any violation)
dotnet format --verify-no-changes
```

---

## Forbidden Runtime Patterns (CRITICAL)

**HARD GATE:** The following patterns are FORBIDDEN in production code. Each is either a correctness
hazard or defeats observability. CI MUST reject them.

| Pattern | Why FORBIDDEN | Correct Alternative |
|---------|---------------|---------------------|
| `Console.WriteLine` / `Console.Write` | No structure, no trace correlation | `ILogger<T>` message templates |
| `Debug.WriteLine` / `Trace.WriteLine` | Not production logging | `ILogger<T>` |
| String interpolation in a log call | Defeats structured logging | Message template + parameters |
| `throw new Exception(...)` | Untyped; callers can't handle | Specific exception type or `Result<T>` |
| `catch (Exception) { }` (empty) | Silently swallows failures | Handle, log, or rethrow |
| `async void` (except event handlers) | Uncatchable exceptions, unawaitable | `async Task` |
| `.Result` / `.Wait()` / `.GetAwaiter().GetResult()` | Sync-over-async → deadlocks, thread starvation | `await` |
| `DateTime.Now` | Ambiguous zone, not testable | `DateTimeOffset.UtcNow` or injected `TimeProvider` |
| `#nullable disable` | Disables null-safety | Fix the null-flow |
| Injecting `IServiceProvider` | Service Locator anti-pattern | Inject concrete dependencies |

### Detection Commands

```bash
# Run before every PR — expected: zero matches in production code (exclude tests)
grep -rn "Console.Write\|Debug.Write\|Trace.Write" --include="*.cs" src/
grep -rn "throw new Exception(" --include="*.cs" src/
grep -rn "async void" --include="*.cs" src/ | grep -v "EventHandler"
grep -rEn "\.Result\b|\.Wait\(\)|GetAwaiter\(\)\.GetResult\(\)" --include="*.cs" src/
grep -rn "DateTime.Now" --include="*.cs" src/
grep -rn "#nullable disable" --include="*.cs" src/
```

The `Meziantou.Analyzer` and Sonar rulesets flag most of these automatically; the grep checks are a
belt-and-braces CI gate.

---

## Startup Configuration Validation (MANDATORY)

**HARD GATE:** Services MUST validate configuration at startup and fail fast. A service that boots with
invalid configuration and fails on the first request is worse than one that refuses to start.

Use the Options pattern with `ValidateDataAnnotations()` and `ValidateOnStart()` (see
[bootstrap.md](bootstrap.md#configuration--options-pattern-mandatory)); add custom cross-field checks
with `Validate(...)`.

```csharp
builder.Services
    .AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection(DatabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(o => o.MaxPoolSize >= 1 && o.MaxPoolSize <= 500,
        "Database:MaxPoolSize must be between 1 and 500")
    .ValidateOnStart(); // Throws during startup, before serving traffic
```

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: no validation — silent misbehavior on first request
builder.Services.Configure<DatabaseOptions>(section); // never validated

// FORBIDDEN: validation that logs a warning and returns success
if (string.IsNullOrEmpty(opts.Host)) { _logger.LogWarning("no host"); } // must fail startup
```

---

## Code Coverage (MANDATORY)

**HARD GATE:** Line coverage MUST meet the project threshold (default **85%** for changed code, per the
dev-cycle testing gate). Collect coverage with Coverlet; report with ReportGenerator.

```xml
<!-- In each test project -->
<PackageReference Include="coverlet.collector" Version="6.*" />
```

```bash
# Collect coverage
dotnet test --collect:"XPlat Code Coverage"

# Generate an HTML/summary report (dotnet tool)
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:coverage -reporttypes:"Html;TextSummary"
```

### Enforce a Threshold in CI

```xml
<!-- Fail the test run below threshold (MSBuild integration) -->
<PropertyGroup>
  <Threshold>85</Threshold>
  <ThresholdType>line</ThresholdType>
  <ThresholdStat>total</ThresholdStat>
</PropertyGroup>
```

Coverage measures *executed* lines, not test quality. Pair the threshold with the edge-case
requirements in the testing standards — high coverage with only happy-path assertions is still
inadequate.

---

## Container Security (CONDITIONAL)

**CONDITIONAL:** Applies ONLY if the service has a `Dockerfile`. If none exists, mark N/A.

```bash
ls Dockerfile 2>/dev/null || echo "N/A — no Dockerfile"
```

### Non-Root User (MANDATORY if Dockerfile exists)

**HARD GATE:** Containers MUST NOT run as root. .NET 8+ images ship a non-root `app` user (UID 1654);
switch to it (or create your own).

```dockerfile
# Multi-stage build, non-root, pinned base images
FROM mcr.microsoft.com/dotnet/sdk:8.0.303 AS build
WORKDIR /src
COPY . .
RUN dotnet publish ./src/YourService.Api -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0.7
WORKDIR /app
COPY --from=build /app .
USER app            # non-root (built-in in .NET 8+ images)
EXPOSE 8080
ENTRYPOINT ["dotnet", "YourService.Api.dll"]
```

### Image Pinning (MANDATORY)

`:latest` is FORBIDDEN — builds must be reproducible.

| Tag | Status |
|-----|--------|
| `dotnet/aspnet:8.0.7` (exact) | REQUIRED |
| `dotnet/aspnet:8.0` (minor) | Acceptable |
| `dotnet/aspnet:latest` | FORBIDDEN |
| `dotnet/aspnet` (implicit latest) | FORBIDDEN |

```bash
grep -n "^USER" Dockerfile                       # must exist and not be root
grep -n "^FROM.*:latest\|^FROM [a-z/.-]*$" Dockerfile   # expected: 0 matches
```

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "`:latest` is convenient" | Non-reproducible builds cause incidents. | **Pin an exact tag** |
| "K8s securityContext handles non-root" | Defense in depth; the image should be secure too. | **Add `USER app`** |
| "It's internal only" | Internal ≠ exempt from least privilege. | **Follow all container rules** |

---

## Checklist

Before submitting C# code, verify:

- [ ] `Directory.Build.props` sets `Nullable=enable`, `TreatWarningsAsErrors=true`, `EnforceCodeStyleInBuild=true`
- [ ] No `#nullable disable` and no null-forgiving `!` used to silence real warnings
- [ ] Analyzer packages referenced (Sonar, StyleCop, Meziantou) with `PrivateAssets="all"`
- [ ] `.editorconfig` present with `root = true`; `dotnet format --verify-no-changes` passes
- [ ] No forbidden runtime patterns (Console logging, `async void`, sync-over-async, `DateTime.Now`, `throw new Exception`)
- [ ] Configuration validated with `ValidateOnStart()`; startup fails fast on invalid config
- [ ] Coverage meets the project threshold (default 85% changed-code); collected via Coverlet
- [ ] If a Dockerfile exists: non-root `USER`, base images pinned (no `:latest`)
