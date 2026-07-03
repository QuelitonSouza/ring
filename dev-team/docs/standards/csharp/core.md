# C# Standards - Core Foundation

> **Module:** core.md | **Parent:** [index.md](index.md)

This module covers the foundational requirements for all C# / ASP.NET Core projects: language
version, nullable reference types, analyzers, naming, records, project layout, and configuration.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Version](#version) | .NET and C# version requirements |
| 2 | [Nullable Reference Types (MANDATORY)](#nullable-reference-types-mandatory) | NRT enforcement, annotations |
| 3 | [Project Configuration (MANDATORY)](#project-configuration-mandatory) | `Directory.Build.props`, warnings-as-errors |
| 4 | [Code Analysis & `.editorconfig`](#code-analysis--editorconfig) | Roslyn analyzers, style rules |
| 5 | [Naming Conventions](#naming-conventions) | Types, members, files, async |
| 6 | [Records, Classes & Structs](#records-classes--structs) | When to use each |
| 7 | [Project Layout](#project-layout) | Solution and folder structure |
| 8 | [Configuration (Options Pattern) (MANDATORY)](#configuration-options-pattern-mandatory) | `IOptions<T>`, binding, validation |
| 9 | [Async/Await Conventions (MANDATORY)](#asyncawait-conventions-mandatory) | Task, CancellationToken, no sync-over-async |

---

## Version

- **Minimum**: .NET 8 (LTS)
- **Recommended**: Latest supported release (.NET 9 for STS features, .NET 8 for long-term stability)
- **Language**: C# 12 or later
- Always target an in-support runtime. Do not target end-of-life frameworks (`net6.0`, `netcoreapp3.1`).

```xml
<!-- YourService.Domain.csproj -->
<PropertyGroup>
  <TargetFramework>net8.0</TargetFramework>
  <LangVersion>latest</LangVersion>
</PropertyGroup>
```

---

## Nullable Reference Types (MANDATORY)

Nullable reference types (NRT) MUST be enabled solution-wide. Disabling NRT per-file or
per-project is **FORBIDDEN**.

```xml
<PropertyGroup>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

### Rules

| Rule | Description |
|------|-------------|
| Enable globally | Set `<Nullable>enable</Nullable>` in `Directory.Build.props` |
| No `#nullable disable` | Suppressing NRT in production code is FORBIDDEN |
| No null-forgiving abuse | The `!` operator is a last resort, never a default. Prefer guards or non-null design |
| Annotate intent | Use `T?` only where null is a real, meaningful state |
| Guard public inputs | Validate arguments at public boundaries (`ArgumentNullException.ThrowIfNull`) |

```csharp
// CORRECT: null is meaningful, annotated explicitly
public sealed record User(Guid Id, string Name, string? MiddleName);

// CORRECT: guard at the boundary
public UserService(IUserRepository repository)
{
    ArgumentNullException.ThrowIfNull(repository);
    _repository = repository;
}

// FORBIDDEN: silencing the compiler instead of designing for null
public string GetName() => _user!.Name;   // hides a real null bug

// FORBIDDEN: disabling NRT
#nullable disable                          // NEVER in production code
```

### FORBIDDEN Patterns

| Pattern | Why | Correct Alternative |
|---------|-----|---------------------|
| `#nullable disable` | Removes null safety | Fix the annotations |
| Reflexive `!` operator | Hides genuine null bugs | Guard clause or non-null design |
| `= null!` on required members | Papers over uninitialized state | `required` members or constructor init |

---

## Project Configuration (MANDATORY)

Every solution MUST have a `Directory.Build.props` at the repository root enforcing consistent
compilation settings for all projects.

```xml
<!-- Directory.Build.props (repository root) -->
<Project>
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <LangVersion>latest</LangVersion>

    <!-- Safety -->
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>

    <!-- Analyzers -->
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <AnalysisMode>All</AnalysisMode>

    <!-- Ergonomics -->
    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>$(NoWarn);CS1591</NoWarn> <!-- allow missing XML docs on internal members -->
  </PropertyGroup>
</Project>
```

Pin analyzer and package versions centrally with `Directory.Packages.props`
(Central Package Management) so all projects share one version set:

```xml
<!-- Directory.Packages.props (repository root) -->
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="8.0.*" />
    <PackageVersion Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.*" />
    <PackageVersion Include="Serilog.AspNetCore" Version="8.0.*" />
    <PackageVersion Include="xunit" Version="2.9.*" />
  </ItemGroup>
</Project>
```

---

## Code Analysis & `.editorconfig`

An `.editorconfig` at the repository root is **MANDATORY**. It enforces style and naming rules
as build errors (via `EnforceCodeStyleInBuild`).

```ini
# .editorconfig
root = true

[*.cs]
indent_style = space
indent_size = 4
charset = utf-8-bom
end_of_line = crlf
insert_final_newline = true
trim_trailing_whitespace = true

# File-scoped namespaces (C# 10+)
csharp_style_namespace_declarations = file_scoped:error

# var usage
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion

# Modern language features
csharp_style_prefer_switch_expression = true:suggestion
csharp_style_pattern_matching_over_is_with_cast_check = true:warning
csharp_style_prefer_primary_constructors = true:suggestion
dotnet_style_prefer_conditional_expression_over_return = true:suggestion

# Interfaces begin with I
dotnet_naming_rule.interface_begins_with_i.severity = error
dotnet_naming_rule.interface_begins_with_i.symbols = interface
dotnet_naming_rule.interface_begins_with_i.style = begins_with_i
dotnet_naming_symbols.interface.applicable_kinds = interface
dotnet_naming_style.begins_with_i.required_prefix = I
dotnet_naming_style.begins_with_i.capitalization = pascal_case

# Selected analyzer severities
dotnet_diagnostic.CA1062.severity = warning  # Validate arguments of public methods
dotnet_diagnostic.CA2007.severity = none     # ConfigureAwait not needed in ASP.NET Core apps
dotnet_diagnostic.CA1848.severity = suggestion # LoggerMessage delegates (hot paths)
dotnet_diagnostic.CA2016.severity = warning  # Forward CancellationToken
```

### Recommended Analyzer Packages

| Package | Purpose |
|---------|---------|
| `Microsoft.CodeAnalysis.NetAnalyzers` | Built-in with the SDK; enable via `AnalysisMode` |
| `SonarAnalyzer.CSharp` | Code quality and security rules |
| `Meziantou.Analyzer` | Additional best-practice rules (async, culture, DI) |
| `StyleCop.Analyzers` | Style consistency (optional; align with `.editorconfig`) |

> **Note:** `ConfigureAwait(false)` (CA2007) is not required in ASP.NET Core because there is no
> synchronization context. Require it only in shared libraries that may run under a sync context.

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Namespace | PascalCase, file-scoped | `namespace Billing.Domain;` |
| Class / record / struct | PascalCase | `InvoiceService`, `Money` |
| Interface | `I` + PascalCase | `IInvoiceRepository` |
| Public member / property | PascalCase | `TotalAmount`, `CreatedAt` |
| Private field | `_camelCase` | `_repository`, `_logger` |
| Local variable / parameter | camelCase | `invoiceId`, `cancellationToken` |
| Constant | PascalCase | `MaxRetryCount` |
| Async method | PascalCase + `Async` suffix | `GetByIdAsync` |
| Type parameter | `T` or `TDescriptive` | `T`, `TResponse`, `TKey` |
| Test method | `Method_Scenario_Expected` | `Create_WithEmptyName_ReturnsError` |

### File & Folder Rules

- One top-level type per file; file name matches the type name (`InvoiceService.cs`).
- Use file-scoped namespaces (`namespace X;`) — never block-scoped.
- Folder path mirrors the namespace (`Domain/Invoices/Invoice.cs` → `Billing.Domain.Invoices`).

---

## Records, Classes & Structs

Choose the type kind by semantics, not habit.

| Kind | Use For | Notes |
|------|---------|-------|
| `record` (class) | Immutable data: DTOs, requests/responses, value objects, events | Value equality, `with` expressions, concise |
| `class` | Entities with identity and behavior, services, stateful objects | Reference identity; mutate via methods, not setters |
| `readonly record struct` | Small immutable values (IDs, money, coordinates) | Avoids heap allocation for tiny types |
| `struct` | Rarely; only measured performance-critical value types | Prefer `readonly record struct` |

```csharp
// DTO — immutable record with value equality
public sealed record CreateInvoiceRequest(string CustomerId, decimal Amount, string Currency);

// Strongly-typed ID — readonly record struct
public readonly record struct InvoiceId(Guid Value)
{
    public static InvoiceId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}

// Entity — class with identity and behavior (see domain.md)
public sealed class Invoice
{
    public InvoiceId Id { get; }
    public InvoiceStatus Status { get; private set; }

    public void MarkPaid() => Status = InvoiceStatus.Paid; // behavior, not a setter
}
```

**Guidance:**
- Prefer `sealed` by default; open a type for inheritance only when you design for it.
- Prefer `init` and `required` over public setters for data you construct once.
- Do not expose mutable public setters on entities; mutate through intention-revealing methods.

---

## Project Layout

A service is organized as a solution with one project per Clean Architecture layer. Detailed
folder structure lives in [architecture.md](architecture.md#directory-structure); the baseline is:

```text
/YourService.sln
/Directory.Build.props
/Directory.Packages.props
/.editorconfig
/src
  /YourService.Domain          # Entities, value objects, domain events, errors (no dependencies)
  /YourService.Application      # Use cases, ports (interfaces), DTOs
  /YourService.Infrastructure   # EF Core, adapters, external clients
  /YourService.Api              # ASP.NET Core host: endpoints/controllers, Program.cs
/tests
  /YourService.Domain.Tests
  /YourService.Application.Tests
  /YourService.Api.IntegrationTests
```

---

## Configuration (Options Pattern) (MANDATORY)

All configuration MUST flow through `IConfiguration` bound to strongly-typed options classes.
Scattered `Environment.GetEnvironmentVariable` calls are **FORBIDDEN**.

### 1. Define Options Classes

```csharp
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public required string ConnectionString { get; init; }
    public int MaxPoolSize { get; init; } = 25;
    public int CommandTimeoutSeconds { get; init; } = 30;
}

public sealed class TelemetryOptions
{
    public const string SectionName = "Telemetry";

    public required string ServiceName { get; init; }
    public string? OtlpEndpoint { get; init; }
    public bool Enabled { get; init; } = true;
}
```

### 2. Bind and Validate at Startup

```csharp
// Program.cs
builder.Services
    .AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection(DatabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();   // fail fast at boot, not on first request

builder.Services
    .AddOptions<TelemetryOptions>()
    .Bind(builder.Configuration.GetSection(TelemetryOptions.SectionName))
    .ValidateOnStart();
```

### 3. Consume via `IOptions<T>`

```csharp
public sealed class InvoiceRepository
{
    private readonly DatabaseOptions _options;

    public InvoiceRepository(IOptions<DatabaseOptions> options)
        => _options = options.Value;
}
```

| Accessor | Use When |
|----------|----------|
| `IOptions<T>` | Singleton config that never changes at runtime |
| `IOptionsSnapshot<T>` | Per-request (scoped) values that may reload |
| `IOptionsMonitor<T>` | Singletons that must react to config changes |

### Configuration Sources (Priority, Highest First)

| Priority | Source | Example |
|----------|--------|---------|
| 1 | Environment variables | `Database__MaxPoolSize=50` |
| 2 | User secrets (Development) | `dotnet user-secrets` |
| 3 | `appsettings.{Environment}.json` | Per-environment overrides |
| 4 | `appsettings.json` | Defaults |

> ASP.NET Core uses `__` (double underscore) as the section separator in environment variables.

### FORBIDDEN

```csharp
// FORBIDDEN: scattered environment access
var host = Environment.GetEnvironmentVariable("DB_HOST");        // DON'T

// FORBIDDEN: config read outside startup, bypassing DI
public sealed class Service
{
    private readonly string _host = Environment.GetEnvironmentVariable("DB_HOST")!; // DON'T
}

// CORRECT: bound options via IOptions<T>
public Service(IOptions<DatabaseOptions> options) => _options = options.Value;
```

---

## Async/Await Conventions (MANDATORY)

| Rule | Detail |
|------|--------|
| Suffix async methods with `Async` | `GetByIdAsync`, `SaveChangesAsync` |
| Return `Task`/`Task<T>`/`ValueTask<T>` | Never `async void` (except UI/event handlers) |
| Accept and forward `CancellationToken` | Last parameter; pass to every downstream async call |
| Never block on async | No `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` |
| Use `await Task.Delay` | Never `Thread.Sleep` in async code |
| Use `DateTimeOffset.UtcNow` / `TimeProvider` | Never `DateTime.Now` for timestamps |

```csharp
// CORRECT
public async Task<Invoice?> GetByIdAsync(InvoiceId id, CancellationToken cancellationToken)
{
    return await _dbContext.Invoices
        .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
}

// FORBIDDEN: sync-over-async (deadlocks, thread-pool starvation)
var invoice = GetByIdAsync(id, ct).Result;          // NEVER
GetByIdAsync(id, ct).Wait();                        // NEVER

// FORBIDDEN: async void (exceptions are uncatchable)
public async void Process() { ... }                 // NEVER — use async Task

// FORBIDDEN: dropping the token
await _repository.SaveAsync(entity);                // token not forwarded
```

### FORBIDDEN Patterns Summary

| Pattern | Why | Correct Alternative |
|---------|-----|---------------------|
| `Console.WriteLine` / `Console.Write` | Unstructured, no correlation | `ILogger<T>` structured logging |
| `throw new Exception(...)` | Not specific | Specific exception type or `Result<T>` |
| `catch (Exception) { }` | Silent failure | Handle, log, or rethrow |
| `.Result` / `.Wait()` | Deadlocks | `await` |
| `async void` | Uncatchable exceptions | `async Task` |
| `Thread.Sleep` in async | Blocks thread | `await Task.Delay` |
| `DateTime.Now` | Ambiguous timezone | `DateTimeOffset.UtcNow` / `TimeProvider` |
| `dynamic` | Bypasses type safety | Concrete types / generics |
| `#nullable disable` | Removes null safety | Fix annotations |
