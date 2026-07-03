# C# Standards - Bootstrap & Observability

> **Module:** bootstrap.md | **Parent:** [index.md](index.md)

This module covers application initialization (`Program.cs`), dependency injection wiring,
configuration via the Options pattern, structured logging, OpenTelemetry (traces + metrics + logs)
using the .NET SDK, health checks, connection management, and graceful shutdown.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards. Ring
> standards are the baseline; `PROJECT_RULES.md` may add rules but must not weaken these.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Program.cs Initialization Order](#programcs-initialization-order-mandatory) | Deterministic startup sequence |
| 2 | [Configuration & Options Pattern](#configuration--options-pattern-mandatory) | Typed, validated configuration |
| 3 | [Dependency Injection](#dependency-injection-mandatory) | Registration modules, lifetimes |
| 4 | [Structured Logging](#structured-logging-mandatory) | Serilog + `ILogger<T>` |
| 5 | [OpenTelemetry (Traces, Metrics, Logs)](#opentelemetry-traces-metrics-logs-mandatory) | .NET SDK instrumentation |
| 6 | [Health Checks](#health-checks-mandatory) | Liveness vs readiness |
| 7 | [Connection Management](#connection-management-mandatory) | Pooling, timeouts, resiliency |
| 8 | [Graceful Shutdown](#graceful-shutdown-mandatory) | Draining, hosted service lifetime |

---

## Program.cs Initialization Order (MANDATORY)

All services **MUST** follow a deterministic top-level `Program.cs` sequence. Order matters:
configuration and logging come first (so later stages can be observed), then telemetry, then
services, then the middleware pipeline.

```csharp
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// 1. CONFIGURATION — layer sources (secrets outside development)
builder.Services.AddOptions();
builder.Services.Configure<DatabaseOptions>(
    builder.Configuration.GetSection(DatabaseOptions.SectionName));
builder.Services.Configure<TelemetryOptions>(
    builder.Configuration.GetSection(TelemetryOptions.SectionName));

// 2. LOGGING — Serilog reads from configuration
builder.Host.UseSerilog((context, services, config) =>
    config.ReadFrom.Configuration(context.Configuration)
          .ReadFrom.Services(services)
          .Enrich.FromLogContext());

// 3. OBSERVABILITY — OpenTelemetry traces + metrics (+ logs; see that section)
builder.AddOpenTelemetryObservability();

// 4. INFRASTRUCTURE — DbContext, repositories, external clients
builder.Services.AddInfrastructure(builder.Configuration);

// 5. APPLICATION — use cases / services
builder.Services.AddApplication();

// 6. HTTP — endpoints, auth, health, rate limiting, CORS
builder.Services.AddControllers();          // or Minimal API endpoints
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>(name: "postgres", tags: ["ready"]);

var app = builder.Build();

// 7. MIDDLEWARE PIPELINE — order is significant
app.UseSerilogRequestLogging();
app.UseExceptionHandler();       // ProblemDetails, see api-patterns.md
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors("DefaultCors");      // see security.md
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();            // AFTER auth, see security.md

// 8. ENDPOINTS
app.MapControllers();
app.MapHealthChecks("/health", new() { Predicate = _ => false });          // liveness
app.MapHealthChecks("/readyz", new() { Predicate = check => check.Tags.Contains("ready") }); // readiness

app.Run();
```

**Key points:**
- Extension methods (`AddInfrastructure`, `AddApplication`, `AddOpenTelemetryObservability`) keep
  `Program.cs` thin and testable.
- `app.Run()` blocks until shutdown and drives graceful shutdown via `IHostApplicationLifetime`.
- The middleware order above is mandatory: exception handling early, CORS before auth, rate limiter
  after auth.

---

## Configuration & Options Pattern (MANDATORY)

All configuration **MUST** be strongly typed via the Options pattern and validated at startup. Direct
`Environment.GetEnvironmentVariable` / `IConfiguration["key"]` access scattered through the code is
FORBIDDEN.

```csharp
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    [Required] public string Host { get; init; } = string.Empty;
    [Required] public string Name { get; init; } = string.Empty;
    [Range(1, 65535)] public int Port { get; init; } = 5432;
    [Range(1, 500)] public int MaxPoolSize { get; init; } = 50;
}
```

### Validate on Start (Fail Fast)

```csharp
builder.Services
    .AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection(DatabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart(); // Throws at startup if invalid — never boots misconfigured
```

Consume via `IOptions<T>` (singleton), `IOptionsSnapshot<T>` (scoped, reloadable), or
`IOptionsMonitor<T>` (singleton, change-notified).

### Configuration Sources (Priority, Highest First)

| Priority | Source |
|----------|--------|
| 1 | Environment variables (`Database__Host`) |
| 2 | User Secrets (Development) / Key Vault (Production) |
| 3 | `appsettings.{Environment}.json` |
| 4 | `appsettings.json` |

> ASP.NET Core uses `__` (double underscore) as the section separator in environment variable names.

### What not to Do

```csharp
// FORBIDDEN: Scattered env access
var host = Environment.GetEnvironmentVariable("DB_HOST");

// FORBIDDEN: Reading raw config keys in services
public UserService(IConfiguration config) => _host = config["Database:Host"]!;

// CORRECT: Inject the validated options object
public UserService(IOptions<DatabaseOptions> options) => _options = options.Value;
```

---

## Dependency Injection (MANDATORY)

Use the built-in `Microsoft.Extensions.DependencyInjection` container. Register dependencies through
per-layer extension methods so composition is explicit and `Program.cs` stays clean.

```csharp
// Infrastructure/DependencyInjection.cs
public static class InfrastructureModule
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Primary")));

        services.AddScoped<IUserRepository, UserRepository>();
        return services;
    }
}

// Application/DependencyInjection.cs
public static class ApplicationModule
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();
        return services;
    }
}
```

### Lifetimes

| Lifetime | Use For | Caution |
|----------|---------|---------|
| `Singleton` | Stateless, thread-safe services; clients (`HttpClient` via factory) | Must not capture scoped deps |
| `Scoped` | Per-request services, `DbContext`, repositories | Default for business logic |
| `Transient` | Lightweight, stateless helpers | New instance per resolution |

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: Service Locator (injecting the container)
public UserService(IServiceProvider provider) { } // Inject concrete dependencies instead

// FORBIDDEN: Captive dependency (Scoped resolved from a Singleton)
services.AddSingleton<Cache>(); // Cache injecting a scoped DbContext = runtime failure

// FORBIDDEN: new-ing up an HttpClient per call (socket exhaustion)
var client = new HttpClient(); // Use IHttpClientFactory
```

---

## Structured Logging (MANDATORY)

**HARD GATE:** All logging MUST use `ILogger<T>` from DI with message templates. `Console.WriteLine`,
`Debug.WriteLine`, and string interpolation inside log calls are FORBIDDEN.

```csharp
// CORRECT: message templates (structured, queryable, trace-correlated)
_logger.LogInformation("Creating user {Email}", request.Email);
_logger.LogWarning("Pool low {Current}/{Max}", current, max);
_logger.LogError(ex, "Failed to save entity {EntityId}", id);

// FORBIDDEN
Console.WriteLine("starting");                       // No structure, no correlation
_logger.LogInformation($"Creating user {email}");    // Interpolation defeats structured logs
```

### Serilog Configuration (appsettings.json)

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console",
        "Args": { "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact" } }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithEnvironmentName"]
  }
}
```

### Probe Log Noise

Health/readiness probes run every few seconds. Suppress request logging for `/health`, `/readyz`, and
`/metrics` so they do not flood logs:

```csharp
app.UseSerilogRequestLogging(options =>
    options.GetLevel = (http, _, _) =>
        http.Request.Path.StartsWithSegments("/health")
        || http.Request.Path.StartsWithSegments("/readyz")
        || http.Request.Path.StartsWithSegments("/metrics")
            ? LogEventLevel.Verbose
            : LogEventLevel.Information);
```

---

## OpenTelemetry (Traces, Metrics, Logs) (MANDATORY)

**HARD GATE:** All services MUST emit distributed traces and metrics via the OpenTelemetry .NET SDK,
exported over OTLP. Auto-instrumentation covers ASP.NET Core, `HttpClient`, and EF Core; service and
repository methods add their own `Activity` spans.

### Required NuGet Packages

```xml
<PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.9.0" />
<PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.9.0" />
<PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.9.0" />
<PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.9.0" />
<PackageReference Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" Version="1.0.0-beta.12" />
```

### Bootstrap Extension

```csharp
public static class ObservabilityModule
{
    public const string ActivitySourceName = "YourService.Application";
    public const string MeterName = "YourService.Application";

    public static WebApplicationBuilder AddOpenTelemetryObservability(this WebApplicationBuilder builder)
    {
        var serviceName = builder.Configuration["Telemetry:ServiceName"] ?? "your-service";
        var serviceVersion = builder.Configuration["Telemetry:ServiceVersion"] ?? "0.0.0";

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(serviceName, serviceVersion: serviceVersion))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddEntityFrameworkCoreInstrumentation()
                .AddSource(ActivitySourceName)
                .AddOtlpExporter())
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddMeter(MeterName)
                .AddOtlpExporter());

        // Route ILogger records through OpenTelemetry (logs signal)
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeScopes = true;
            logging.AddOtlpExporter();
        });

        return builder;
    }
}
```

The OTLP endpoint is read from the standard `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable.

### Instrumenting Service Methods (MANDATORY)

Every service and complex repository method MUST create a child `Activity`. Classify errors: business
errors are events (span stays OK); technical errors set span status to `Error`.

```csharp
public sealed class UserService : IUserService
{
    private static readonly ActivitySource ActivitySource = new(ObservabilityModule.ActivitySourceName);
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
        using var activity = ActivitySource.StartActivity("service.user.create");
        activity?.SetTag("user.email_domain", request.Email.Split('@').LastOrDefault());

        _logger.LogInformation("Creating user {Email}", request.Email);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            // Business error: expected, span stays OK
            activity?.AddEvent(new ActivityEvent("validation_failed"));
            return AppError.Validation("Name is required");
        }

        var result = await _repository.CreateAsync(request.ToEntity(), ct); // propagate ct
        if (result.IsFailure)
        {
            // Technical error: unexpected, mark span Error
            activity?.SetStatus(ActivityStatusCode.Error, "repository create failed");
            _logger.LogError("Failed to create user {Email}", request.Email);
            return result.Error;
        }

        return UserResponse.FromEntity(result.Value);
    }
}
```

### ActivitySource Naming

| Layer | Pattern | Example |
|-------|---------|---------|
| Endpoint | `handler.{resource}.{action}` | `handler.user.create` |
| Service | `service.{domain}.{operation}` | `service.user.create` |
| Repository | `repository.{entity}.{operation}` | `repository.user.get_by_id` |
| Consumer | `consumer.{queue}.{operation}` | `consumer.balance_create.process` |

### Instrumentation Checklist (all REQUIRED per method)

| # | Requirement |
|---|-------------|
| 1 | `using var activity = ActivitySource.StartActivity("layer.domain.op")` |
| 2 | `ILogger<T>` message-template logging (no `Console.Write`) |
| 3 | Business error -> `AddEvent`; technical error -> `SetStatus(Error)` |
| 4 | `CancellationToken` propagated to every downstream async call |

### Anti-Patterns (FORBIDDEN)

| Anti-Pattern | Correct |
|--------------|---------|
| No `ActivitySource` in a service | One `static ActivitySource` per class |
| Missing `using` on the Activity | `using var activity = ...` (disposes span) |
| `Console.WriteLine` for logging | `ILogger<T>` from DI |
| Dropping `CancellationToken` | Pass it through all async calls |
| No OTLP exporter | Configure `AddOtlpExporter()` in bootstrap |

---

## Health Checks (MANDATORY)

**HARD GATE:** All services MUST expose both a liveness endpoint (`/health`) and a readiness endpoint
(`/readyz`). Liveness checks only that the process is responsive; readiness checks that dependencies
are reachable.

| Endpoint | Purpose | Returns 503 When | Kubernetes Probe |
|----------|---------|------------------|------------------|
| `/health` | Liveness | Process is deadlocked/unresponsive | `livenessProbe` — restarts pod |
| `/readyz` | Readiness | Any tagged dependency is down | `readinessProbe` — removes from service |

### Registration & Mapping

```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>(name: "postgres", tags: ["ready"])
    .AddRedis(builder.Configuration.GetConnectionString("Redis")!, name: "redis", tags: ["ready"]);

// Liveness: no dependency checks — just "is the process alive"
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });

// Readiness: run only checks tagged "ready"
app.MapHealthChecks("/readyz", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /readyz, port: 8080 }
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "/health is enough" | It doesn't check dependencies; unready pods get traffic. | **Add /readyz with dependency checks** |
| "Dependencies are always up" | Networks partition; DBs fail over. | **Check dependencies in /readyz** |
| "K8s checks the TCP port" | An open port ≠ a ready app. | **Add HTTP readiness checks** |

---

## Connection Management (MANDATORY)

**HARD GATE:** Every external connection (database, Redis, HTTP, message broker) MUST have explicit
pooling, timeouts, and resiliency. Defaults are not sufficient for production.

### Database (EF Core / Npgsql)

```csharp
services.AddDbContext<AppDbContext>((sp, options) =>
{
    var db = sp.GetRequiredService<IOptions<DatabaseOptions>>().Value;
    var connectionString = new NpgsqlConnectionStringBuilder
    {
        Host = db.Host, Port = db.Port, Database = db.Name,
        MaxPoolSize = db.MaxPoolSize, MinPoolSize = 5,
        Timeout = 15, CommandTimeout = 30
    }.ConnectionString;

    options.UseNpgsql(connectionString, npgsql =>
        npgsql.EnableRetryOnFailure(maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null));
});
```

### HTTP Clients (IHttpClientFactory + Polly)

```csharp
services.AddHttpClient<IPaymentClient, PaymentClient>(client =>
    {
        client.BaseAddress = new Uri(configuration["Payment:BaseUrl"]!);
        client.Timeout = TimeSpan.FromSeconds(30);
    })
    .AddStandardResilienceHandler(); // Microsoft.Extensions.Http.Resilience: retry + circuit breaker + timeout
```

> Never instantiate `new HttpClient()` per request — it exhausts sockets. Always resolve via
> `IHttpClientFactory` / typed clients.

### Redis

```csharp
services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var options = ConfigurationOptions.Parse(configuration.GetConnectionString("Redis")!);
    options.ConnectTimeout = 5000;
    options.AbortOnConnectFail = false; // Keep retrying rather than throwing at startup
    return ConnectionMultiplexer.Connect(options);
});
```

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: HttpClient with no timeout (can hang forever)
var client = new HttpClient();

// FORBIDDEN: New client per request (socket exhaustion)
public async Task Get() { using var c = new HttpClient(); /* ... */ }

// FORBIDDEN: DbContext with no retry/timeout config in production
options.UseNpgsql(connectionString); // relies on defaults
```

---

## Graceful Shutdown (MANDATORY)

**HARD GATE:** All services MUST shut down gracefully. On `SIGTERM` (Kubernetes) or `SIGINT` (Ctrl+C),
the host MUST stop accepting new requests, drain in-flight requests, flush telemetry, and close
connections before exiting.

The generic host does most of this automatically when you use `app.Run()`. Your responsibilities:

### 1. Respect the Shutdown Timeout

```csharp
builder.Services.Configure<HostOptions>(options =>
    options.ShutdownTimeout = TimeSpan.FromSeconds(30)); // Allow in-flight requests to drain
```

### 2. Honor CancellationToken in Background Work

`BackgroundService` receives a stopping token — long-running loops MUST observe it.

```csharp
public sealed class BalanceWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessBatchAsync(stoppingToken); // Propagate the token; do not swallow OperationCanceledException
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
```

### 3. Release Resources on Stop

Implement `IAsyncDisposable` / register cleanup with `IHostApplicationLifetime.ApplicationStopping`
for anything the container won't dispose automatically (e.g. a broker connection).

```csharp
lifetime.ApplicationStopping.Register(() => _logger.LogInformation("Draining, stopping consumers"));
```

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: Environment.Exit — skips draining, disposal, telemetry flush
Environment.Exit(1);

// FORBIDDEN: Thread.Sleep in async workers (blocks the thread, ignores cancellation)
Thread.Sleep(5000); // use await Task.Delay(..., stoppingToken)

// FORBIDDEN: Swallowing cancellation as if it were an error
catch (OperationCanceledException) { _logger.LogError("failed"); } // it's a normal shutdown signal
```

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "K8s restarts pods anyway" | Restart ≠ graceful; in-flight requests fail. | **Drain on shutdown** |
| "Requests are fast" | DB transactions and telemetry flush still need time. | **Set ShutdownTimeout, honor tokens** |
| "The host handles it" | Only if you propagate `CancellationToken` and avoid `Environment.Exit`. | **Verify your worker code** |

---

## Checklist

Before submitting bootstrap/observability code, verify:

- [ ] `Program.cs` follows the mandated order (config → logging → telemetry → infra → app → HTTP → pipeline → endpoints)
- [ ] All config is typed Options with `ValidateOnStart()`
- [ ] DI registered via per-layer extension methods; no service locator; no captive dependencies
- [ ] Logging uses `ILogger<T>` message templates; no `Console.Write`; probes excluded from request logging
- [ ] OpenTelemetry traces + metrics + logs exported over OTLP; service methods create `Activity` spans
- [ ] Every service/repository method propagates `CancellationToken`
- [ ] `/health` (liveness) and `/readyz` (readiness with dependency checks) both mapped
- [ ] Connections pooled with timeouts; HTTP via `IHttpClientFactory` with resilience
- [ ] Graceful shutdown: `ShutdownTimeout` set, stopping token honored, no `Environment.Exit`
