# C# Standards

> **MAINTENANCE:** This file is indexed in `dev-team/skills/shared-patterns/standards-coverage-table.md`.
> When adding/removing `## ` sections, follow FOUR-FILE UPDATE RULE in CLAUDE.md: (1) edit standards file, (2) update TOC, (3) update standards-coverage-table.md, (4) update agent file.

This file defines the specific standards for C# / ASP.NET Core development at QuelitonSouza.

> **📚 EXPANDED / MODULAR STANDARDS:** For deep, task-specific guidance, see the modular set in
> [`csharp/index.md`](csharp/index.md) — 16 modules covering architecture, api-patterns, domain,
> caching, idempotency, messaging, multi-tenant, security, bootstrap/observability, EF migration-safety,
> quality, compliance, and unit/integration/property testing. This file is the concise baseline;
> the `csharp/` folder is the detailed reference. Load only the modules you need.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Version](#version) | .NET and C# version requirements |
| 2 | [Core Dependency: lib-commons-csharp](#core-dependency-lib-commons-csharp-mandatory) | Required NuGet foundation package |
| 3 | [Frameworks & Libraries](#frameworks--libraries) | Required packages and versions |
| 4 | [Configuration](#configuration) | IConfiguration, Options pattern |
| 5 | [Observability](#observability) | OpenTelemetry .NET SDK |
| 6 | [Bootstrap](#bootstrap) | Program.cs, WebApplication builder |
| 7 | [Access Manager Integration](#access-manager-integration-mandatory) | Authentication and authorization with lib-auth-csharp |
| 8 | [License Manager Integration](#license-manager-integration-mandatory) | License validation with lib-license-csharp |
| 9 | [Data Transformation](#data-transformation-mandatory) | DTOs, mapping patterns |
| 10 | [Error Codes Convention](#error-codes-convention-mandatory) | Service-prefixed error codes |
| 11 | [Error Handling](#error-handling) | Result pattern, ProblemDetails |
| 12 | [Function Design](#function-design-mandatory) | Single responsibility principle |
| 13 | [Pagination Patterns](#pagination-patterns) | Cursor and page-based with IQueryable |
| 14 | [Testing](#testing) | xUnit, Moq, FluentAssertions, edge cases |
| 15 | [Logging](#logging) | Serilog + Microsoft.Extensions.Logging |
| 16 | [Code Analysis](#code-analysis) | Roslyn analyzers, .editorconfig |
| 17 | [Architecture Patterns](#architecture-patterns) | Clean Architecture |
| 18 | [Directory Structure](#directory-structure) | .NET project structure (QuelitonSouza pattern) |
| 19 | [Async/Await Patterns](#asyncawait-patterns) | Task, CancellationToken, Channel |
| 20 | [RabbitMQ Worker Pattern](#rabbitmq-worker-pattern) | MassTransit / BackgroundService |
| 21 | [Always-Valid Domain Model](#always-valid-domain-model-mandatory) | Constructor validation, invariant protection |
| 22 | [Nullable Reference Types](#nullable-reference-types-mandatory) | NRT enforcement, annotations |
| 23 | [Dependency Injection](#dependency-injection-mandatory) | Microsoft.Extensions.DependencyInjection |
| 24 | [Middleware Pipeline](#middleware-pipeline) | ASP.NET Core middleware patterns |

**Meta-sections (not checked by agents):**
- [Standards Compliance Output Format](#standards-compliance-output-format) - Report format for ring:dev-refactor
- [Checklist](#checklist) - Self-verification before submitting code

---

## Version

- **Minimum**: .NET 8 LTS
- **Language**: C# 12
- **Recommended**: Latest LTS release

---

## Core Dependency: lib-commons-csharp (MANDATORY)

All QuelitonSouza C# projects **MUST** use `QuelitonSouza.LibCommons.CSharp` as the foundation NuGet package. This ensures consistency across all services.

### Required NuGet Package

```xml
<!-- .csproj -->
<PackageReference Include="QuelitonSouza.LibCommons.CSharp" Version="1.0.0" />
```

### Required Namespaces

```csharp
using QuelitonSouza.LibCommons.Logging;          // Structured logging wrappers
using QuelitonSouza.LibCommons.Telemetry;         // OpenTelemetry helpers
using QuelitonSouza.LibCommons.Configuration;     // Configuration utilities
using QuelitonSouza.LibCommons.Http;              // HTTP middleware, response helpers
using QuelitonSouza.LibCommons.Postgres;          // PostgreSQL connection management
using QuelitonSouza.LibCommons.Mongo;             // MongoDB connection management
using QuelitonSouza.LibCommons.Redis;             // Redis connection management
using QuelitonSouza.LibCommons.Server;            // Server lifecycle, graceful shutdown
```

### What lib-commons-csharp Provides

| Namespace | Purpose | Where Used |
|-----------|---------|------------|
| `Logging` | Serilog wrappers, structured logging | Everywhere |
| `Telemetry` | OpenTelemetry initialization and helpers | Bootstrap, middleware |
| `Configuration` | Configuration utilities, environment binding | Bootstrap |
| `Http` | HTTP middleware, telemetry middleware, pagination, response helpers | Routes, handlers |
| `Postgres` | PostgreSQL connection management, pagination | Bootstrap, repositories |
| `Mongo` | MongoDB connection management | Bootstrap, repositories |
| `Redis` | Redis connection management | Bootstrap, repositories |
| `Server` | Server lifecycle with graceful shutdown | Bootstrap |

---

## Frameworks & Libraries

### Required Versions (Minimum)

| Library | Minimum Version | Purpose |
|---------|-----------------|---------|
| `QuelitonSouza.LibCommons.CSharp` | 1.0.0 | Core infrastructure |
| `Microsoft.AspNetCore` | 8.0 | HTTP framework |
| `Microsoft.EntityFrameworkCore` | 8.0 | ORM (primary) |
| `Dapper` | 2.1 | Micro-ORM (alternative) |
| `OpenTelemetry.Instrumentation.AspNetCore` | 1.7.0 | Telemetry |
| `Serilog.AspNetCore` | 8.0.0 | Structured logging |
| `xunit` | 2.7.0 | Testing |
| `Moq` | 4.20.0 | Mocking |
| `FluentAssertions` | 6.12.0 | Test assertions |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 8.0.0 | PostgreSQL EF Core provider |
| `MassTransit` | 8.0.0 | Message bus abstraction |

### HTTP Framework

| Approach | Use Case |
|----------|----------|
| **Minimal APIs** | Lightweight endpoints, microservices |
| **Controllers (MVC)** | Enterprise APIs, complex routing, API versioning |
| **gRPC** | Service-to-service communication |

### Minimal APIs Example

```csharp
var app = builder.Build();

app.MapGet("/v1/users/{id:guid}", async (Guid id, IUserService service, CancellationToken ct) =>
{
    var result = await service.GetByIdAsync(id, ct);
    return result.Match(
        success => Results.Ok(success),
        error => Results.Problem(error.ToProblemDetails()));
});

app.MapPost("/v1/users", async (CreateUserRequest request, IUserService service, CancellationToken ct) =>
{
    var result = await service.CreateAsync(request, ct);
    return result.Match(
        success => Results.Created($"/v1/users/{success.Id}", success),
        error => Results.Problem(error.ToProblemDetails()));
});
```

### Controllers Example

```csharp
[ApiController]
[Route("v1/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _service;

    public UsersController(IUserService service) => _service = service;

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result.Match<IActionResult>(
            success => Ok(success),
            error => Problem(error.ToProblemDetails()));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest request, CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return result.Match<IActionResult>(
            success => CreatedAtAction(nameof(GetById), new { id = success.Id }, success),
            error => Problem(error.ToProblemDetails()));
    }
}
```

### Database / ORM

| Library | Use Case |
|---------|----------|
| **Entity Framework Core** | **Primary** - Complex queries, migrations, change tracking |
| **Dapper** | **Alternative** - Raw SQL, performance-critical queries |
| Npgsql | PostgreSQL driver |
| MongoDB.Driver | MongoDB |
| StackExchange.Redis | Redis client |

### When to Use EF Core vs Dapper

| Scenario | Recommendation |
|----------|----------------|
| CRUD operations with relationships | EF Core |
| Complex LINQ queries | EF Core |
| Database migrations | EF Core |
| Performance-critical bulk operations | Dapper |
| Stored procedures | Dapper |
| Reporting queries with joins | Dapper |

### Testing

| Library | Use Case |
|---------|----------|
| xUnit | Test framework (MANDATORY) |
| Moq | Interface mocking (MANDATORY) |
| FluentAssertions | Readable assertions |
| Testcontainers | Integration tests |
| Microsoft.AspNetCore.Mvc.Testing | API integration tests |

---

## Configuration

All services **MUST** use `IConfiguration` with the Options pattern for configuration loading.

### 1. Define Configuration Classes

```csharp
// Configuration/DatabaseOptions.cs
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public string Host { get; init; } = string.Empty;
    public string User { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int Port { get; init; } = 5432;
    public string SslMode { get; init; } = "prefer";
    public int MaxOpenConnections { get; init; } = 25;
    public int MaxIdleConnections { get; init; } = 5;
}

// Configuration/TelemetryOptions.cs
public sealed class TelemetryOptions
{
    public const string SectionName = "Telemetry";

    public string ServiceName { get; init; } = string.Empty;
    public string ServiceVersion { get; init; } = string.Empty;
    public string Environment { get; init; } = string.Empty;
    public string OtlpEndpoint { get; init; } = string.Empty;
    public bool Enabled { get; init; }
}

// Configuration/AuthOptions.cs
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string Address { get; init; } = string.Empty;
    public bool Enabled { get; init; }
}
```

### 2. Register Configuration

```csharp
// Program.cs
builder.Services.Configure<DatabaseOptions>(
    builder.Configuration.GetSection(DatabaseOptions.SectionName));
builder.Services.Configure<TelemetryOptions>(
    builder.Configuration.GetSection(TelemetryOptions.SectionName));
builder.Services.Configure<AuthOptions>(
    builder.Configuration.GetSection(AuthOptions.SectionName));
```

### 3. Use Configuration

```csharp
// Inject via IOptions<T>, IOptionsSnapshot<T>, or IOptionsMonitor<T>
public class UserRepository
{
    private readonly DatabaseOptions _options;

    public UserRepository(IOptions<DatabaseOptions> options)
    {
        _options = options.Value;
    }
}
```

### Configuration Sources (Priority Order)

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | Environment variables | `Database__Host=localhost` |
| 2 | `appsettings.{Environment}.json` | Per-environment overrides |
| 3 | `appsettings.json` | Default values |
| 4 (lowest) | Code defaults | `init` property defaults |

### Environment Variable Naming Convention

| Category | Prefix | Example |
|----------|--------|---------|
| Database | `Database__` | `Database__Host`, `Database__User` |
| Database Replica | `Database__Replica__` | `Database__Replica__Host` |
| MongoDB | `Mongo__` | `Mongo__Host`, `Mongo__Name` |
| Redis | `Redis__` | `Redis__Host`, `Redis__Password` |
| Telemetry | `Telemetry__` | `Telemetry__ServiceName` |
| Auth | `Auth__` | `Auth__Enabled`, `Auth__Address` |

> **Note:** ASP.NET Core uses `__` (double underscore) as section separator in environment variables.

### What not to Do

```csharp
// FORBIDDEN: Manual environment variable access scattered across code
var host = Environment.GetEnvironmentVariable("DB_HOST");  // DON'T

// FORBIDDEN: Configuration outside startup
public class UserService
{
    private readonly string _dbHost = Environment.GetEnvironmentVariable("DB_HOST")!; // DON'T
}

// CORRECT: All configuration through IOptions<T>
public class UserService
{
    private readonly DatabaseOptions _options;
    public UserService(IOptions<DatabaseOptions> options) => _options = options.Value;
}
```

---

## Observability

All services **MUST** integrate OpenTelemetry using the .NET SDK and lib-commons-csharp.

### Distributed Tracing Architecture

```
+---------------------------------------------------------------------------+
|                        INCOMING HTTP REQUEST                                |
|                                                                             |
|  Headers: traceparent, tracestate (W3C Trace Context)                       |
|  - If present: child Activity created with remote parent                    |
|  - If absent: new root Activity created                                     |
+---------------------------------------------------------------------------+
                                    |
                                    v
+---------------------------------------------------------------------------+
|  MIDDLEWARE: OpenTelemetry ASP.NET Core Instrumentation                     |
|                                                                             |
|  What it does:                                                              |
|  1. Extracts W3C trace context from incoming headers                        |
|  2. Creates root Activity for the HTTP request                              |
|  3. Sets Activity tags: http.method, http.url, http.route, etc.             |
|  4. Propagates Activity through HttpContext                                 |
+---------------------------------------------------------------------------+
                                    |
                                    v
+---------------------------------------------------------------------------+
|  SERVICE LAYER (MANDATORY child Activities for all methods)                  |
|                                                                             |
|  using var activity = ActivitySource.StartActivity("service.tenant.create"); |
|  activity?.SetTag("tenant.name", name);                                     |
|                                                                             |
|  // Structured logging (automatically correlated with trace)                |
|  _logger.LogInformation("Creating tenant: {TenantName}", name);             |
|                                                                             |
|  // Business errors -> AddEvent (Activity status stays OK)                  |
|  activity?.AddEvent(new ActivityEvent("validation_failed"));                 |
|                                                                             |
|  // Technical errors -> SetStatus ERROR                                     |
|  activity?.SetStatus(ActivityStatusCode.Error, "DB connection failed");      |
+---------------------------------------------------------------------------+
                                    |
                                    v
+---------------------------------------------------------------------------+
|  REPOSITORY LAYER (optional - for complex database operations)              |
|                                                                             |
|  Same pattern as service layer                                              |
+---------------------------------------------------------------------------+
                                    |
                                    v
+---------------------------------------------------------------------------+
|  OUTGOING CALLS (HTTP, gRPC) - AUTOMATIC TRACE PROPAGATION                  |
|                                                                             |
|  HttpClient automatically injects traceparent/tracestate via                |
|  OpenTelemetry.Instrumentation.Http                                         |
+---------------------------------------------------------------------------+
```

### Complete Telemetry Flow (Bootstrap to Shutdown)

```
+-----------------------------------------------------------------+
| 1. BOOTSTRAP (Program.cs)                                         |
|    builder.Services.AddOpenTelemetry()                            |
|        .ConfigureResource(...)                                    |
|        .WithTracing(...)                                          |
|        .WithMetrics(...)                                          |
|    -> Registers OpenTelemetry provider at startup                 |
+-----------------------------------------------------------------+
                           |
                           v
+-----------------------------------------------------------------+
| 2. MIDDLEWARE PIPELINE                                            |
|    ASP.NET Core OpenTelemetry middleware creates root Activity    |
|    Automatic instrumentation for HTTP requests                   |
+-----------------------------------------------------------------+
                           |
                           v
+-----------------------------------------------------------------+
| 3. ANY LAYER (handlers, services, repositories)                   |
|    using var activity = _activitySource                            |
|        .StartActivity("service.domain.operation");                |
|    _logger.LogInformation("Processing...");                       |
+-----------------------------------------------------------------+
                           |
                           v
+-----------------------------------------------------------------+
| 4. HOST LIFETIME                                                  |
|    IHostApplicationLifetime handles graceful shutdown              |
|    -> Flushes telemetry, drains connections                       |
+-----------------------------------------------------------------+
```

### Service Method Instrumentation Checklist (MANDATORY)

**Every service method MUST implement these steps:**

| # | Step | Code Pattern | Purpose |
|---|------|--------------|---------|
| 1 | Create Activity | `using var activity = _activitySource.StartActivity("layer.domain.operation");` | Create traceable operation |
| 2 | Set tags | `activity?.SetTag("key", value);` | Add context to trace |
| 3 | Use structured logger | `_logger.LogInformation("message {Param}", param);` | Logs correlated with trace |
| 4 | Handle business errors | `activity?.AddEvent(new ActivityEvent("validation_failed"));` | Expected errors |
| 5 | Handle technical errors | `activity?.SetStatus(ActivityStatusCode.Error, message);` | Unexpected errors |
| 6 | Pass CancellationToken | All async calls receive `CancellationToken` | Cancellation propagation |

### Error Handling Classification

| Error Type | Examples | Activity Handling | Activity Status |
|------------|----------|-------------------|-----------------|
| **Business Error** | Validation failed, Resource not found, Conflict | `AddEvent` | OK (adds event) |
| **Technical Error** | DB connection failed, Timeout, Network error | `SetStatus(Error)` | ERROR |

### Complete Instrumented Service Method Template

```csharp
public class UserService : IUserService
{
    private static readonly ActivitySource ActivitySource = new("YourService.Application");
    private readonly ILogger<UserService> _logger;
    private readonly IUserRepository _repository;

    public UserService(ILogger<UserService> logger, IUserRepository repository)
    {
        _logger = logger;
        _repository = repository;
    }

    public async Task<Result<UserResponse, AppError>> CreateAsync(
        CreateUserRequest request, CancellationToken ct)
    {
        // 1. Create child Activity for this operation
        using var activity = ActivitySource.StartActivity("service.user.create");

        // 2. Structured logging (automatically correlated with trace)
        _logger.LogInformation("Creating user: {Email}", request.Email);

        // 3. Input validation - BUSINESS error (expected, Activity stays OK)
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            _logger.LogWarning("Validation failed: empty name");
            activity?.AddEvent(new ActivityEvent("validation_failed",
                tags: new ActivityTagsCollection { { "reason", "empty_name" } }));
            return AppError.Validation("Name is required");
        }

        // 4. External call - pass CancellationToken for cancellation propagation
        var result = await _repository.CreateAsync(entity, ct);
        if (result.IsFailure)
        {
            if (result.Error.IsNotFound)
            {
                _logger.LogWarning("Entity not found: {Id}", request.Id);
                activity?.AddEvent(new ActivityEvent("entity_not_found"));
                return result.Error;
            }

            // TECHNICAL error - unexpected failure, Activity marked ERROR
            _logger.LogError("Failed to create entity: {Error}", result.Error);
            activity?.SetStatus(ActivityStatusCode.Error, "Repository create failed");
            return result.Error;
        }

        _logger.LogInformation("User created successfully: {Id}", result.Value.Id);
        return UserResponse.FromEntity(result.Value);
    }
}
```

### ActivitySource Naming Conventions

| Layer | Pattern | Examples |
|-------|---------|----------|
| HTTP Endpoint | `handler.{resource}.{action}` | `handler.tenant.create`, `handler.agent.list` |
| Service | `service.{domain}.{operation}` | `service.tenant.create`, `service.agent.register` |
| Repository | `repository.{entity}.{operation}` | `repository.tenant.get_by_id`, `repository.agent.list` |
| External Call | `external.{service}.{operation}` | `external.payment.process`, `external.auth.validate` |
| Consumer | `consumer.{queue}.{operation}` | `consumer.balance_create.process` |

### Bootstrap Setup

```csharp
// Program.cs
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(
        serviceName: builder.Configuration["Telemetry:ServiceName"]!,
        serviceVersion: builder.Configuration["Telemetry:ServiceVersion"]))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddSource("YourService.Application")
        .AddOtlpExporter(opts =>
            opts.Endpoint = new Uri(builder.Configuration["Telemetry:OtlpEndpoint"]!)))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(opts =>
            opts.Endpoint = new Uri(builder.Configuration["Telemetry:OtlpEndpoint"]!)));
```

### Instrumentation Anti-Patterns (FORBIDDEN)

| Anti-Pattern | Problem | Correct Pattern |
|--------------|---------|-----------------|
| No `ActivitySource` in service | Operations not traceable | Create `static ActivitySource` per class |
| Not calling `StartActivity` | No child spans | Always create Activity for service methods |
| Missing `using` on Activity | Activity never disposed, memory leak | `using var activity = ...` |
| `Console.WriteLine` for logging | No trace correlation | Use `ILogger<T>` from DI |
| Ignoring `CancellationToken` | Cannot cancel long operations | Pass `CancellationToken` through all async calls |
| Hardcoded trace IDs | Breaks distributed tracing | Use automatic Activity propagation |
| Not adding OTLP exporter | Traces not exported | Configure exporter in bootstrap |

---

## Bootstrap

All services **MUST** follow the minimal `Program.cs` bootstrap pattern.

### Program.cs - Complete Reference

```csharp
using Serilog;
using YourService.Api.Middleware;
using YourService.Application;
using YourService.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// 1. CONFIGURE LOGGING (Serilog)
builder.Host.UseSerilog((context, loggerConfig) =>
    loggerConfig.ReadFrom.Configuration(context.Configuration));

// 2. CONFIGURE OPENTELEMETRY
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(
        serviceName: builder.Configuration["Telemetry:ServiceName"]!,
        serviceVersion: builder.Configuration["Telemetry:ServiceVersion"]))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddSource("YourService.Application")
        .AddOtlpExporter())
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter());

// 3. CONFIGURE OPTIONS
builder.Services.Configure<DatabaseOptions>(
    builder.Configuration.GetSection(DatabaseOptions.SectionName));
builder.Services.Configure<TelemetryOptions>(
    builder.Configuration.GetSection(TelemetryOptions.SectionName));
builder.Services.Configure<AuthOptions>(
    builder.Configuration.GetSection(AuthOptions.SectionName));

// 4. REGISTER INFRASTRUCTURE (Repositories, DbContext)
builder.Services.AddInfrastructure(builder.Configuration);

// 5. REGISTER APPLICATION (Services, Use Cases)
builder.Services.AddApplication();

// 6. CONFIGURE HTTP
builder.Services.AddControllers(); // If using Controllers
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHealthChecks();

var app = builder.Build();

// 7. CONFIGURE MIDDLEWARE PIPELINE
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();

// 8. MAP ENDPOINTS
app.MapControllers(); // If using Controllers
// app.MapUserEndpoints(); // If using Minimal APIs
app.MapHealthChecks("/health");

app.Run();
```

### Extension Methods for Registration

```csharp
// Infrastructure/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        // Database
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Primary")));

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();

        return services;
    }
}

// Application/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Services
        services.AddScoped<IUserService, UserService>();

        return services;
    }
}
```

**Key Points:**
- `Program.cs` is the single point where all dependencies are registered
- Order matters: logging -> telemetry -> options -> infrastructure -> application -> HTTP -> middleware -> endpoints
- Extension methods keep `Program.cs` clean
- `app.Run()` handles graceful shutdown via `IHostApplicationLifetime`

---

## Access Manager Integration (MANDATORY)

All services **MUST** integrate with the Access Manager system for authentication and authorization. Services use `lib-auth-csharp` to communicate with `plugin-auth`.

### Architecture Overview

```text
+---------------------------------------------------------------------------+
|                         ACCESS MANAGER                                      |
+------------------------------------+--------------------------------------+
|  identity                          |  plugin-auth                          |
|  (CRUD: users, apps, groups,       |  (authn + authz)                     |
|   permissions)                     |                                       |
+------------------------------------+--------------------------------------+
                                    ^
                                    | HTTP API
                                    |
+-----------------------------------+---------------------------------------+
|                           lib-auth-csharp                                   |
|  (NuGet package - ASP.NET Core middleware for authorization)                |
+-----------------------------------+---------------------------------------+
                                    | NuGet reference
                                    v
+-----------------------------------------------------------------------+
|  Consumer Services (.NET microservices)                                  |
+-----------------------------------------------------------------------+
```

### Required NuGet Package

```xml
<PackageReference Include="QuelitonSouza.LibAuth.CSharp" Version="2.0.0" />
```

### Required Configuration

```json
// appsettings.json
{
  "Auth": {
    "Address": "http://plugin-auth:4000",
    "Enabled": true,
    "ClientId": "",
    "ClientSecret": ""
  }
}
```

### Bootstrap Integration

```csharp
// Program.cs
builder.Services.Configure<AuthOptions>(
    builder.Configuration.GetSection(AuthOptions.SectionName));

builder.Services.AddQuelitonAuth(builder.Configuration);

// Middleware pipeline
app.UseAuthentication();
app.UseAuthorization();
```

### Authorization on Endpoints

#### Minimal APIs

```csharp
app.MapPost("/v1/resources",
    [Authorize(Policy = "resources:post")] async (CreateRequest request, IService service, CancellationToken ct) =>
    {
        var result = await service.CreateAsync(request, ct);
        return result.Match(
            success => Results.Created($"/v1/resources/{success.Id}", success),
            error => Results.Problem(error.ToProblemDetails()));
    });
```

#### Controllers

```csharp
[ApiController]
[Route("v1/[controller]")]
public class ResourcesController : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = "resources:post")]
    public async Task<IActionResult> Create(CreateRequest request, CancellationToken ct)
    {
        // ...
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "resources:get")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        // ...
    }
}
```

### Organization ID Middleware

```csharp
public class OrganizationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string OrgIdHeader = "X-Organization-Id";

    public OrganizationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(OrgIdHeader, out var orgIdValue)
            || !Guid.TryParse(orgIdValue, out var orgId))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = 400,
                Title = "Missing or invalid Organization ID",
                Detail = $"Header '{OrgIdHeader}' must contain a valid GUID."
            });
            return;
        }

        context.Items[OrgIdHeader] = orgId;
        await _next(context);
    }
}
```

### What not to Do

```csharp
// FORBIDDEN: Hardcoded tokens
request.Headers.Add("Authorization", "Bearer hardcoded-token-here"); // NEVER

// FORBIDDEN: Skipping authorization on protected endpoints
app.MapPost("/v1/sensitive-data", handler); // Missing [Authorize]

// FORBIDDEN: Direct calls to plugin-auth API
var client = new HttpClient();
await client.PostAsync("http://plugin-auth:4000/v1/authorize", ...); // Use lib-auth-csharp

// CORRECT: Always use lib-auth-csharp for auth operations
[Authorize(Policy = "resources:post")]
```

---

## License Manager Integration (MANDATORY)

All licensed plugins/products **MUST** integrate with the License Manager system. Services use `lib-license-csharp` for license validation.

### Required NuGet Package

```xml
<PackageReference Include="QuelitonSouza.LibLicense.CSharp" Version="2.0.0" />
```

### Required Configuration

```json
// appsettings.json
{
  "License": {
    "Key": "",
    "OrganizationIds": "global"
  }
}
```

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `License__Key` | string | License key for this plugin | `lic_xxxxxxxxxxxx` |
| `License__OrganizationIds` | string | Comma-separated org IDs or "global" | `org1,org2` or `global` |

### Bootstrap Integration

```csharp
// Program.cs
builder.Services.AddQuelitonLicense(builder.Configuration);

// Middleware pipeline (must be early)
app.UseQuelitonLicenseValidation();
app.UseAuthentication();
app.UseAuthorization();
```

### Middleware Behavior

| Mode | Startup | Per-Request |
|------|---------|-------------|
| Global (`OrganizationIds=global`) | Validates license, throws if invalid | Skips validation, calls next |
| Multi-Org | Validates all orgs, throws if none valid | Validates `X-Organization-Id` header |

### Default Skip Paths

| Path | Reason |
|------|--------|
| `/health` | Health checks must always respond |
| `/version` | Version endpoint is public |
| `/swagger` | API documentation is public |

### What not to Do

```csharp
// FORBIDDEN: Hardcoded license keys
services.AddQuelitonLicense("hardcoded-key", "global"); // NEVER

// FORBIDDEN: Skipping license middleware
app.MapPost("/v1/paid-feature", handler); // Missing license middleware

// CORRECT: Always use configuration
builder.Services.AddQuelitonLicense(builder.Configuration);
```

---

## Data Transformation (MANDATORY)

All database models **MUST** implement transformation methods to/from domain entities.

### Pattern with EF Core

```csharp
// Infrastructure/Persistence/Models/UserModel.cs
public class UserModel
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    // ToEntity converts database model to domain entity
    public User ToEntity()
    {
        return User.Reconstruct(
            new UserId(Id),
            new Email(Email),
            Name,
            Enum.Parse<UserStatus>(Status),
            CreatedAt,
            UpdatedAt,
            DeletedAt);
    }

    // FromEntity converts domain entity to database model
    public static UserModel FromEntity(User user)
    {
        return new UserModel
        {
            Id = user.Id.Value,
            Email = user.Email.Value,
            Name = user.Name,
            Status = user.Status.ToString(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            DeletedAt = user.DeletedAt
        };
    }
}
```

### Pattern with Dapper

```csharp
// Infrastructure/Persistence/Mappers/UserMapper.cs
public static class UserMapper
{
    public static User ToEntity(this UserRow row)
    {
        return User.Reconstruct(
            new UserId(row.Id),
            new Email(row.Email),
            row.Name,
            Enum.Parse<UserStatus>(row.Status),
            row.CreatedAt,
            row.UpdatedAt,
            row.DeletedAt);
    }

    public static UserRow ToRow(this User user)
    {
        return new UserRow
        {
            Id = user.Id.Value,
            Email = user.Email.Value,
            Name = user.Name,
            Status = user.Status.ToString(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            DeletedAt = user.DeletedAt
        };
    }
}
```

### Why This Matters

- **Layer isolation**: Domain does not know about database concerns
- **Testability**: Domain entities can be tested without database
- **Flexibility**: Database schema can change without affecting domain
- **Type safety**: Explicit conversions prevent accidental mixing

---

## Error Codes Convention (MANDATORY)

Each service **MUST** define error codes with a service-specific prefix.

### Service Prefixes

| Service | Prefix | Example |
|---------|--------|---------|
| QuelitonSouza | QSZ | QSZ-0001 |
| Plugin-Fees | FEE | FEE-0001 |
| Plugin-Auth | AUT | AUT-0001 |
| Platform | PLT | PLT-0001 |

### Error Code Structure

```csharp
// Domain/Errors/ErrorCodes.cs
public static class ErrorCodes
{
    public const string InvalidInput = "PLT-0001";
    public const string NotFound = "PLT-0002";
    public const string Unauthorized = "PLT-0003";
    public const string Forbidden = "PLT-0004";
    public const string Conflict = "PLT-0005";
    public const string InternalError = "PLT-0006";
    public const string ValidationFailed = "PLT-0007";
}
```

### AppError Type

```csharp
// Domain/Errors/AppError.cs
public sealed class AppError
{
    public string Code { get; }
    public string Message { get; }
    public int StatusCode { get; }
    public object? Details { get; }

    private AppError(string code, string message, int statusCode, object? details = null)
    {
        Code = code;
        Message = message;
        StatusCode = statusCode;
        Details = details;
    }

    public bool IsNotFound => StatusCode == 404;
    public bool IsValidation => StatusCode == 400;

    public static AppError Validation(string message, object? details = null)
        => new(ErrorCodes.InvalidInput, message, 400, details);

    public static AppError NotFound(string entity, object id)
        => new(ErrorCodes.NotFound, $"{entity} with id '{id}' not found", 404);

    public static AppError Conflict(string message)
        => new(ErrorCodes.Conflict, message, 409);

    public static AppError Internal(string message)
        => new(ErrorCodes.InternalError, message, 500);

    public ProblemDetails ToProblemDetails() => new()
    {
        Status = StatusCode,
        Title = Code,
        Detail = Message,
        Extensions = { ["errorCode"] = Code }
    };
}
```

---

## Error Handling

### Result Pattern (RECOMMENDED)

```csharp
// Domain/Common/Result.cs
public readonly struct Result<TValue, TError>
{
    private readonly TValue? _value;
    private readonly TError? _error;
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    public TValue Value => IsSuccess
        ? _value! : throw new InvalidOperationException("Cannot access Value on failure result");
    public TError Error => IsFailure
        ? _error! : throw new InvalidOperationException("Cannot access Error on success result");

    private Result(TValue value)
    {
        _value = value;
        IsSuccess = true;
    }

    private Result(TError error)
    {
        _error = error;
        IsSuccess = false;
    }

    public static implicit operator Result<TValue, TError>(TValue value) => new(value);
    public static implicit operator Result<TValue, TError>(TError error) => new(error);

    public TResult Match<TResult>(Func<TValue, TResult> onSuccess, Func<TError, TResult> onError)
        => IsSuccess ? onSuccess(_value!) : onError(_error!);
}
```

### Exception Handling Middleware

```csharp
// Api/Middleware/ExceptionHandlingMiddleware.cs
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred");

            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Internal Server Error",
                Detail = "An unexpected error occurred."
            };

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(problemDetails);
        }
    }
}
```

### Forbidden

```csharp
// FORBIDDEN: Generic exceptions
throw new Exception("Something went wrong"); // Use specific types or Result<T>

// FORBIDDEN: Empty catch blocks
try { /* ... */ } catch (Exception) { } // NEVER swallow exceptions

// FORBIDDEN: Catch-all without logging
try { /* ... */ } catch (Exception ex) { return null; } // NEVER ignore errors

// CORRECT: Use Result pattern
return AppError.Validation("Name is required");

// CORRECT: Specific exception types when exceptions are needed
throw new EntityNotFoundException("User", userId);
```

---

## Function Design (MANDATORY)

**Single Responsibility Principle (SRP):** Each method MUST have exactly ONE responsibility.

### Rules

| Rule | Description |
|------|-------------|
| **One responsibility per method** | A method should do ONE thing and do it well |
| **Max 20-30 lines** | If longer, break into smaller methods |
| **One level of abstraction** | Do not mix high-level and low-level operations |
| **Descriptive names** | Method name should describe its single responsibility |

### Examples

```csharp
// BAD - Multiple responsibilities
public async Task<Order> ProcessOrderAsync(Order order, CancellationToken ct)
{
    if (order.Items is null || order.Items.Count == 0)
        throw new ValidationException("No items");
    var total = order.Items.Sum(i => i.Price * i.Quantity);
    if (!string.IsNullOrEmpty(order.CouponCode))
        total *= 0.9m;
    await _db.SaveAsync(order, ct);
    await _emailService.SendAsync(order.CustomerEmail, "Order confirmed", ct);
    return order;
}

// GOOD - Single responsibility per method
public async Task<Result<Order, AppError>> ProcessOrderAsync(Order order, CancellationToken ct)
{
    var validationResult = ValidateOrder(order);
    if (validationResult.IsFailure) return validationResult.Error;

    var total = CalculateTotal(order.Items);
    total = ApplyDiscount(total, order.CouponCode);

    var saveResult = await SaveOrderAsync(order, total, ct);
    if (saveResult.IsFailure) return saveResult.Error;

    await NotifyCustomerAsync(order.CustomerEmail, ct);
    return order;
}
```

### Signs a Method Has Multiple Responsibilities

| Sign | Action |
|------|--------|
| Multiple `// section` comments | Split at comment boundaries |
| "And" in method name | Split into separate methods |
| More than 3 parameters | Consider parameter object or splitting |
| Nested conditionals > 2 levels | Extract inner logic to methods |
| Method does validation and processing | Separate validation method |

---

## Pagination Patterns

### Quick Reference

| Pattern | Best For | Query Params | Response Fields |
|---------|----------|--------------|-----------------|
| Cursor-Based | High-volume data, real-time | `cursor`, `limit`, `sortOrder` | `nextCursor`, `prevCursor` |
| Page-Based | Low-volume data, UI navigation | `page`, `limit`, `sortOrder` | `page`, `limit` |
| Page-Based + Total | UI needs "Page X of Y" | `page`, `limit`, `sortOrder` | `page`, `limit`, `total` |

### Cursor-Based Pagination with EF Core

```csharp
public async Task<CursorPagedResult<TransactionResponse>> GetAllAsync(
    CursorPaginationRequest request, CancellationToken ct)
{
    var query = _dbContext.Transactions.AsNoTracking();

    if (!string.IsNullOrEmpty(request.Cursor))
    {
        var cursor = CursorEncoder.Decode(request.Cursor);
        query = request.SortOrder == "desc"
            ? query.Where(t => t.CreatedAt < cursor.CreatedAt
                || (t.CreatedAt == cursor.CreatedAt && t.Id.CompareTo(cursor.Id) < 0))
            : query.Where(t => t.CreatedAt > cursor.CreatedAt
                || (t.CreatedAt == cursor.CreatedAt && t.Id.CompareTo(cursor.Id) > 0));
    }

    query = request.SortOrder == "desc"
        ? query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id)
        : query.OrderBy(t => t.CreatedAt).ThenBy(t => t.Id);

    var items = await query
        .Take(request.Limit + 1)
        .Select(t => t.ToResponse())
        .ToListAsync(ct);

    var hasMore = items.Count > request.Limit;
    if (hasMore) items.RemoveAt(items.Count - 1);

    return new CursorPagedResult<TransactionResponse>
    {
        Items = items,
        Limit = request.Limit,
        NextCursor = hasMore ? CursorEncoder.Encode(items.Last()) : null,
        PrevCursor = !string.IsNullOrEmpty(request.Cursor) ? request.Cursor : null
    };
}
```

### Page-Based Pagination with EF Core

```csharp
public async Task<PagedResult<OrganizationResponse>> GetAllAsync(
    PagePaginationRequest request, CancellationToken ct)
{
    var query = _dbContext.Organizations.AsNoTracking();

    query = request.SortOrder == "desc"
        ? query.OrderByDescending(o => o.CreatedAt)
        : query.OrderBy(o => o.CreatedAt);

    var items = await query
        .Skip((request.Page - 1) * request.Limit)
        .Take(request.Limit)
        .Select(o => o.ToResponse())
        .ToListAsync(ct);

    return new PagedResult<OrganizationResponse>
    {
        Items = items,
        Page = request.Page,
        Limit = request.Limit
    };
}
```

### Page-Based with Dapper

```csharp
public async Task<PagedResult<OrganizationResponse>> GetAllAsync(
    PagePaginationRequest request, CancellationToken ct)
{
    const string sql = """
        SELECT * FROM organizations
        ORDER BY created_at @SortOrder
        LIMIT @Limit OFFSET @Offset
        """;

    using var connection = await _connectionFactory.CreateConnectionAsync(ct);
    var items = await connection.QueryAsync<OrganizationRow>(sql, new
    {
        SortOrder = request.SortOrder,
        Limit = request.Limit,
        Offset = (request.Page - 1) * request.Limit
    });

    return new PagedResult<OrganizationResponse>
    {
        Items = items.Select(r => r.ToEntity().ToResponse()).ToList(),
        Page = request.Page,
        Limit = request.Limit
    };
}
```

---

## Testing

### Theory Tests with InlineData (MANDATORY)

```csharp
public class UserServiceTests
{
    [Theory]
    [InlineData("John", "john@example.com", true)]
    [InlineData("", "john@example.com", false)]
    [InlineData("John", "", false)]
    [InlineData("John", "invalid-email", false)]
    public async Task CreateUser_WithVariousInputs_ReturnsExpectedResult(
        string name, string email, bool shouldSucceed)
    {
        // Arrange
        var service = CreateService();
        var request = new CreateUserRequest(name, email);

        // Act
        var result = await service.CreateAsync(request, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().Be(shouldSucceed);
    }
}
```

### Test Naming Convention

```
MethodName_Scenario_ExpectedResult

Examples:
- CreateUser_WithValidInput_ReturnsUser
- CreateUser_WithEmptyName_ReturnsValidationError
- GetById_WithNonExistentId_ReturnsNotFound
- CalculateTotal_WithNegativeAmount_ThrowsArgumentException
```

### Edge Case Coverage (MANDATORY)

**Every acceptance criterion MUST have edge case tests beyond the happy path.**

| AC Type | Required Edge Cases | Minimum Count |
|---------|---------------------|---------------|
| Input validation | null, empty string, boundary values, invalid format, special chars, max length | 3+ |
| CRUD operations | not found, duplicate key, concurrent modification, large payload | 3+ |
| Business logic | zero value, negative numbers, overflow, boundary conditions, invalid state | 3+ |
| Error handling | CancellationToken cancelled, connection refused, timeout, invalid response | 2+ |
| Authentication | expired token, invalid signature, missing claims, revoked token | 2+ |

### Mock Setup with Moq (MANDATORY)

```csharp
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _repositoryMock = new();
    private readonly Mock<ILogger<UserService>> _loggerMock = new();

    private UserService CreateService()
        => new(_loggerMock.Object, _repositoryMock.Object);

    [Fact]
    public async Task CreateUser_WithValidInput_CallsRepositoryAndReturnsUser()
    {
        // Arrange
        var request = new CreateUserRequest("John", "john@example.com");
        var expectedUser = User.Create("John", new Email("john@example.com")).Value;

        _repositoryMock
            .Setup(r => r.CreateAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<User, AppError>.Success(expectedUser));

        // Act
        var result = await CreateService().CreateAsync(request, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Name.Should().Be("John");
        _repositoryMock.Verify(r => r.CreateAsync(
            It.Is<User>(u => u.Name == "John"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

### Anti-Pattern (FORBIDDEN)

```csharp
// FORBIDDEN: Only happy path
[Fact]
public async Task CreateUser_WithValidInput_ReturnsUser()
{
    var result = await _service.CreateAsync(validRequest, CancellationToken.None);
    result.IsSuccess.Should().BeTrue(); // No edge cases = incomplete test
}
```

---

## Logging

**HARD GATE:** All C# services MUST use Serilog with `ILogger<T>`. Unstructured logging is FORBIDDEN.

### FORBIDDEN Logging Patterns (CRITICAL - Automatic FAIL)

| Pattern | Why FORBIDDEN | Detection |
|---------|---------------|-----------|
| `Console.WriteLine()` | No structure, no trace correlation | `grep -rn "Console.Write" --include="*.cs"` |
| `Console.Write()` | No structure, no trace correlation | Same as above |
| `Debug.WriteLine()` | Debug output, not production logging | `grep -rn "Debug.Write" --include="*.cs"` |
| `Trace.WriteLine()` | System.Diagnostics trace, not structured | `grep -rn "Trace.Write" --include="*.cs"` |
| String interpolation in log | Prevents structured log queries | `grep -rn 'Log.*\$"' --include="*.cs"` |

**If any of these patterns are found in production code, REVIEW FAILS. No exceptions.**

### Using ILogger<T> (REQUIRED Pattern)

```csharp
// CORRECT: Structured logging with message templates
_logger.LogInformation("Creating user: {Email}", email);
_logger.LogWarning("Rate limit approaching: {Current}/{Limit}", current, limit);
_logger.LogError(ex, "Failed to save entity: {EntityId}", entityId);

// FORBIDDEN: String interpolation (prevents structured queries)
_logger.LogInformation($"Creating user: {email}"); // DON'T - use template
```

### Serilog Configuration

```json
// appsettings.json
{
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.Seq"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithEnvironmentName"]
  }
}
```

### What not to Log (Sensitive Data)

```csharp
// FORBIDDEN - sensitive data
_logger.LogInformation("User login: {Password}", password);    // NEVER
_logger.LogInformation("Payment: {CardNumber}", card);         // NEVER
_logger.LogInformation("Auth: {Token}", token);                // NEVER
_logger.LogInformation("User: {CPF}", cpf);                   // NEVER (PII)
```

---

## Code Analysis

### .editorconfig (MANDATORY)

```ini
# .editorconfig
root = true

[*.cs]
indent_style = space
indent_size = 4
charset = utf-8-bom
end_of_line = crlf
insert_final_newline = true

# Naming rules
dotnet_naming_rule.interface_should_be_begins_with_i.severity = error
dotnet_naming_rule.interface_should_be_begins_with_i.symbols = interface
dotnet_naming_rule.interface_should_be_begins_with_i.style = begins_with_i

# Code style
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_expression_bodied_methods = when_on_single_line:suggestion
csharp_style_prefer_switch_expression = true:suggestion
csharp_style_namespace_declarations = file_scoped:error

# Analyzers
dotnet_diagnostic.CA1062.severity = warning  # Validate public method arguments
dotnet_diagnostic.CA2007.severity = warning  # ConfigureAwait
dotnet_diagnostic.CA1848.severity = warning  # Use LoggerMessage delegates
```

### Directory.Build.props (MANDATORY)

```xml
<Project>
  <PropertyGroup>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  </PropertyGroup>
</Project>
```

### Recommended Analyzer Packages

| Package | Purpose |
|---------|---------|
| `Microsoft.CodeAnalysis.NetAnalyzers` | Built-in .NET analyzers |
| `SonarAnalyzer.CSharp` | Code quality and security |
| `StyleCop.Analyzers` | Code style consistency |
| `Meziantou.Analyzer` | Additional best practice rules |

---

## Architecture Patterns

### Clean Architecture

```text
/src
  /YourService.Api             # Presentation layer (entry point)
    Controllers/               # (if using Controllers)
    Endpoints/                 # (if using Minimal APIs)
    Middleware/
    Program.cs
  /YourService.Application     # Application layer (use cases)
    Interfaces/                # Port interfaces
    Services/                  # Application services
    DTOs/                      # Request/Response DTOs
  /YourService.Domain          # Domain layer (no dependencies)
    Entities/
    ValueObjects/
    Errors/
    Common/                    # Result<T>, base types
  /YourService.Infrastructure  # Infrastructure layer (adapters)
    Persistence/
      Configurations/          # EF Core configurations
      Repositories/            # Repository implementations
      Models/                  # Database models
    ExternalServices/          # HTTP clients, third-party integrations
```

### Dependency Rule

```
Api -> Application -> Domain
Api -> Infrastructure -> Application -> Domain

Domain has ZERO external dependencies.
Application depends only on Domain.
Infrastructure implements Application interfaces.
Api wires everything together.
```

### Interface-Based Abstractions

```csharp
// Application/Interfaces/IUserRepository.cs (Port - defined where USED)
public interface IUserRepository
{
    Task<Result<User, AppError>> GetByIdAsync(UserId id, CancellationToken ct);
    Task<Result<User, AppError>> CreateAsync(User user, CancellationToken ct);
}

// Infrastructure/Persistence/Repositories/UserRepository.cs (Adapter)
public class UserRepository : IUserRepository
{
    private readonly AppDbContext _dbContext;

    public UserRepository(AppDbContext dbContext) => _dbContext = dbContext;

    public async Task<Result<User, AppError>> GetByIdAsync(UserId id, CancellationToken ct)
    {
        var model = await _dbContext.Users.FindAsync(new object[] { id.Value }, ct);
        return model is null
            ? AppError.NotFound("User", id.Value)
            : model.ToEntity();
    }
}
```

---

## Directory Structure

The directory structure follows the **QuelitonSouza pattern** - Clean Architecture with clear layer separation.

```text
/src
  /YourService.Api                    # ASP.NET Core project (entry point)
    Program.cs                        # Bootstrap
    appsettings.json                  # Configuration
    appsettings.Development.json      # Dev overrides
    Controllers/                      # (if using Controllers)
    Endpoints/                        # (if using Minimal APIs)
    Middleware/                        # Custom middleware
    Filters/                          # Action filters
  /YourService.Application           # Business logic
    Interfaces/                       # Port interfaces (repositories, services)
    Services/                         # Application services (use cases)
      Commands/                       # Write operations
      Queries/                        # Read operations
    DTOs/                             # Request/Response DTOs
    Mapping/                          # Manual mapping extensions
    Validators/                       # Input validation
  /YourService.Domain                # Domain entities (no dependencies)
    Entities/                         # Domain entities
    ValueObjects/                     # Value objects (UserId, Email, etc.)
    Errors/                           # Error codes, AppError
    Common/                           # Result<T>, base types
    Events/                           # Domain events
  /YourService.Infrastructure        # Infrastructure implementations
    Persistence/
      Configurations/                 # EF Core entity configurations
      Repositories/                   # Repository implementations
      Models/                         # Database models (UserModel, etc.)
      Migrations/                     # EF Core migrations
    ExternalServices/                 # HTTP clients, third-party APIs
    Messaging/                        # RabbitMQ producers/consumers
    DependencyInjection.cs            # Extension method for DI registration
/tests
  /YourService.UnitTests             # Unit tests
  /YourService.IntegrationTests      # Integration tests (WebApplicationFactory)
  /YourService.ArchitectureTests     # Architecture constraint tests (optional)
YourService.sln                      # Solution file
Directory.Build.props                # Shared build properties
.editorconfig                        # Code style
```

**Key principles of the QuelitonSouza .NET pattern:**
- **.NET uses project-per-layer** for clear separation
- **Solution file** (`.sln`) groups all projects
- **`Directory.Build.props`** shared across all projects
- **Migrations** live inside Infrastructure project

---

## Async/Await Patterns

### CancellationToken Propagation (MANDATORY)

```csharp
// CORRECT: Pass CancellationToken through all async calls
public async Task<Result<User, AppError>> CreateAsync(
    CreateUserRequest request, CancellationToken ct)
{
    var user = User.Create(request.Name, new Email(request.Email));
    return await _repository.CreateAsync(user.Value, ct);
}

// FORBIDDEN: Ignoring CancellationToken
public async Task<User> CreateAsync(CreateUserRequest request)
{
    return await _repository.CreateAsync(user); // Missing CancellationToken!
}
```

### Async/Await Rules

| Pattern | Status | Why |
|---------|--------|-----|
| `await Task.Delay(ms, ct)` | CORRECT | Async delay with cancellation |
| `Thread.Sleep(ms)` | FORBIDDEN | Blocks thread, no cancellation |
| `async Task Method()` | CORRECT | Proper async signature |
| `async void Method()` | FORBIDDEN | Cannot await, cannot catch exceptions |
| `await task.ConfigureAwait(false)` | CORRECT (libraries) | Avoids deadlocks in library code |
| `task.Result` or `task.Wait()` | FORBIDDEN | Sync-over-async, deadlock risk |
| `Task.Run(() => SyncMethod())` | AVOID | Fake async, wastes thread pool |

### Channel Pattern (Producer-Consumer)

```csharp
public class BackgroundProcessor : BackgroundService
{
    private readonly Channel<WorkItem> _channel;

    public BackgroundProcessor()
    {
        _channel = Channel.CreateBounded<WorkItem>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.Wait
        });
    }

    public async ValueTask EnqueueAsync(WorkItem item, CancellationToken ct)
        => await _channel.Writer.WriteAsync(item, ct);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var item in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessAsync(item, stoppingToken);
        }
    }
}
```

### Parallel Processing with Bounded Concurrency

```csharp
// CORRECT: Bounded parallelism with cancellation
await Parallel.ForEachAsync(items, new ParallelOptions
{
    MaxDegreeOfParallelism = 5,
    CancellationToken = ct
}, async (item, token) =>
{
    await ProcessItemAsync(item, token);
});
```

---

## RabbitMQ Worker Pattern

When the application includes async processing (API+Worker or Worker Only), follow this pattern.

### Application Types

| Type | Characteristics | Components |
|------|----------------|------------|
| **API Only** | HTTP endpoints, no async processing | Controllers/Endpoints, Services, Repositories |
| **API + Worker** | HTTP endpoints + async message processing | All above + Consumers, Producers |
| **Worker Only** | No HTTP, only message processing | Consumers, Services, Repositories |

### MassTransit Consumer (RECOMMENDED)

```csharp
// Infrastructure/Messaging/Consumers/BalanceCreateConsumer.cs
public class BalanceCreateConsumer : IConsumer<BalanceCreateMessage>
{
    private static readonly ActivitySource ActivitySource = new("YourService.Consumers");
    private readonly ILogger<BalanceCreateConsumer> _logger;
    private readonly IBalanceService _service;

    public BalanceCreateConsumer(ILogger<BalanceCreateConsumer> logger, IBalanceService service)
    {
        _logger = logger;
        _service = service;
    }

    public async Task Consume(ConsumeContext<BalanceCreateMessage> context)
    {
        using var activity = ActivitySource.StartActivity("consumer.balance_create.process");

        _logger.LogInformation("Processing balance create: {AuditId}", context.Message.AuditId);

        var result = await _service.CreateBalanceAsync(context.Message, context.CancellationToken);

        if (result.IsFailure)
        {
            _logger.LogError("Failed to create balance: {Error}", result.Error.Message);
            activity?.SetStatus(ActivityStatusCode.Error, result.Error.Message);
            throw new InvalidOperationException(result.Error.Message); // Triggers retry/DLQ
        }

        _logger.LogInformation("Balance created successfully: {Id}", result.Value.Id);
    }
}
```

### MassTransit Bootstrap

```csharp
// Program.cs
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<BalanceCreateConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"], h =>
        {
            h.Username(builder.Configuration["RabbitMQ:User"]!);
            h.Password(builder.Configuration["RabbitMQ:Password"]!);
        });

        cfg.ReceiveEndpoint("balance-create-queue", e =>
        {
            e.PrefetchCount = 10;
            e.ConcurrentMessageLimit = 5;
            e.ConfigureConsumer<BalanceCreateConsumer>(context);
            e.UseMessageRetry(r => r.Exponential(5, TimeSpan.FromMilliseconds(500),
                TimeSpan.FromSeconds(10), TimeSpan.FromMilliseconds(200)));
        });
    });
});
```

### BackgroundService Worker (Alternative for raw RabbitMQ.Client)

```csharp
public class RabbitMqWorker : BackgroundService
{
    private readonly ILogger<RabbitMqWorker> _logger;
    private readonly IConnection _connection;
    private IChannel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);
        await _channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 10, global: false,
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                await ProcessMessageAsync(ea.Body.ToArray(), stoppingToken);
                await _channel.BasicAckAsync(ea.DeliveryTag, multiple: false,
                    cancellationToken: stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process message");
                await _channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: true,
                    cancellationToken: stoppingToken);
            }
        };

        await _channel.BasicConsumeAsync(queue: "my-queue", autoAck: false, consumer: consumer,
            cancellationToken: stoppingToken);

        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
```

### Worker Checklist

- [ ] Handlers are idempotent (safe to process duplicates)
- [ ] Manual Ack enabled (`autoAck: false`)
- [ ] Error handling triggers retry/DLQ
- [ ] CancellationToken propagated
- [ ] OpenTelemetry Activity for tracing
- [ ] Exponential backoff for retries
- [ ] Graceful shutdown via `CancellationToken`
- [ ] Dead Letter Queue configured for poison messages

---

## Always-Valid Domain Model (MANDATORY)

**HARD GATE:** All domain entities MUST use the Always-Valid Domain Model pattern. Anemic models (classes with public setters and no validation) are FORBIDDEN.

### Why This Pattern Is Mandatory

| Problem with Anemic Models | Impact |
|---------------------------|--------|
| Objects can exist in invalid state | Bugs propagate through system |
| Validation scattered across codebase | Duplication, inconsistency |
| Business rules not enforced at creation | Invalid data reaches database |
| No single source of truth for validity | Every consumer must re-validate |

### The Pattern

**Core Principle:** An entity can NEVER exist in an invalid state. Validation happens in the factory method, not later.

```csharp
// CORRECT: Always-Valid Domain Model
public sealed class Rule
{
    public RuleId Id { get; }
    public string Name { get; private set; }
    public string Expression { get; private set; }
    public DateTime CreatedAt { get; }

    // Private constructor - cannot create invalid instances
    private Rule(RuleId id, string name, string expression, DateTime createdAt)
    {
        Id = id;
        Name = name;
        Expression = expression;
        CreatedAt = createdAt;
    }

    // Factory method MUST validate and return Result
    public static Result<Rule, AppError> Create(string name, string expression)
    {
        if (string.IsNullOrWhiteSpace(name))
            return AppError.Validation("Name is required");
        if (name.Length > 255)
            return AppError.Validation("Name exceeds 255 characters");
        if (!IsValidExpression(expression))
            return AppError.Validation("Invalid expression syntax");

        return new Rule(RuleId.New(), name.Trim(), expression, DateTime.UtcNow);
    }

    // Mutation with validation
    public Result<Rule, AppError> UpdateExpression(string newExpression)
    {
        if (!IsValidExpression(newExpression))
            return AppError.Validation("Invalid expression syntax");

        Expression = newExpression;
        return this;
    }

    // Reconstruction from database (trusted data, no validation)
    public static Rule Reconstruct(
        RuleId id, string name, string expression, DateTime createdAt)
        => new(id, name, expression, createdAt);

    private static bool IsValidExpression(string expression)
        => !string.IsNullOrWhiteSpace(expression);
}
```

```csharp
// FORBIDDEN: Anemic Model
public class Rule
{
    public Guid Id { get; set; }         // Public setter - can be modified!
    public string Name { get; set; }     // Can be empty - invalid!
    public string Expression { get; set; } // No validation!
}
```

### Value Objects

```csharp
// Domain/ValueObjects/Email.cs
public sealed record Email
{
    public string Value { get; }

    public Email(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Email cannot be empty", nameof(value));
        if (!value.Contains('@'))
            throw new ArgumentException("Invalid email format", nameof(value));
        Value = value.Trim().ToLowerInvariant();
    }

    public static implicit operator string(Email email) => email.Value;
}

// Domain/ValueObjects/UserId.cs
public sealed record UserId(Guid Value)
{
    public static UserId New() => new(Guid.NewGuid());
    public static UserId From(Guid value) => new(value);
}
```

### Requirements

| Requirement | Description |
|-------------|-------------|
| **Factory method returns Result** | `Create(...) => Result<Entity, AppError>` |
| **Private constructor** | Prevent direct instantiation |
| **Private setters** | Prevent external mutation |
| **No public setters** | Mutation through domain methods that validate |
| **Invariants enforced** | Business rules validated at creation |
| **Reconstruct method** | For database loading (trusted data, no validation) |

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Validation at boundary is enough" | Boundary validation is for input format. Domain validation is for business rules. | **Use both: DTO validation + factory validation** |
| "Adds boilerplate" | Invalid objects cause more work debugging than factories. | **Write the factory. It's an investment.** |
| "We trust our code" | Every consumer must remember to validate. Humans forget. | **Enforce at construction. Forget-proof.** |
| "Record types are enough" | Records with public init don't validate. | **Use private constructor + factory** |
| "Existing code doesn't do this" | Technical debt. Refactor when touching the code. | **New code MUST follow. Refactor gradually.** |
| "Simple class is fine for DTOs" | DTOs are fine as anemic. Domain entities are NOT. | **Distinguish DTO from Domain Entity** |

---

## Nullable Reference Types (MANDATORY)

### Project Configuration (MANDATORY)

```xml
<!-- Directory.Build.props or .csproj -->
<PropertyGroup>
    <Nullable>enable</Nullable>
</PropertyGroup>
```

### Rules

| Rule | Example | Status |
|------|---------|--------|
| Enable NRT globally | `<Nullable>enable</Nullable>` | MANDATORY |
| Use `?` for nullable references | `string? middleName` | CORRECT |
| Non-nullable by default | `string name` means non-null | CORRECT |
| Validate at boundaries | Check for null at API/infra boundaries | MANDATORY |
| `#nullable disable` | Disabling NRT per file | FORBIDDEN |
| `!` null-forgiving operator | `value!` without justification | FORBIDDEN |

### Examples

```csharp
// CORRECT: Nullable annotations
public class User
{
    public string Name { get; }           // Never null
    public string? MiddleName { get; }    // May be null
    public Email Email { get; }           // Never null (value object)
}

// CORRECT: Null check at boundary
public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
{
    var user = await _service.GetByIdAsync(id, ct);
    if (user is null)
        return NotFound();
    return Ok(user);
}

// FORBIDDEN: Suppressing nullable warnings
var name = user.MiddleName!; // DON'T - check for null instead
var name = user.MiddleName ?? "Unknown"; // CORRECT
```

---

## Dependency Injection (MANDATORY)

### Built-in DI (MANDATORY)

All services **MUST** use `Microsoft.Extensions.DependencyInjection` (built-in). Third-party DI containers are not needed.

### Service Lifetimes

| Lifetime | When to Use | Example |
|----------|-------------|---------|
| **Scoped** | Per-request state, DbContext, repositories | `AddScoped<IUserRepository, UserRepository>()` |
| **Transient** | Stateless, lightweight services | `AddTransient<IValidator, Validator>()` |
| **Singleton** | Shared state, configuration, HTTP clients | `AddSingleton<ICache, MemoryCache>()` |

### Registration Pattern

```csharp
// Infrastructure/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        // DbContext (Scoped by default)
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Primary")));

        // Repositories (Scoped - same lifetime as DbContext)
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();

        // HTTP clients (uses IHttpClientFactory internally)
        services.AddHttpClient<IExternalService, ExternalServiceClient>(client =>
            client.BaseAddress = new Uri(configuration["ExternalService:Url"]!));

        return services;
    }
}
```

### Constructor Injection (ONLY pattern allowed)

```csharp
// CORRECT: Constructor injection
public class UserService : IUserService
{
    private readonly IUserRepository _repository;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository repository, ILogger<UserService> logger)
    {
        _repository = repository;
        _logger = logger;
    }
}

// FORBIDDEN: Service Locator pattern
public class UserService
{
    private readonly IServiceProvider _provider;

    public UserService(IServiceProvider provider)
    {
        _provider = provider; // DON'T inject IServiceProvider directly
    }

    public void DoSomething()
    {
        var repo = _provider.GetRequiredService<IUserRepository>(); // DON'T
    }
}
```

### What not to Do

```csharp
// FORBIDDEN: Service Locator
services.AddScoped<IService>(sp => new Service(sp)); // Injecting IServiceProvider

// FORBIDDEN: Static service access
public static class ServiceLocator
{
    public static IServiceProvider Provider { get; set; } // NEVER
}

// FORBIDDEN: Third-party DI containers (unless justified)
services.AddAutofac(); // Unnecessary - built-in DI is sufficient

// CORRECT: Constructor injection with explicit dependencies
public class UserService(IUserRepository repo, ILogger<UserService> logger) : IUserService
{
    // Primary constructor (C# 12) - clean and concise
}
```

---

## Middleware Pipeline

### Middleware Order (CRITICAL)

The order of middleware registration in ASP.NET Core is significant. Follow this order:

```csharp
var app = builder.Build();

// 1. Exception handling (MUST be first - catches all downstream exceptions)
app.UseMiddleware<ExceptionHandlingMiddleware>();

// 2. Request logging (Serilog)
app.UseSerilogRequestLogging();

// 3. HTTPS redirection (if applicable)
app.UseHttpsRedirection();

// 4. CORS (must be before auth)
app.UseCors();

// 5. License validation (must be before auth, after CORS)
app.UseQuelitonLicenseValidation();

// 6. Authentication (identity verification)
app.UseAuthentication();

// 7. Authorization (permission verification)
app.UseAuthorization();

// 8. Custom middleware (organization ID, rate limiting, etc.)
app.UseMiddleware<OrganizationIdMiddleware>();

// 9. Endpoints (MUST be last)
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
```

### Custom Middleware Pattern

```csharp
public class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestTimingMiddleware> _logger;

    public RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        await _next(context);

        stopwatch.Stop();
        _logger.LogInformation(
            "Request {Method} {Path} completed in {ElapsedMs}ms with status {StatusCode}",
            context.Request.Method,
            context.Request.Path,
            stopwatch.ElapsedMilliseconds,
            context.Response.StatusCode);
    }
}
```

### What not to Do

```csharp
// FORBIDDEN: Authorization before Authentication
app.UseAuthorization();
app.UseAuthentication(); // WRONG ORDER - auth must come first

// FORBIDDEN: Exception handling after endpoints
app.MapControllers();
app.UseMiddleware<ExceptionHandlingMiddleware>(); // TOO LATE - won't catch endpoint exceptions

// CORRECT: Exception handling first, auth before authz
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

---

## Standards Compliance Output Format

When producing a Standards Compliance report (used by ring:dev-refactor workflow), follow these output formats:

### If all Categories Are Compliant

```markdown
## Standards Compliance

### QuelitonSouza/Ring Standards Comparison

#### Bootstrap & Configuration
| Category | Current Pattern | Expected Pattern | Status | Evidence |
|----------|----------------|------------------|--------|----------|
| Program.cs | `WebApplication.CreateBuilder` | Minimal hosting model | Compliant | `src/Api/Program.cs:1` |
| Options pattern | `IOptions<T>` | Options pattern with validation | Compliant | `src/Api/Program.cs:15` |
| Serilog | `UseSerilog()` | Serilog with structured logging | Compliant | `src/Api/Program.cs:8` |
| OpenTelemetry | `AddOpenTelemetry()` | OTel with tracing + metrics | Compliant | `src/Api/Program.cs:12` |

#### Data Access & Domain
| Category | Current Pattern | Expected Pattern | Status | Evidence |
|----------|----------------|------------------|--------|----------|
| ... | ... | ... | Compliant | ... |

### Verdict: FULLY COMPLIANT

No migration actions required. All categories verified against QuelitonSouza/Ring C# Standards.
```

### If any Category Is Non-Compliant

```markdown
## Standards Compliance

### QuelitonSouza/Ring Standards Comparison

#### Bootstrap & Configuration
| Category | Current Pattern | Expected Pattern | Status | File/Location |
|----------|----------------|------------------|--------|---------------|
| Logging | `Console.WriteLine` | Serilog with `ILogger<T>` | Non-Compliant | `src/Api/Controllers/UserController.cs:42` |

### Verdict: NON-COMPLIANT (X of Y categories)

### Required Changes for Compliance

1. **Logging Migration**
   - Replace: `Console.WriteLine` calls
   - With: `ILogger<T>` structured logging
   - NuGet: `Serilog.AspNetCore`
   - Files affected: [list files]
```

---

## Checklist

Before submitting C# code, verify:

- [ ] Using .NET 8 LTS or newer
- [ ] `<Nullable>enable</Nullable>` in all projects
- [ ] `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` configured
- [ ] Configuration uses Options pattern with `IOptions<T>`
- [ ] OpenTelemetry initialized with tracing and metrics
- [ ] All service methods have `ActivitySource.StartActivity` instrumentation
- [ ] `ILogger<T>` used for all logging (no `Console.Write`, no string interpolation)
- [ ] `CancellationToken` propagated through all async calls
- [ ] No `async void`, no `.Result`, no `.Wait()`, no `Thread.Sleep`
- [ ] Error codes use service prefix (e.g., PLT-0001)
- [ ] Result pattern used for error handling (not bare exceptions)
- [ ] Tests use xUnit with Theory/InlineData and Moq
- [ ] Edge cases covered (minimum 3+ per acceptance criterion)
- [ ] Database models have `ToEntity()` / `FromEntity()` methods
- [ ] Interfaces defined in Application layer (where used, not where implemented)
- [ ] Domain entities use factory methods (`Create()`) with validation
- [ ] Factory methods return `Result<Entity, AppError>` - never create invalid state
- [ ] Constructor injection only (no Service Locator)
- [ ] Middleware pipeline in correct order
- [ ] `.editorconfig` and `Directory.Build.props` configured
- [ ] No sensitive data in logs
