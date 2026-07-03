# C# Standards - Idempotency

> **Module:** idempotency.md | **Parent:** [index.md](index.md)

This module covers idempotency patterns for .NET APIs that create resources or trigger
side effects. It prevents duplicate operations caused by network retries, client bugs, or
double-clicks.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards, and
> [../csharp.md](../csharp.md) for the Result pattern, error-code convention, OpenTelemetry,
> and `CancellationToken` conventions used below.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Idempotency Patterns (MANDATORY for Write APIs)](#idempotency-patterns-mandatory-for-write-apis) | Why the pattern is required |
| 2 | [Configuration](#configuration) | Options pattern for enabling/tuning idempotency |
| 3 | [HTTP Headers](#http-headers) | Idempotency-Key and related headers |
| 4 | [Dedup Store](#dedup-store) | Redis SetNX lock + cached response |
| 5 | [Middleware Implementation](#middleware-implementation) | ASP.NET Core idempotency middleware |
| 6 | [Request Flow](#request-flow) | End-to-end request handling |
| 7 | [Key Scope](#key-scope-ask-before-implementing) | Domain-specific key scoping |
| 8 | [Which Endpoints Need Idempotency](#which-endpoints-need-idempotency) | Decision guide |
| 9 | [Anti-Rationalization Table](#anti-rationalization-table) | Common excuses and required actions |
| 10 | [Checklist](#checklist) | Pre-submission verification |

---

## Idempotency Patterns (MANDATORY for Write APIs)

**MUST implement idempotency:** all endpoints that create resources or trigger side
effects. **HARD GATE.**

### Why This Pattern Is Mandatory

| Problem | Consequence | Solution |
|---------|-------------|----------|
| Network retry creates a duplicate | Double charge, duplicate records | Idempotency-key deduplication |
| Client retries after a timeout | Operation executed twice | Cached response replay |
| User double-clicks submit | Two identical transactions | Request fingerprinting |
| Load balancer / proxy retry | Multiple side effects | Atomic lock via `SetNX` |

The mechanism is a two-phase dedup store backed by Redis:

1. **Lock:** `SetNX(key, "", ttl)` atomically acquires a lock for the request.
2. **Replay:** if the lock already holds a cached response, return it verbatim.
3. **Cache:** after the operation succeeds, store the serialized response under the key.

---

## Configuration

Use the Options pattern (per [../csharp.md#configuration](../csharp.md#configuration)) —
never scatter `Configuration["..."]` reads through the code.

```csharp
public sealed class IdempotencyOptions
{
    public const string SectionName = "Idempotency";

    public bool Enabled { get; init; } = true;
    public TimeSpan DefaultTtl { get; init; } = TimeSpan.FromMinutes(5);
}
```

```json
// appsettings.json
{
  "Idempotency": {
    "Enabled": true,
    "DefaultTtl": "00:05:00"
  }
}
```

```csharp
// Program.cs
builder.Services
    .AddOptions<IdempotencyOptions>()
    .Bind(builder.Configuration.GetSection(IdempotencyOptions.SectionName))
    .ValidateOnStart();
```

**When `Enabled = false`:** the middleware passes the request straight through. Useful for
local development. **MUST NOT** be disabled in production for write APIs.

### TTL Precedence

TTL resolves most-specific-first:

```text
X-Idempotency-TTL header (per-request) > IdempotencyOptions.DefaultTtl (per-service)
```

| Priority | Source | Scope |
|----------|--------|-------|
| 1 (highest) | `X-Idempotency-TTL` header | Per-request override |
| 2 | `IdempotencyOptions.DefaultTtl` | Per-service default |

---

## HTTP Headers

| Header | Direction | Type | Description |
|--------|-----------|------|-------------|
| `Idempotency-Key` | Request | string | Client-provided unique key |
| `X-Idempotency-TTL` | Request | int (seconds) | Overrides `DefaultTtl` |
| `Idempotency-Replayed` | Response | bool | `"true"` when the response was served from cache |

If the client omits `Idempotency-Key`, fall back to a SHA-256 hash of the request body so
identical payloads deduplicate naturally.

---

## Dedup Store

The dedup store wraps Redis and exposes the lock-or-fetch primitive. The response body is
cached as a serialized envelope (status + body) so replays are byte-identical.

```csharp
public sealed record IdempotencyRecord(int StatusCode, string Body);

public sealed class RedisIdempotencyStore
{
    private static readonly ActivitySource ActivitySource = new("Svc.Idempotency");

    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisIdempotencyStore> _logger;

    public RedisIdempotencyStore(IConnectionMultiplexer redis, ILogger<RedisIdempotencyStore> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// Atomically acquires the idempotency lock.
    /// Returns Acquired when this is the first request, or the cached record on a replay.
    /// </summary>
    public async Task<IdempotencyResult> AcquireOrGetAsync(string key, TimeSpan ttl, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("idempotency.acquire_or_get");
        activity?.SetTag("idempotency.key", key);

        var db = _redis.GetDatabase();

        // SetNX with an empty value acts as the lock. When == true, we are first.
        var acquired = await db.StringSetAsync(key, string.Empty, ttl, When.NotExists);
        if (acquired)
        {
            activity?.AddEvent(new ActivityEvent("lock_acquired"));
            return IdempotencyResult.Acquired();
        }

        // Lock exists: either a cached response, or a duplicate still in flight.
        var value = await db.StringGetAsync(key);
        if (value.HasValue && !string.IsNullOrEmpty(value!))
        {
            activity?.AddEvent(new ActivityEvent("replayed"));
            var record = JsonSerializer.Deserialize<IdempotencyRecord>(value!)!;
            return IdempotencyResult.Replayed(record);
        }

        activity?.AddEvent(new ActivityEvent("in_flight_conflict"));
        return IdempotencyResult.InFlight();
    }

    /// <summary>Stores the response envelope under an already-locked key.</summary>
    public async Task StoreAsync(string key, IdempotencyRecord record, TimeSpan ttl, CancellationToken ct)
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync(key, JsonSerializer.Serialize(record), ttl);
    }
}

public sealed record IdempotencyResult(IdempotencyState State, IdempotencyRecord? Record)
{
    public static IdempotencyResult Acquired() => new(IdempotencyState.Acquired, null);
    public static IdempotencyResult Replayed(IdempotencyRecord r) => new(IdempotencyState.Replayed, r);
    public static IdempotencyResult InFlight() => new(IdempotencyState.InFlight, null);
}

public enum IdempotencyState { Acquired, Replayed, InFlight }
```

---

## Middleware Implementation

Implement idempotency as ASP.NET Core middleware so every write endpoint is covered
without per-handler code. Register it **after** authentication (a duplicate request must
still be authenticated) and only for unsafe methods.

```csharp
public sealed class IdempotencyMiddleware
{
    private static readonly ActivitySource ActivitySource = new("Svc.Idempotency");

    private readonly RequestDelegate _next;
    private readonly RedisIdempotencyStore _store;
    private readonly IOptions<IdempotencyOptions> _options;
    private readonly ILogger<IdempotencyMiddleware> _logger;

    public IdempotencyMiddleware(
        RequestDelegate next,
        RedisIdempotencyStore store,
        IOptions<IdempotencyOptions> options,
        ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _store = store;
        _options = options;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var opts = _options.Value;
        var ct = context.RequestAborted;

        // Only guard unsafe methods; skip when disabled.
        if (!opts.Enabled || !IsUnsafeMethod(context.Request.Method))
        {
            await _next(context);
            return;
        }

        using var activity = ActivitySource.StartActivity("middleware.idempotency");

        var key = await ResolveKeyAsync(context);
        var ttl = ResolveTtl(context, opts.DefaultTtl);

        var result = await _store.AcquireOrGetAsync(key, ttl, ct);

        switch (result.State)
        {
            case IdempotencyState.Replayed:
                context.Response.Headers["Idempotency-Replayed"] = "true";
                context.Response.StatusCode = result.Record!.StatusCode;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(result.Record.Body, ct);
                return;

            case IdempotencyState.InFlight:
                // Same key locked but no response yet: a concurrent duplicate is running.
                _logger.LogWarning("Duplicate in-flight request for idempotency key {Key}", key);
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(
                    new { code = "SVC-0084", title = "Duplicate Idempotency Key" }, ct);
                return;

            case IdempotencyState.Acquired:
                context.Response.Headers["Idempotency-Replayed"] = "false";
                await CaptureAndCacheAsync(context, key, ttl, ct);
                return;
        }
    }

    // Buffer the response so a successful result can be cached for replay.
    private async Task CaptureAndCacheAsync(HttpContext context, string key, TimeSpan ttl, CancellationToken ct)
    {
        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await _next(context);
        }
        finally
        {
            context.Response.Body = original;
        }

        buffer.Position = 0;
        var body = await new StreamReader(buffer).ReadToEndAsync(ct);

        // Only cache successful responses; failures should be retryable.
        if (context.Response.StatusCode is >= 200 and < 300)
        {
            await _store.StoreAsync(key, new IdempotencyRecord(context.Response.StatusCode, body), ttl, ct);
        }

        buffer.Position = 0;
        await buffer.CopyToAsync(context.Response.Body, ct);
    }

    private static bool IsUnsafeMethod(string method) =>
        HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsPatch(method);

    private async Task<string> ResolveKeyAsync(HttpContext context)
    {
        var scope = TenantScope.From(context); // see Key Scope section
        var raw = context.Request.Headers["Idempotency-Key"].ToString();

        if (string.IsNullOrEmpty(raw))
        {
            // Hash fallback: identical payloads deduplicate naturally.
            context.Request.EnableBuffering();
            using var sha = SHA256.Create();
            var hash = await sha.ComputeHashAsync(context.Request.Body);
            context.Request.Body.Position = 0;
            raw = Convert.ToHexString(hash);
        }

        return string.IsNullOrEmpty(scope)
            ? $"idempotency:{{{raw}}}"
            : $"idempotency:{{{scope}:{raw}}}";
    }

    private static TimeSpan ResolveTtl(HttpContext context, TimeSpan fallback)
    {
        if (int.TryParse(context.Request.Headers["X-Idempotency-TTL"], out var seconds) && seconds > 0)
        {
            return TimeSpan.FromSeconds(seconds);
        }

        return fallback;
    }
}
```

```csharp
// Program.cs — order matters: auth first, then idempotency, then endpoints.
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<IdempotencyMiddleware>();
app.MapControllers();
```

### Error Code

Follow the [Error Codes Convention](../csharp.md#error-codes-convention-mandatory) — use
your service prefix for the in-flight conflict:

```csharp
public static class IdempotencyErrors
{
    // Replace SVC with your service prefix (e.g., TXN, PLT).
    public static readonly AppError DuplicateInFlight = AppError.Conflict(
        "SVC-0084", "Idempotency key is already in use (duplicate in-flight request)");
}
```

---

## Request Flow

```text
Request → resolve Idempotency-Key (or SHA-256 of body) → resolve TTL (header > options)
    ↓
Build key: idempotency:{scope:key}   (scope = domain identifiers; empty for global)
    ↓
Redis SetNX(key, "", ttl)  (atomic lock)
    ├─ Acquired (first request)
    │   ├─→ Run the endpoint
    │   ├─→ On 2xx: cache the response envelope under the key
    │   └─→ Return response + Idempotency-Replayed: false
    │
    └─ Not acquired (lock exists)
        ├─→ GET key
        │   ├─→ Value present → return cached response + Idempotency-Replayed: true
        │   └─→ Empty → 409 Conflict SVC-0084 (in-flight duplicate)
```

---

## Key Scope (Ask Before Implementing)

**HARD GATE:** before implementing, confirm the key scope with the requester. The scope
isolates keys so two different customers/contexts cannot collide.

Ask: *"What identifiers scope the idempotency key for this service (e.g., `tenantId`,
`organizationId:ledgerId`, `accountId`, or none for global)?"*

| Scope | Key Format | Isolation |
|-------|------------|-----------|
| `tenantId` | `idempotency:{tenantId:key}` | Per tenant |
| `organizationId:ledgerId` | `idempotency:{orgId:ledgerId:key}` | Per org + ledger |
| `accountId` | `idempotency:{accountId:key}` | Per account |
| (none) | `idempotency:{key}` | Global |

In multi-tenant mode the tenant prefix comes from the tenant context (see
[multi-tenant.md](multi-tenant.md)), giving defense-in-depth: tenant prefix (routing) +
domain scope (data).

---

## Which Endpoints Need Idempotency

| Endpoint Type | Required | Reason |
|---------------|----------|--------|
| POST (create) | Yes | Creates resources; has side effects |
| PUT (replace) | Conditional | If not naturally idempotent |
| PATCH (update) | Conditional | If not naturally idempotent |
| DELETE | Usually no | Naturally idempotent |
| GET | No | Read-only, no side effects |

---

## Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Our network is reliable" | Networks fail and retries happen — always. | **Implement idempotency for all create operations** |
| "Clients won't retry" | HTTP clients auto-retry on timeout; proxies and load balancers retry too. | **Assume retries will happen** |
| "Database constraints prevent duplicates" | Constraints raise errors, not a graceful cached success. | **Return the cached success instead of an error** |
| "Too complex to implement" | The pattern is standard; Redis `SetNX` (`When.NotExists`) is one call. | **Follow the middleware pattern above** |
| "Only needed for payments" | Any duplicate costs support tickets and cleanup. | **Apply to all resource creation** |
| "We'll add it later" | Retrofitting is harder than building it in. | **Implement from the start** |
| "Disable it in production to debug" | Disabling in production exposes every write endpoint to duplicates. | **Keep enabled in production for write APIs** |

---

## Checklist

Before submitting idempotency code, verify:

- [ ] `IdempotencyOptions` bound via the Options pattern with `ValidateOnStart`
- [ ] `Enabled` and `DefaultTtl` present in `appsettings.json`
- [ ] TTL precedence implemented: `X-Idempotency-TTL` header > `DefaultTtl`
- [ ] All POST endpoints that create resources are covered
- [ ] SHA-256 body-hash fallback when `Idempotency-Key` is absent
- [ ] Redis `SetNX` (`When.NotExists`) used for the atomic lock with an empty value
- [ ] Cached response replayed with `Idempotency-Replayed: true`
- [ ] In-flight duplicate returns 409 with a service-prefixed error code
- [ ] Only 2xx responses are cached (failures stay retryable)
- [ ] Key scoping confirmed with the requester and applied (`idempotency:{scope:key}`)
- [ ] Multi-tenant: tenant prefix applied from the tenant context
- [ ] Middleware registered after `UseAuthentication`/`UseAuthorization`
- [ ] Every store method has an `ActivitySource.StartActivity` span
- [ ] `CancellationToken` propagated through all async calls
