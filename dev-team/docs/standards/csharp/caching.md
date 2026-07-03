# C# Standards - Caching Strategy

> **Module:** caching.md | **Parent:** [index.md](index.md)

This module covers caching strategy patterns for .NET services using `IMemoryCache`,
`IDistributedCache` (Redis/Valkey via StackExchange.Redis), and `HybridCache` (.NET 9+).

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards, and
> [../csharp.md](../csharp.md) for Result pattern, OpenTelemetry, Serilog, and
> `CancellationToken` conventions used in every code sample below.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Cache Provider Selection](#cache-provider-selection) | IMemoryCache vs IDistributedCache vs HybridCache |
| 2 | [Caching Strategy Patterns (MANDATORY)](#caching-strategy-patterns-mandatory) | Cache-Aside, Write-Through, Write-Behind |
| 3 | [HybridCache (.NET 9+)](#hybridcache-net-9) | Two-tier cache with built-in stampede protection |
| 4 | [Stampede Protection](#stampede-protection-mandatory) | Preventing thundering herd on hot keys |
| 5 | [Cache Invalidation](#cache-invalidation) | Key-based and tag-based invalidation |
| 6 | [Key Naming and TTL](#key-naming-and-ttl) | Conventions and TTL guidance |
| 7 | [Graceful Degradation](#graceful-degradation-mandatory) | Surviving a Redis outage |
| 8 | [Anti-Rationalization Table](#anti-rationalization-table) | Common excuses and required actions |
| 9 | [Checklist](#checklist) | Pre-submission verification |

---

## Cache Provider Selection

| Provider | Scope | Backing Store | Use When |
|----------|-------|---------------|----------|
| `IMemoryCache` | Single instance | Process heap | Small, hot data on one node; no cross-instance consistency needed |
| `IDistributedCache` | All instances | Redis / Valkey / SQL Server | Shared cache across a scaled-out deployment |
| `HybridCache` (.NET 9+) | Both (L1 in-memory + L2 distributed) | Memory + Redis | Default choice on .NET 9+; adds stampede protection and tagging |

**Rule of thumb:** on .NET 9+, prefer `HybridCache`. On .NET 8, use `IDistributedCache`
(Redis) for shared state and `IMemoryCache` only for per-instance micro-caches that
tolerate divergence across nodes.

### Registration

```csharp
// Program.cs

// Redis-backed distributed cache (StackExchange.Redis)
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "svc:"; // key prefix for this service
});

// In-process cache (bounded to avoid unbounded memory growth)
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 10_000; // entries must specify Size when SizeLimit is set
});

// HybridCache (.NET 9+): requires Microsoft.Extensions.Caching.Hybrid
builder.Services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(5),       // L2 (distributed) TTL
        LocalCacheExpiration = TimeSpan.FromMinutes(1), // L1 (in-memory) TTL
    };
});
```

---

## Caching Strategy Patterns (MANDATORY)

Services that cache data MUST follow one of the three canonical strategies below. Each
has specific compliance requirements. Document the chosen strategy in `PROJECT_RULES.md`.

### Strategy Decision Framework

| Criteria | Cache-Aside | Write-Through | Write-Behind |
|----------|-------------|---------------|--------------|
| **Consistency** | Eventual (TTL-based) | Strong (dual write) | Eventual (async sync) |
| **Write latency** | Normal (no cache write on write path) | Higher (2x write) | Lowest (cache only) |
| **Read latency** | Slow on miss, fast on hit | Always fast | Always fast |
| **Data loss risk** | None (cache is disposable) | None (DB always written) | Yes (cache crash before sync) |
| **Use when** | Read-heavy, stale tolerable for TTL | Read-heavy, consistency required | Write-heavy, eventual consistency ok |
| **Examples** | Config lookups, metadata, templates | Account balances, tenant settings | Metrics counters, audit buffering |

### Cache-Aside (Lazy Loading)

The application manages the cache. On read: check cache, on miss read the source of
truth and populate the cache. On write: write the source of truth, then **invalidate**
(not update) the cache.

```csharp
public sealed class ProductCache
{
    private static readonly ActivitySource ActivitySource = new("Svc.Caching");
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    private readonly IDistributedCache _cache;
    private readonly IProductRepository _repository;
    private readonly ILogger<ProductCache> _logger;

    public ProductCache(
        IDistributedCache cache,
        IProductRepository repository,
        ILogger<ProductCache> logger)
    {
        _cache = cache;
        _repository = repository;
        _logger = logger;
    }

    // Read path: cache first, source on miss, then populate.
    public async Task<Result<Product, AppError>> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("cache.product.get_by_id");
        var key = CacheKeys.Product(id);

        try
        {
            var cached = await _cache.GetStringAsync(key, ct);
            if (cached is not null)
            {
                activity?.AddEvent(new ActivityEvent("cache_hit"));
                return Result.Success<Product, AppError>(
                    JsonSerializer.Deserialize<Product>(cached)!);
            }
        }
        catch (RedisConnectionException ex)
        {
            // Graceful degradation: read from the source of truth instead.
            activity?.AddEvent(new ActivityEvent("cache_unavailable"));
            _logger.LogWarning(ex, "Redis unavailable, falling back to repository");
            return await _repository.GetByIdAsync(id, ct);
        }

        activity?.AddEvent(new ActivityEvent("cache_miss"));
        var result = await _repository.GetByIdAsync(id, ct);
        if (result.IsSuccess)
        {
            await SetBestEffortAsync(key, result.Value, ct);
        }

        return result;
    }

    // Write path: write source of truth, then INVALIDATE (do not update) the cache.
    public async Task<Result<Unit, AppError>> UpdateAsync(Product product, CancellationToken ct)
    {
        var result = await _repository.UpdateAsync(product, ct);
        if (result.IsFailure)
        {
            return result;
        }

        // Best-effort invalidation. Next read repopulates from the source of truth.
        try
        {
            await _cache.RemoveAsync(CacheKeys.Product(product.Id), ct);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "Cache invalidation failed (DB write already committed)");
        }

        return result;
    }

    private async Task SetBestEffortAsync(string key, Product product, CancellationToken ct)
    {
        try
        {
            var options = new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = Ttl };
            await _cache.SetStringAsync(key, JsonSerializer.Serialize(product), options, ct);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogWarning(ex, "Cache populate failed (non-fatal)");
        }
    }
}
```

**Compliance requirements for Cache-Aside:**
- MUST set an absolute TTL on every write (never cache indefinitely).
- MUST invalidate the cache on `Update` and `Delete` (not only on `Create`).
- MUST fall back to the source of truth when Redis is unavailable.
- SHOULD use stampede protection for hot keys (see below).

### Write-Through

Writes go to both the source of truth and the cache in the same operation. The cache
stays consistent with the database.

```csharp
public async Task<Result<Unit, AppError>> UpdateBalanceAsync(Balance balance, CancellationToken ct)
{
    using var activity = ActivitySource.StartActivity("cache.balance.update");

    // 1. Write the source of truth first.
    var result = await _repository.UpdateBalanceAsync(balance, ct);
    if (result.IsFailure)
    {
        return result;
    }

    // 2. Keep the cache in sync. Failure here MUST NOT fail the request.
    try
    {
        var options = new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = Ttl };
        await _cache.SetStringAsync(
            CacheKeys.Balance(balance.Id), JsonSerializer.Serialize(balance), options, ct);
    }
    catch (RedisConnectionException ex)
    {
        _logger.LogWarning(ex, "Cache write failed after committed DB write (cache stale)");
    }

    return result;
}
```

**Compliance requirements for Write-Through:**
- MUST write the source of truth **before** the cache.
- MUST NOT fail the request when the cache write fails after the DB write succeeds.
- MUST still set a TTL (defense against stale data after a cache recovery).

### Write-Behind (Write-Back)

Writes go to the cache only; a background worker flushes to the database asynchronously.
Highest throughput, but a cache crash before the flush loses data — use only for
non-critical data (counters, metrics, audit buffering).

```csharp
public async Task<Result<Unit, AppError>> IncrementAsync(string counterId, long delta, CancellationToken ct)
{
    var db = _multiplexer.GetDatabase();
    var key = CacheKeys.Counter(counterId);

    // Atomic increment in Redis — no DB call on the write path.
    await db.StringIncrementAsync(key, delta);
    await db.KeyExpireAsync(key, Ttl); // defense against orphaned keys

    return Result.Success<Unit, AppError>(Unit.Value);
}
```

The background flush runs in a `BackgroundService` (see
[../csharp.md#rabbitmq-worker-pattern](../csharp.md#rabbitmq-worker-pattern) for the
worker lifecycle conventions):

```csharp
public sealed class CounterFlushWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // Read dirty counters from Redis, persist to DB, retry on transient failure.
            await FlushWithRetryAsync(stoppingToken);
        }
    }
}
```

**Compliance requirements for Write-Behind:**
- MUST have a background flush worker (`BackgroundService`) that persists to the DB.
- MUST retry on transient failures (at-least-once delivery to the DB).
- MUST alert if the pending flush backlog grows beyond a threshold.
- MUST document the data-loss window (time between cache write and DB flush).
- SHOULD use atomic Redis operations (`StringIncrement`, `HashSet`) to avoid
  read-modify-write races.

---

## HybridCache (.NET 9+)

`HybridCache` unifies L1 (in-memory) and L2 (distributed) caching, provides built-in
stampede protection, and supports tag-based invalidation. On .NET 9+ it is the preferred
implementation of Cache-Aside.

```csharp
public sealed class ProductService
{
    private static readonly ActivitySource ActivitySource = new("Svc.Caching");

    private readonly HybridCache _cache;
    private readonly IProductRepository _repository;

    public ProductService(HybridCache cache, IProductRepository repository)
    {
        _cache = cache;
        _repository = repository;
    }

    public async Task<Product?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("cache.product.get_or_create");

        return await _cache.GetOrCreateAsync(
            CacheKeys.Product(id),
            factory: async token => await _repository.FindByIdAsync(id, token),
            options: new HybridCacheEntryOptions
            {
                Expiration = TimeSpan.FromMinutes(5),
                LocalCacheExpiration = TimeSpan.FromMinutes(1),
            },
            tags: [$"product", $"product:{id}"],
            cancellationToken: ct);
    }

    // Invalidate by tag on mutation — removes every entry carrying the tag.
    public async Task InvalidateAsync(Guid id, CancellationToken ct) =>
        await _cache.RemoveByTagAsync($"product:{id}", ct);
}
```

`GetOrCreateAsync` collapses concurrent misses for the same key into a single factory
invocation, so stampede protection is automatic — no manual locking required.

---

## Stampede Protection (MANDATORY)

When a hot key expires, many concurrent requests hit the source of truth simultaneously
(the thundering herd). This is math, not probability — any TTL expiry under load causes
it.

**On .NET 9+:** use `HybridCache.GetOrCreateAsync` (stampede protection is built in).

**On .NET 8 with `IDistributedCache`:** collapse concurrent factory calls with an
in-process async lock keyed by the cache key.

```csharp
public sealed class StampedeGuard
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public async Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T?>> cacheGet,
        Func<CancellationToken, Task<T>> factory,
        Func<T, CancellationToken, Task> cacheSet,
        CancellationToken ct)
    {
        var cached = await cacheGet(ct);
        if (cached is not null)
        {
            return cached;
        }

        var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            // Double-check: another caller may have populated the cache while we waited.
            cached = await cacheGet(ct);
            if (cached is not null)
            {
                return cached;
            }

            var value = await factory(ct);
            await cacheSet(value, ct);
            return value;
        }
        finally
        {
            gate.Release();
        }
    }
}
```

**When stampede protection is MANDATORY:**
- Keys with TTL < 60s that serve > 100 req/s.
- Keys backed by expensive queries (JOINs, aggregations).
- Keys shared across multiple endpoints.

---

## Cache Invalidation

| Technique | Provider | When to Use |
|-----------|----------|-------------|
| Key removal (`RemoveAsync`) | All | Single entity mutated |
| Tag invalidation (`RemoveByTagAsync`) | HybridCache | A group of related entries changed |
| Pub/Sub broadcast | Redis + IMemoryCache | Invalidate L1 caches across instances |
| TTL expiry | All | Bounded staleness is acceptable |

When using `IMemoryCache` on scaled-out deployments, invalidate every node's L1 cache via
a Redis Pub/Sub channel — a `RemoveAsync` on one node does not touch another node's heap.

---

## Key Naming and TTL

Centralize key construction so keys are consistent, greppable, and (when multi-tenant)
tenant-scoped. See [multi-tenant.md](multi-tenant.md) for tenant-aware key prefixing.

```csharp
public static class CacheKeys
{
    public static string Product(Guid id) => $"product:{id}";
    public static string Balance(Guid id) => $"balance:{id}";
    public static string Counter(string id) => $"counter:{id}";
}
```

### TTL Best Practices

| Data Type | Recommended TTL | Rationale |
|-----------|-----------------|-----------|
| User session data | 30 min - 2 h | Balance UX and freshness |
| Configuration / settings | 5 min - 15 min | Rarely changes; fast invalidation on update |
| Entity lookups | 1 min - 5 min | Frequently accessed; tolerable stale window |
| Report templates | 1 h - 24 h | Rarely changes |
| Counters / metrics | 5 min - 30 min | Aggregated periodically |
| Rate limiting | 1 s - 60 s | Must be precise |

---

## Graceful Degradation (MANDATORY)

Every dependency fails eventually. Without graceful degradation, a Redis outage becomes a
full service outage.

- Cache reads MUST catch `RedisConnectionException` (and `RedisTimeoutException`) and fall
  back to the source of truth.
- Cache writes on the read path (populate) MUST be best-effort and MUST NOT throw.
- Cache invalidation after a committed DB write MUST NOT throw — log a warning instead.
- Configure StackExchange.Redis with a bounded `ConnectTimeout` and `SyncTimeout` so a
  slow cache does not block request threads.

---

## Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "No TTL needed, we invalidate on write" | Cache recovery after a crash leaves stale data forever without TTL. | **MUST set a TTL on every write** |
| "Update the cache on write instead of invalidating" | Double-write without a transaction risks inconsistency (DB succeeds, cache write fails with a stale value). Invalidate is safer for Cache-Aside. | **Invalidate on mutation for Cache-Aside** |
| "Redis never goes down" | Every dependency fails eventually. Without fallback, a Redis outage is a service outage. | **MUST fall back to the source of truth** |
| "Stampede won't happen to us" | Any TTL expiry under load causes a stampede. | **Use HybridCache or a keyed async lock for hot keys** |
| "IMemoryCache is fine when scaled out" | Per-instance caches diverge; one node's invalidation does not reach another. | **Use IDistributedCache/HybridCache or Pub/Sub invalidation** |
| "Write-Behind is too risky to ever use" | It depends on the data. Counters and metrics fit Write-Behind; balances do not. | **Choose the strategy by data criticality** |

---

## Checklist

Before submitting caching code, verify:

- [ ] Caching strategy is one of: Cache-Aside, Write-Through, Write-Behind
- [ ] Strategy documented in `docs/PROJECT_RULES.md`
- [ ] Every write sets an absolute TTL (never cache indefinitely)
- [ ] Cache-Aside invalidates on `Update` and `Delete`
- [ ] Graceful degradation: source-of-truth fallback when Redis is unavailable
- [ ] Cache populate and invalidation are best-effort (never throw after a committed DB write)
- [ ] Stampede protection for hot keys (`HybridCache` or keyed async lock)
- [ ] Keys built via a central `CacheKeys` helper (tenant-scoped where multi-tenant)
- [ ] Write-Behind has a `BackgroundService` flush worker with retry and backlog alerting
- [ ] Every cache method has an `ActivitySource.StartActivity` span
- [ ] `CancellationToken` propagated to every async cache call
- [ ] `ILogger<T>` used for all logging (no `Console.Write`)
