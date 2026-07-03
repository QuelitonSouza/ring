# C# Standards - Security

> **Module:** security.md | **Parent:** [index.md](index.md)

This module covers authentication, authorization, secret protection, input safety, and the
web-security controls every ASP.NET Core service MUST ship: JWT/OIDC bearer auth, the built-in
.NET rate limiter, CORS, security headers, and Data Protection.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards. Ring
> standards are the baseline; `PROJECT_RULES.md` may add rules but must not weaken these.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Authentication (JWT Bearer / OIDC)](#authentication-jwt-bearer--oidc-mandatory) | Token validation, OIDC discovery, JWKS |
| 2 | [Authorization (Policies & Roles)](#authorization-policies--roles-mandatory) | Policy-based authz, scopes, RBAC |
| 3 | [Secret Management](#secret-management-mandatory) | User Secrets, Key Vault, no secrets in config/logs |
| 4 | [Secret Redaction in Logs](#secret-redaction-in-logs-mandatory) | Preventing credential leaks |
| 5 | [SQL Safety](#sql-safety-mandatory) | Parameterized queries, injection prevention |
| 6 | [Input Validation](#input-validation-mandatory) | Model validation, over-posting, OWASP |
| 7 | [Security Headers](#security-headers-mandatory) | HSTS, nosniff, frame options, CSP |
| 8 | [Rate Limiting](#rate-limiting-mandatory) | Built-in .NET rate limiter, forwarded headers |
| 9 | [CORS Configuration](#cors-configuration-mandatory) | Named policies, no wildcard in production |
| 10 | [Data Protection](#data-protection-mandatory) | Key ring persistence for multi-instance |

---

## Authentication (JWT Bearer / OIDC) (MANDATORY)

All non-public HTTP endpoints **MUST** authenticate callers. The standard mechanism is JWT bearer
tokens validated against an OpenID Connect (OIDC) authority. Use
`Microsoft.AspNetCore.Authentication.JwtBearer` — do not hand-roll token parsing.

### Required NuGet Package

```xml
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
```

### Options

```csharp
// Configuration/JwtOptions.cs
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Authority { get; init; } = string.Empty;   // OIDC issuer, e.g. https://login.example.com
    public string Audience { get; init; } = string.Empty;    // This API's audience/client id
    public bool RequireHttpsMetadata { get; init; } = true;  // MUST be true in production
}
```

### Registration (Program.cs)

```csharp
builder.Services.Configure<JwtOptions>(
    builder.Configuration.GetSection(JwtOptions.SectionName));

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()!;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // OIDC discovery: keys are fetched from {Authority}/.well-known/openid-configuration
        // and rotated automatically. Never pin a static signing key.
        options.Authority = jwt.Authority;
        options.Audience = jwt.Audience;
        options.RequireHttpsMetadata = jwt.RequireHttpsMetadata;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30) // Tighten default 5-minute skew
        };
    });
```

### Middleware Pipeline

```csharp
app.UseAuthentication(); // MUST come before UseAuthorization
app.UseAuthorization();
```

### Behavior

| Scenario | HTTP Response |
|----------|---------------|
| Missing `Authorization` header on protected route | `401 Unauthorized` |
| Token expired or signature invalid | `401 Unauthorized` |
| Token valid but caller lacks required policy | `403 Forbidden` |
| Token valid and authorized | Endpoint executes |

### What not to Do

```csharp
// FORBIDDEN: Hardcoded / static signing key (breaks key rotation, secret in source)
options.TokenValidationParameters.IssuerSigningKey =
    new SymmetricSecurityKey(Encoding.UTF8.GetBytes("hardcoded-secret")); // NEVER

// FORBIDDEN: Disabling issuer/audience/lifetime validation
options.TokenValidationParameters.ValidateIssuer = false;   // NEVER
options.TokenValidationParameters.ValidateLifetime = false; // NEVER

// FORBIDDEN: RequireHttpsMetadata = false in production (allows MITM on discovery)
options.RequireHttpsMetadata = false; // Dev-only, gate behind IsDevelopment()

// FORBIDDEN: Manually parsing the JWT from the header
var token = context.Request.Headers.Authorization.ToString().Split(' ')[1]; // Use JwtBearer

// CORRECT: Configure Authority + Audience and let JwtBearer validate.
```

---

## Authorization (Policies & Roles) (MANDATORY)

Authentication proves *who* the caller is; authorization proves *what* they may do. Use
**policy-based authorization** — avoid scattering role string literals through the codebase.

### Define Policies

```csharp
// Program.cs
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("resources:read", policy =>
        policy.RequireAuthenticatedUser()
              .RequireClaim("scope", "resources.read"))
    .AddPolicy("resources:write", policy =>
        policy.RequireAuthenticatedUser()
              .RequireClaim("scope", "resources.write"))
    .AddPolicy("admin", policy =>
        policy.RequireRole("admin"));
```

### Apply on Endpoints

#### Minimal APIs

```csharp
app.MapGet("/v1/resources", GetResources)
    .RequireAuthorization("resources:read");

app.MapPost("/v1/resources", CreateResource)
    .RequireAuthorization("resources:write");

// Public endpoints MUST be explicit
app.MapGet("/health", () => Results.Ok()).AllowAnonymous();
```

#### Controllers

```csharp
[ApiController]
[Route("v1/[controller]")]
[Authorize] // Secure by default for the whole controller
public class ResourcesController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "resources:read")]
    public Task<IActionResult> List(CancellationToken ct) => /* ... */;

    [HttpPost]
    [Authorize(Policy = "resources:write")]
    public Task<IActionResult> Create(CreateRequest request, CancellationToken ct) => /* ... */;
}
```

### Policy Naming (RBAC Convention)

Policy names **MUST** match the stable public route collection, in `resource:action` form. Use the
plural collection name for collection routes.

| Route family | Policy | Reason |
|--------------|--------|--------|
| `/v1/payments`, `/v1/payments/{id}` | `payments:read` / `payments:write` | Collection resource |
| `/v1/boletos`, `/v1/boletos/{id}` | `boletos:read` / `boletos:write` | Collection resource |
| `/v1/admin/...` | `admin` | Singleton namespace |

**Forbidden:** protecting `POST /v1/payments` with a singular policy like `payment:write`.

### Multi-Tenant Authorization

For multi-tenant services, resolve the tenant from a validated token claim (or a validated
`X-Organization-Id` header) and enforce it in a requirement handler — never trust an unvalidated
header for isolation decisions.

```csharp
// Custom requirement: caller's token must carry the tenant they are acting on.
public sealed class SameTenantHandler : AuthorizationHandler<SameTenantRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, SameTenantRequirement requirement)
    {
        var tenantClaim = context.User.FindFirst("tenant_id")?.Value;
        if (!string.IsNullOrEmpty(tenantClaim))
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
```

### What not to Do

```csharp
// FORBIDDEN: Endpoint with no authorization on protected data
app.MapPost("/v1/sensitive-data", handler); // Missing RequireAuthorization

// FORBIDDEN: Role checks embedded in business logic
if (user.Role == "admin") { /* ... */ } // Use [Authorize(Policy=...)] / RequireAuthorization

// FORBIDDEN: Trusting an unvalidated header for tenant isolation
var tenant = Request.Headers["X-Organization-Id"]; // Validate against token claim first
```

---

## Secret Management (MANDATORY)

**HARD GATE:** Secrets (connection strings, API keys, client secrets, signing keys) MUST NOT be
committed to source control, `appsettings.json`, or any file that ships with the build.

### Secret Sources by Environment

| Environment | Secret Source | Mechanism |
|-------------|---------------|-----------|
| Local development | .NET User Secrets | `dotnet user-secrets set "Jwt:ClientSecret" "..."` |
| CI / staging / production | Environment variables or a secrets manager | Azure Key Vault, AWS Secrets Manager, env vars |
| Kubernetes | Mounted secret or CSI driver | Injected as env vars or files |

### User Secrets (Development)

```bash
# One-time per project
dotnet user-secrets init

# Set a secret (stored outside the repo, in the user profile)
dotnet user-secrets set "ConnectionStrings:Primary" "Host=localhost;Username=app;Password=dev"
```

User Secrets are loaded automatically by `WebApplication.CreateBuilder` **only** in the
`Development` environment.

### Azure Key Vault (Production)

```xml
<PackageReference Include="Azure.Extensions.AspNetCore.Configuration.Secrets" Version="1.3.0" />
<PackageReference Include="Azure.Identity" Version="1.11.0" />
```

```csharp
// Program.cs — layer Key Vault into IConfiguration outside development
if (!builder.Environment.IsDevelopment())
{
    var vaultUri = builder.Configuration["KeyVault:Uri"]
        ?? throw new InvalidOperationException("KeyVault:Uri is required outside development");

    // DefaultAzureCredential uses managed identity in Azure, no secret needed.
    builder.Configuration.AddAzureKeyVault(new Uri(vaultUri), new DefaultAzureCredential());
}
```

Secrets are then consumed exactly like any other configuration value via the Options pattern —
consuming code never knows where the value came from.

### What not to Do

```csharp
// FORBIDDEN: Secret literal in appsettings.json committed to the repo
// "ConnectionStrings": { "Primary": "Host=db;Password=SuperSecret123" }

// FORBIDDEN: Reading secrets with Environment.GetEnvironmentVariable scattered in code
var key = Environment.GetEnvironmentVariable("API_KEY"); // Bind via Options instead

// FORBIDDEN: Committing a .env file or user secrets file

// CORRECT: appsettings has the key name only; the value comes from env/Key Vault/User Secrets
// and is bound through IOptions<T>.
```

---

## Secret Redaction in Logs (MANDATORY)

**HARD GATE:** Credentials, connection strings, tokens, and PII MUST NOT appear in logs. Logs are
stored, aggregated, and shared — a secret in a log is a leaked secret.

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: Logging connection strings
_logger.LogInformation("Connecting to {Conn}", connectionString); // Exposes Password=...

// FORBIDDEN: Logging the whole options/config object
_logger.LogInformation("Config: {@Config}", options); // Serializes every field, incl. secrets

// FORBIDDEN: Logging the Authorization header
_logger.LogInformation("Headers: {Headers}", Request.Headers); // Exposes Bearer token

// FORBIDDEN: Logging credentials or PII directly
_logger.LogInformation("Login {Password}", password); // NEVER
_logger.LogInformation("Card {CardNumber}", card);    // NEVER
_logger.LogInformation("Doc {Cpf}", cpf);             // NEVER (PII)
```

### Correct Patterns

```csharp
// CORRECT: Log only safe, structured fields
_logger.LogInformation("Connecting to database {Host}:{Port}/{Database}",
    options.Host, options.Port, options.Name);

// CORRECT: Redact a connection string before logging (rare — prefer logging discrete fields)
static string Redact(string connectionString)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString) { Password = "***" };
    return builder.ConnectionString;
}
```

### Secrets that MUST NOT be Logged

| Secret Type | Example |
|-------------|---------|
| Postgres / SQL connection string | `Host=...;Password=...` |
| MongoDB / Redis URI | `mongodb://user:pass@host` |
| Bearer / JWT tokens | `Authorization: Bearer eyJ...` |
| API keys | `sk_live_...`, `api_key=...` |
| Cloud credentials | `AKIA...`, client secrets |
| PII | CPF, card numbers, email/password |

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "We need it to debug" | Logs leak to Seq, App Insights, files. | **Log discrete safe fields only** |
| "Only devs see logs" | Logs go to centralized, broadly-accessible systems. | **Redact all secrets** |
| "It's just dev" | Dev habits reach prod; same code. | **Redact everywhere** |
| "Serilog destructuring is convenient" | `{@obj}` serializes secret fields too. | **Never destructure secret-bearing objects** |

---

## SQL Safety (MANDATORY)

**HARD GATE:** All database access MUST use parameterized queries. String concatenation or
interpolation into SQL is FORBIDDEN and creates injection vulnerabilities. EF Core LINQ is
parameterized automatically; raw SQL requires explicit parameters.

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: String concatenation / interpolation into raw SQL
var sql = "SELECT * FROM users WHERE email = '" + email + "'";
var rows = await conn.QueryAsync<User>($"SELECT * FROM users WHERE id = {userId}"); // Dapper injected

// FORBIDDEN: FromSqlRaw with an interpolated string (bypasses parameterization)
var users = _db.Users.FromSqlRaw($"SELECT * FROM users WHERE role = '{role}'").ToList();
```

### Correct Patterns

```csharp
// CORRECT: EF Core LINQ — parameterized by the provider
var user = await _db.Users
    .Where(u => u.Email == email)
    .FirstOrDefaultAsync(ct);

// CORRECT: EF Core FromSql (interpolated form is safe — it parameterizes each hole)
var byRole = await _db.Users
    .FromSql($"SELECT * FROM users WHERE role = {role}")
    .ToListAsync(ct);

// CORRECT: EF Core FromSqlRaw with explicit parameters
var byRoleRaw = await _db.Users
    .FromSqlRaw("SELECT * FROM users WHERE role = {0}", role)
    .ToListAsync(ct);

// CORRECT: Dapper with anonymous-object parameters
var found = await conn.QueryAsync<User>(
    "SELECT * FROM users WHERE id = @Id AND status = @Status",
    new { Id = userId, Status = status });
```

> **Note:** EF Core `FromSql` (the *interpolated* method) is safe because it converts each `{hole}`
> into a `DbParameter`. The dangerous method is `FromSqlRaw` when passed a pre-built interpolated
> string. Never build the string yourself.

### Dynamic Identifiers (Whitelist)

When a column or sort direction must be dynamic, validate against an explicit whitelist — you cannot
parameterize identifiers.

```csharp
static readonly HashSet<string> AllowedSortColumns = new(StringComparer.Ordinal)
{
    "created_at", "name", "email"
};

var column = AllowedSortColumns.Contains(request.SortBy) ? request.SortBy : "created_at";
var direction = request.Descending ? "DESC" : "ASC";
// column/direction are now safe (from whitelist); all values remain parameters.
```

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "It's an internal service" | Internal callers can be compromised. | **Always parameterize** |
| "The value is a Guid/int" | Type coercion can fail; assume hostile input. | **Always parameterize** |
| "Interpolation reads cleaner" | Readability never outweighs injection risk. | **Use parameters** |
| "It's just a read" | Injection enables exfiltration, not just writes. | **Always parameterize** |

---

## Input Validation (MANDATORY)

**HARD GATE:** Never trust request input. Validate DTOs at the boundary and construct always-valid
domain objects (see [domain.md](domain.md#always-valid-domain-model-mandatory)).

### DataAnnotations on Request DTOs

```csharp
public sealed record CreateUserRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Range(0, 150)]
    public int Age { get; init; }
}
```

For Minimal APIs, enable automatic validation (or validate explicitly in the handler and return
`Results.ValidationProblem`). For Controllers, `[ApiController]` triggers automatic
`400 ValidationProblem` responses on invalid model state.

### Prevent Over-Posting (Mass Assignment)

Bind to a purpose-built request DTO, never directly to a domain entity or EF model. This prevents a
caller from setting fields like `IsAdmin`, `Balance`, or `Id` that are not part of the contract.

```csharp
// FORBIDDEN: Binding straight to the entity — caller can set any property
app.MapPost("/v1/users", (User user) => /* ... */); // Over-posting risk

// CORRECT: Bind to a DTO with only the allowed fields
app.MapPost("/v1/users", (CreateUserRequest request) => /* ... */);
```

### Body Size Limits

Cap request body size to prevent memory-exhaustion DoS.

```csharp
builder.WebHost.ConfigureKestrel(options =>
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024); // 10 MB default; tune per endpoint
```

### OWASP Alignment

| OWASP Risk | Control in This Module |
|------------|------------------------|
| A01 Broken Access Control | [Authorization](#authorization-policies--roles-mandatory) policies, tenant handler |
| A02 Cryptographic Failures | [Secret Management](#secret-management-mandatory), HTTPS/HSTS |
| A03 Injection | [SQL Safety](#sql-safety-mandatory), parameterized queries, input validation |
| A05 Security Misconfiguration | [Security Headers](#security-headers-mandatory), [CORS](#cors-configuration-mandatory) |
| A07 Auth Failures | [Authentication](#authentication-jwt-bearer--oidc-mandatory), token validation |
| A09 Logging Failures | [Secret Redaction](#secret-redaction-in-logs-mandatory), structured logging |

---

## Security Headers (MANDATORY)

**HARD GATE:** All HTTP services MUST set security response headers to defend against MIME sniffing,
clickjacking, and protocol downgrade. Enable HSTS and HTTPS redirection in production.

### Implementation

```csharp
// Program.cs
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();              // Strict-Transport-Security
    app.UseHttpsRedirection();  // Upgrade http -> https
}

// Minimal middleware for the remaining headers
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    // Tighten CSP for any HTML surface; APIs can use a restrictive default.
    headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});
```

### Required Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | via `UseHsts()` | Forces HTTPS on subsequent requests |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Content-Security-Policy` | restrictive default | Limits resource loading |

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "We're behind a proxy" | Defense in depth; the app must protect itself. | **Set headers in the app** |
| "It's a JSON API" | MIME sniffing and downgrade affect APIs too. | **Set headers** |
| "HSTS is risky" | Only if HTTPS is misconfigured; fix that, then enable. | **Enable HSTS in production** |

---

## Rate Limiting (MANDATORY)

**HARD GATE:** All public APIs MUST implement rate limiting to prevent abuse and DoS. Use the
built-in .NET rate limiter (`Microsoft.AspNetCore.RateLimiting`, GA since .NET 7). Do not add a
third-party limiter unless a distributed algorithm the built-in one lacks is required.

### Forwarded Headers (Prerequisite Behind a Proxy)

When deployed behind a reverse proxy or load balancer, configure Forwarded Headers **before** the
rate limiter so partition keys use the real client IP, not the proxy IP.

```csharp
// Program.cs — configure BEFORE app.Build() consumers
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // SECURITY: restrict to known proxies. An empty KnownProxies/KnownNetworks with
    // ForwardedHeaders enabled lets any client spoof X-Forwarded-For.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
    foreach (var proxy in builder.Configuration.GetSection("TrustedProxies").Get<string[]>() ?? [])
    {
        options.KnownProxies.Add(IPAddress.Parse(proxy));
    }
});

// First middleware in the pipeline
app.UseForwardedHeaders();
```

### Tiered Policies

Define named policies keyed by the authenticated user (falling back to client IP) so users are
limited individually rather than as a single shared pool.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // On rejection, expose Retry-After
    options.OnRejected = async (context, ct) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        }
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { code = "429", title = "rate_limit_exceeded", message = "rate limit exceeded" }, ct);
    };

    // Global tier: all endpoints
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: PartitionKey(context),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromSeconds(60),
                QueueLimit = 0
            }));

    // Export tier: stricter, for resource-intensive endpoints
    options.AddPolicy("export", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: "export:" + PartitionKey(context),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromSeconds(60),
                QueueLimit = 0
            }));

    static string PartitionKey(HttpContext context) =>
        context.User.FindFirst("sub")?.Value                    // authenticated user
        ?? context.Connection.RemoteIpAddress?.ToString()       // fallback: client IP
        ?? "anonymous";
});
```

### Pipeline & Endpoint Wiring

```csharp
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter(); // AFTER auth so the user claim is available for partitioning

app.MapPost("/v1/reports/export", ExportReport)
    .RequireAuthorization("reports:read")
    .RequireRateLimiting("export"); // Apply the stricter tier
```

### Distributed Deployments

The built-in limiter is per-instance. For a truly global limit across replicas, back the partition
with a distributed store (e.g. Redis via a custom `RateLimiter`) — a per-instance limit is
acceptable when replicas are few and limits are generous, but document the choice.

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: No rate limiting on public endpoints
app.MapControllers(); // with no UseRateLimiter / RequireRateLimiting anywhere

// FORBIDDEN: Partitioning only by IP for authenticated APIs (NAT/VPN users share a limit)
partitionKey: context.Connection.RemoteIpAddress?.ToString()

// FORBIDDEN: Enabling ForwardedHeaders without restricting KnownProxies (spoofable client IP)
options.ForwardedHeaders = ForwardedHeaders.XForwardedFor; // with empty KnownProxies

// FORBIDDEN: Rate limiter before authentication (no user claim for the partition key)
app.UseRateLimiter();
app.UseAuthentication();
```

### Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "The load balancer rate-limits" | App-level limits protect per-user fairness. | **Add app-level limiting** |
| "We don't need it yet" | By the time you do, you're under attack. | **Add before production** |
| "IP limiting is enough" | Users behind NAT/VPN share IPs. | **Partition by user, fall back to IP** |

---

## CORS Configuration (MANDATORY)

**HARD GATE:** All services consumed by browsers MUST configure CORS with an explicit origin
allow-list. Wildcard origins (`*`) are FORBIDDEN in production, and are incompatible with credentialed
requests.

### Options & Named Policy

```csharp
// Configuration/CorsOptions.cs
public sealed class CorsOptions
{
    public const string SectionName = "Cors";
    public string[] AllowedOrigins { get; init; } = [];
}
```

```csharp
// Program.cs
const string CorsPolicy = "DefaultCors";
var cors = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new();

// Production validation: no empty and no wildcard origins
if (!builder.Environment.IsDevelopment())
{
    if (cors.AllowedOrigins.Length == 0)
        throw new InvalidOperationException("Cors:AllowedOrigins must be set in production");
    if (cors.AllowedOrigins.Contains("*"))
        throw new InvalidOperationException("Cors:AllowedOrigins must not contain '*' in production");
}

builder.Services.AddCors(options =>
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(cors.AllowedOrigins)
              .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
              .WithHeaders("Origin", "Content-Type", "Accept", "Authorization", "X-Request-Id")));

// Pipeline: CORS must run before auth so preflight (OPTIONS) succeeds
app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
```

### Production Rules

| Rule | Enforcement |
|------|-------------|
| No wildcard origins | `*` forbidden; list explicit origins |
| No empty origins | At least one origin required |
| HTTPS origins in production | `http://` origins are development-only |
| Credentialed requests | `AllowCredentials()` requires explicit origins (never `*`) |

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: Allow-any origin
policy.AllowAnyOrigin(); // Effectively a wildcard

// FORBIDDEN: Allow-any origin combined with credentials (throws / insecure)
policy.SetIsOriginAllowed(_ => true).AllowCredentials();

// FORBIDDEN: Hardcoded origins in code
policy.WithOrigins("https://app.example.com"); // Use configuration

// CORRECT: Origins bound from configuration, validated for production.
```

---

## Data Protection (MANDATORY)

**HARD GATE:** Services that run more than one instance MUST persist and (where required) protect the
ASP.NET Core Data Protection key ring. Otherwise each instance generates its own keys, breaking
antiforgery tokens, auth cookies, and anything encrypted with `IDataProtector` across instances and
restarts.

### When It Matters

| Feature relying on Data Protection | Breaks without a shared key ring |
|------------------------------------|----------------------------------|
| Auth cookies | Users logged out on instance switch/restart |
| Antiforgery tokens | Random `400` on form posts |
| `IDataProtector`-encrypted payloads | Cannot decrypt across instances |
| TempData (cookie provider) | Data lost between requests |

> **Note:** A pure JWT-bearer API that never uses cookies, antiforgery, or `IDataProtector` has no
> shared-key-ring requirement. State the assessment explicitly rather than skipping silently.

### Persist the Key Ring

```xml
<PackageReference Include="Azure.Extensions.AspNetCore.DataProtection.Blobs" Version="1.3.0" />
<PackageReference Include="Azure.Extensions.AspNetCore.DataProtection.Keys" Version="1.2.0" />
```

```csharp
// Program.cs — persist keys to shared storage and protect them at rest
builder.Services.AddDataProtection()
    .SetApplicationName("your-service")                                // Stable across instances
    .PersistKeysToAzureBlobStorage(new Uri(builder.Configuration["DataProtection:BlobUri"]!),
        new DefaultAzureCredential())
    .ProtectKeysWithAzureKeyVault(new Uri(builder.Configuration["DataProtection:KeyVaultKeyUri"]!),
        new DefaultAzureCredential());
```

For non-Azure hosting, persist to a shared volume or Redis
(`PersistKeysToFileSystem` on a shared mount, or `PersistKeysToStackExchangeRedis`) and protect at
rest with an available KMS.

### What not to Do

```csharp
// FORBIDDEN: Default ephemeral key ring in a multi-instance deployment
builder.Services.AddDataProtection(); // Keys stored per-instance in memory/local profile

// FORBIDDEN: Different ApplicationName per instance (keys won't be shared)
.SetApplicationName(Environment.MachineName)

// CORRECT: Stable ApplicationName + persisted, protected key ring.
```

---

## Checklist

Before submitting security-relevant C# code, verify:

- [ ] All protected endpoints require authentication and an explicit authorization policy
- [ ] JWT bearer configured with `Authority` + `Audience`; issuer/audience/lifetime validated
- [ ] `RequireHttpsMetadata = true` outside development
- [ ] No secrets in `appsettings.json` or source; secrets come from User Secrets / Key Vault / env
- [ ] No secrets, tokens, or PII logged; no `{@config}` destructuring of secret-bearing objects
- [ ] All raw SQL is parameterized; whitelist used for any dynamic identifier
- [ ] Request DTOs validated; binding is to DTOs, not entities (no over-posting)
- [ ] Security headers set; HSTS + HTTPS redirection enabled in production
- [ ] Rate limiting enabled; partitioned by user with IP fallback; Forwarded Headers restricted to known proxies
- [ ] CORS uses an explicit, configured origin allow-list; no wildcard in production
- [ ] Data Protection key ring persisted + protected for multi-instance (or documented as not required)
