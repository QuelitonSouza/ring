# C# Standards - Multi-Tenant

> **Module:** multi-tenant.md | **Parent:** [index.md](index.md)

This module covers multi-tenancy for .NET services: tenant resolution middleware, the
ambient tenant context, EF Core global query filters, per-tenant connection strings, and
tenant propagation through caching and messaging.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards, and
> [../csharp.md](../csharp.md) for the Result pattern, OpenTelemetry, Serilog, and
> `CancellationToken` conventions used below.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [When to Use Multi-Tenancy (CONDITIONAL)](#when-to-use-multi-tenancy-conditional) | Deciding if multi-tenancy applies |
| 2 | [Isolation Strategies](#isolation-strategies) | Database-per-tenant, schema-per-tenant, shared-DB row-level |
| 3 | [Tenant Context](#tenant-context) | The ambient ITenantContext abstraction |
| 4 | [Tenant Resolution Middleware (MANDATORY)](#tenant-resolution-middleware-mandatory) | Resolving the tenant per request |
| 5 | [Auth-Before-Tenant Ordering (MANDATORY)](#auth-before-tenant-ordering-mandatory) | Authenticate before trusting the tenant claim |
| 6 | [EF Core Global Query Filters](#ef-core-global-query-filters) | Row-level isolation in a shared database |
| 7 | [Per-Tenant Connection Strings](#per-tenant-connection-strings) | Database/schema-per-tenant routing |
| 8 | [Tenant-Aware Caching](#tenant-aware-caching) | Prefixing cache keys with the tenant |
| 9 | [Tenant Propagation in Messaging](#tenant-propagation-in-messaging) | Carrying the tenant across the bus |
| 10 | [Anti-Rationalization Table](#anti-rationalization-table) | Common excuses and required actions |
| 11 | [Checklist](#checklist) | Pre-submission verification |

---

## When to Use Multi-Tenancy (CONDITIONAL)

**CONDITIONAL:** implement only when the service hosts data for multiple isolated
customers (tenants) on shared infrastructure.

| Scenario | Multi-Tenant? |
|----------|---------------|
| Single-customer deployment | No — skip this module |
| SaaS with shared infrastructure | Yes |
| Regulated data requiring physical DB separation per customer | Yes (database-per-tenant) |

**HARD GATE — the tenant identifier is the ONLY isolation mechanism.** A per-request
`tenantId` (from the JWT, host, or header) selects the tenant's data. A domain field such
as `organizationId` is **not** tenant isolation — it does not route to a different
database or filter across tenants. Isolation comes exclusively from
`tenantId → ITenantContext → connection/filter`.

Choosing an isolation strategy is an architectural decision — **STOP and confirm with the
requester** if it is not already fixed in `PROJECT_RULES.md`.

---

## Isolation Strategies

| Strategy | Storage | Isolation | Cost | Use When |
|----------|---------|-----------|------|----------|
| **Database-per-tenant** | One database per tenant | Strongest (physical) | Highest | Regulated data; noisy-neighbor concerns; per-tenant backup/restore |
| **Schema-per-tenant** | Shared DB, one schema per tenant | Strong (logical) | Medium | Moderate isolation with fewer databases |
| **Shared DB, row-level** | Shared tables + `TenantId` column | Weakest (query-enforced) | Lowest | Many small tenants; cost-optimized |

Row-level isolation relies on [EF Core global query filters](#ef-core-global-query-filters).
Database-/schema-per-tenant rely on [per-tenant connection strings](#per-tenant-connection-strings).

---

## Tenant Context

Expose the current tenant through a scoped abstraction. Everything downstream (DbContext,
cache, message publishing) reads the tenant from here — never from `HttpContext` directly.

```csharp
public interface ITenantContext
{
    /// <summary>The resolved tenant id, or null before resolution / in tenant-agnostic paths.</summary>
    string? TenantId { get; }

    bool HasTenant => !string.IsNullOrEmpty(TenantId);
}

public interface ITenantContextSetter
{
    void Set(string tenantId);
}

public sealed class TenantContext : ITenantContext, ITenantContextSetter
{
    private string? _tenantId;

    public string? TenantId => _tenantId;

    public void Set(string tenantId)
    {
        if (_tenantId is not null)
        {
            throw new InvalidOperationException("Tenant context is already set for this scope.");
        }

        _tenantId = tenantId;
    }
}
```

```csharp
// Program.cs — one instance per request scope.
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
builder.Services.AddScoped<ITenantContextSetter>(sp => sp.GetRequiredService<TenantContext>());
```

> **Why not `AsyncLocal` directly?** A scoped service is the idiomatic ASP.NET Core
> lifetime and flows naturally through DI. Use `AsyncLocal<T>` only for ambient propagation
> into background work that starts outside a request scope (e.g., a consumer establishing a
> scope from a message header — see [messaging](#tenant-propagation-in-messaging)).

---

## Tenant Resolution Middleware (MANDATORY)

Resolve the tenant once per request in middleware, then populate `ITenantContextSetter`.
Support the resolution strategy your deployment uses — pick one and document it.

| Strategy | Source | Example |
|----------|--------|---------|
| **JWT claim** | `tenantId` claim on the access token | Multi-tenant SaaS behind auth |
| **Host / subdomain** | `{tenant}.app.example.com` | Tenant-per-subdomain |
| **Header** | `X-Tenant-Id` | Service-to-service / internal |

```csharp
public sealed class TenantResolutionMiddleware
{
    private static readonly ActivitySource ActivitySource = new("Svc.MultiTenant");

    private readonly RequestDelegate _next;
    private readonly ILogger<TenantResolutionMiddleware> _logger;

    public TenantResolutionMiddleware(RequestDelegate next, ILogger<TenantResolutionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ITenantContextSetter tenantSetter)
    {
        using var activity = ActivitySource.StartActivity("middleware.tenant_resolution");

        var tenantId = ResolveTenantId(context);
        if (string.IsNullOrEmpty(tenantId))
        {
            activity?.AddEvent(new ActivityEvent("tenant_unresolved"));
            _logger.LogWarning("Tenant could not be resolved for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(
                new { code = "SVC-0001", title = "Tenant not resolved" }, context.RequestAborted);
            return;
        }

        activity?.SetTag("tenant.id", tenantId);
        tenantSetter.Set(tenantId);

        await _next(context);
    }

    // JWT-claim strategy (the claim is trusted only because auth ran first — see next section).
    private static string? ResolveTenantId(HttpContext context) =>
        context.User.FindFirst("tenantId")?.Value;
}
```

**Compliance requirements:**
- MUST resolve exactly one tenant per request and store it in `ITenantContextSetter`.
- MUST reject the request (400/404) when the tenant cannot be resolved on a tenant-scoped
  route.
- MUST create an `ActivitySource.StartActivity` span and tag it with `tenant.id`.

---

## Auth-Before-Tenant Ordering (MANDATORY)

**HARD GATE:** authentication MUST run **before** tenant resolution when the tenant comes
from a token claim. Resolving the tenant from an unvalidated JWT lets a caller forge a
`tenantId` and read another tenant's data.

```csharp
// Program.cs — ORDER IS SECURITY-CRITICAL.
app.UseAuthentication();               // 1. Validate the JWT signature and claims.
app.UseAuthorization();                // 2. Enforce policies.
app.UseMiddleware<TenantResolutionMiddleware>(); // 3. Trust the tenantId claim now.
app.MapControllers();
```

For host- or header-based resolution the tenant is not derived from the token, but auth
MUST still precede any tenant-scoped data access.

---

## EF Core Global Query Filters

For **shared-DB row-level** isolation, add a `TenantId` to every tenant-owned entity and
enforce it with a global query filter so no query can accidentally read across tenants.

```csharp
public interface ITenantOwned
{
    string TenantId { get; }
}

public sealed class AppDbContext : DbContext
{
    private readonly ITenantContext _tenant;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenant)
        : base(options)
    {
        _tenant = tenant;
    }

    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Filter EVERY tenant-owned entity by the ambient tenant.
        modelBuilder.Entity<Product>()
            .HasQueryFilter(p => p.TenantId == _tenant.TenantId);

        // Index the discriminator column for query performance.
        modelBuilder.Entity<Product>().HasIndex(p => p.TenantId);
    }

    // Stamp TenantId on insert so writes cannot land in the wrong tenant.
    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var tenantId = _tenant.TenantId
            ?? throw new InvalidOperationException("Cannot persist without a resolved tenant.");

        foreach (var entry in ChangeTracker.Entries<ITenantOwned>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Property(nameof(ITenantOwned.TenantId)).CurrentValue = tenantId;
            }

            // Never allow reassigning a row to a different tenant.
            if (entry.State == EntityState.Modified &&
                (string?)entry.Property(nameof(ITenantOwned.TenantId)).OriginalValue != tenantId)
            {
                throw new InvalidOperationException("Cross-tenant modification is not permitted.");
            }
        }

        return base.SaveChangesAsync(ct);
    }
}
```

**Compliance requirements:**
- MUST apply `HasQueryFilter` to **every** tenant-owned entity.
- MUST stamp `TenantId` on insert from `ITenantContext` (never from the request body).
- MUST reject writes that would move a row across tenants.
- MUST index the `TenantId` column.
- MUST only use `IgnoreQueryFilters()` in explicitly reviewed, tenant-agnostic admin paths.

---

## Per-Tenant Connection Strings

For **database-per-tenant** or **schema-per-tenant**, resolve the connection string from
the tenant context and configure the `DbContext` per request. Cache the tenant→connection
map (e.g., in `IMemoryCache`) rather than looking it up on every request.

```csharp
public interface ITenantConnectionResolver
{
    /// <summary>Returns the connection string for the current tenant.</summary>
    Task<string> ResolveAsync(string tenantId, CancellationToken ct);
}

// Program.cs — connection string chosen per request from the tenant context.
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var tenant = sp.GetRequiredService<ITenantContext>();
    var resolver = sp.GetRequiredService<ITenantConnectionResolver>();

    var tenantId = tenant.TenantId
        ?? throw new InvalidOperationException("Tenant must be resolved before creating the DbContext.");

    // Resolver is cached; this is a fast lookup, not a per-request round trip.
    var connectionString = resolver.ResolveAsync(tenantId, CancellationToken.None)
        .GetAwaiter().GetResult();

    options.UseNpgsql(connectionString);
});
```

For **schema-per-tenant** on a shared database, keep one connection string and set the
search path per tenant instead:

```csharp
options.UseNpgsql(sharedConnectionString, npgsql =>
    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", schema: tenantSchema));
// and set the schema on OnModelCreating via modelBuilder.HasDefaultSchema(tenantSchema).
```

**Compliance requirements:**
- MUST resolve the connection string/schema from `ITenantContext`, never from user input.
- MUST cache the tenant→connection mapping and refresh on change.
- SHOULD store per-tenant secrets in a secret manager, not in `appsettings.json`.
- MUST run migrations per tenant database/schema (not once globally).

---

## Tenant-Aware Caching

Every cache key MUST be prefixed with the tenant id so tenants cannot read each other's
cached data. Centralize this in the key helper (see
[caching.md](caching.md#key-naming-and-ttl)).

```csharp
public sealed class TenantCacheKeys
{
    private readonly ITenantContext _tenant;

    public TenantCacheKeys(ITenantContext tenant) => _tenant = tenant;

    // "tenant:{tenantId}:product:{id}"
    public string Product(Guid id)
    {
        var tenantId = _tenant.TenantId
            ?? throw new InvalidOperationException("Tenant must be resolved to build a tenant-scoped key.");
        return $"tenant:{tenantId}:product:{id}";
    }
}
```

The same prefixing applies to distributed locks, rate-limit counters, and idempotency keys
(see [idempotency.md](idempotency.md#key-scope-ask-before-implementing)).

---

## Tenant Propagation in Messaging

Messages cross process boundaries, so the ambient tenant context does **not** flow
automatically. Attach the tenant as a message header on publish and re-establish the
context on consume.

```csharp
// Publish: stamp the tenant header (MassTransit filter runs for every send/publish).
public sealed class TenantPublishFilter<T> : IFilter<PublishContext<T>> where T : class
{
    private readonly ITenantContext _tenant;

    public TenantPublishFilter(ITenantContext tenant) => _tenant = tenant;

    public Task Send(PublishContext<T> context, IPipe<PublishContext<T>> next)
    {
        if (_tenant.HasTenant)
        {
            context.Headers.Set("X-Tenant-Id", _tenant.TenantId);
        }

        return next.Send(context);
    }

    public void Probe(ProbeContext context) { }
}
```

```csharp
// Consume: read the header and set the scoped tenant context before handling.
public sealed class TenantConsumeFilter<T> : IFilter<ConsumeContext<T>> where T : class
{
    public async Task Send(ConsumeContext<T> context, IPipe<ConsumeContext<T>> next)
    {
        var tenantId = context.Headers.Get<string>("X-Tenant-Id");
        if (!string.IsNullOrEmpty(tenantId))
        {
            var setter = context.GetPayload<IServiceProvider>().GetRequiredService<ITenantContextSetter>();
            setter.Set(tenantId);
        }

        await next.Send(context);
    }

    public void Probe(ProbeContext context) { }
}
```

**Compliance requirements:**
- MUST attach the tenant id to every outgoing message when a tenant is present.
- MUST re-establish the tenant context on consume before touching tenant-scoped data.
- MUST reject or dead-letter a tenant-scoped message that arrives without a tenant header.

---

## Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Filtering by `organizationId` is multi-tenancy" | A domain field does not route to a different DB or filter across tenants; all data stays in one place. | **Isolate via `tenantId → ITenantContext → filter/connection`** |
| "Resolve the tenant from the JWT before validating it" | An unvalidated token lets a caller forge `tenantId` and read another tenant's data. | **Authenticate before tenant resolution** |
| "Add the filter only where it matters" | One unfiltered query leaks cross-tenant data. | **Apply `HasQueryFilter` to every tenant-owned entity** |
| "Trust the `TenantId` in the request body" | The client can send any tenant id. | **Stamp `TenantId` from `ITenantContext` on the server** |
| "Cache keys don't need the tenant" | Shared cache keys leak one tenant's data to another. | **Prefix every cache/lock/counter key with the tenant** |
| "The consumer inherits the tenant context" | Ambient context does not cross process boundaries. | **Propagate the tenant via a message header** |
| "One migration covers all tenants" | Database-/schema-per-tenant each need their own migration run. | **Migrate every tenant database/schema** |

---

## Checklist

Before submitting multi-tenant code, verify:

- [ ] Isolation strategy chosen and documented in `docs/PROJECT_RULES.md`
- [ ] Tenant identified exclusively via `tenantId` (not a domain field like `organizationId`)
- [ ] `ITenantContext` is scoped and read everywhere downstream (never `HttpContext` directly)
- [ ] Tenant resolution middleware sets the context and rejects unresolved tenants
- [ ] Middleware order: `UseAuthentication` → `UseAuthorization` → tenant resolution
- [ ] Row-level: `HasQueryFilter` on every tenant-owned entity, `TenantId` indexed
- [ ] `TenantId` stamped on insert from context; cross-tenant modification rejected
- [ ] `IgnoreQueryFilters()` used only in reviewed, tenant-agnostic paths
- [ ] Per-tenant connection strings/schemas resolved from context and cached
- [ ] Per-tenant secrets kept in a secret manager, not `appsettings.json`
- [ ] Migrations run per tenant database/schema
- [ ] Every cache/lock/idempotency key is tenant-prefixed
- [ ] Messages carry `X-Tenant-Id`; consumers re-establish the tenant context
- [ ] Every tenant-aware method has an `ActivitySource.StartActivity` span tagged with `tenant.id`
- [ ] `CancellationToken` propagated through all async calls
- [ ] `ILogger<T>` used for all logging (no `Console.Write`)
