---
name: ring:implementing-readyz
description: "Implementing the canonical /healthz (liveness) + /readyz (readiness) probe contract in ASP.NET Core via IHealthChecksBuilder (AddHealthChecks, MapHealthChecks, tagged checks), wiring real dependency probes (DB, cache, queue, HTTP upstreams), TLS enforcement, metrics, and graceful drain — validated across an audit-then-implement cycle. Use when a .NET service lacks or has incomplete readiness/liveness endpoints. Skip for libraries, CLI tools, or batch jobs that serve no HTTP traffic."
---

# Readyz & Health-Check Development Cycle

## When to use
- New ASP.NET Core service being created
- Service has external dependencies (DB, cache, queue, HTTP upstreams)
- Service lacks `/readyz` or has incomplete dependency checks
- Service missing liveness gating, TLS enforcement, or health metrics

## Skip when
- Pure library / NuGet package with no deployable service or HTTP server
- Task is documentation-only, configuration-only, or non-code
- Service has no external dependencies AND no network listeners
- CLI tool or batch job that does not serve HTTP traffic

## Related
**Complementary:** ring:reviewing-operational-risk, ring:hardening-dockerfiles, ring:dev-sre


You orchestrate. Agents implement. NEVER use Edit/Write/Bash on source files.
All code changes go through `Task(subagent_type="ring:backend-engineer-csharp")`.
TDD mandatory for all implementation gates (RED → GREEN → REFACTOR).

## Deployment context
The service runs BOTH on Kubernetes (AKS) AND on a VPS with Docker.

- On **AKS**, `/healthz` backs the `livenessProbe` and `/readyz` backs the `readinessProbe`. A failing `/readyz` pulls the pod out of the Service endpoints without killing it; a failing `/healthz` restarts it.
- On the **VPS**, there is no kubelet. Point Docker's `HEALTHCHECK` (or a Compose `healthcheck:`) at `/healthz`, and have your reverse proxy / load balancer poll `/readyz` before routing. The **same two endpoints serve both targets** — do not build K8s-only probes.

## Health-Check Architecture

`/readyz` — runtime dependency probe (readiness). `/healthz` — liveness probe: is the process alive and self-consistent. Keep them distinct.

**Canonical response contract** (ASP.NET Core health-check JSON writer):

```json
{
  "status": "Healthy",
  "checks": {
    "postgres": { "status": "Healthy", "latency_ms": 2, "tls": true },
    "redis":    { "status": "Skipped", "reason": "REDIS_ENABLED=false" },
    "upstream_fees": { "status": "Degraded", "breaker_state": "half-open", "latency_ms": 12 }
  },
  "version": "1.2.3",
  "deployment_mode": "vps"
}
```

**Status vocabulary:** ASP.NET Core `HealthStatus` is three-valued — `Healthy` / `Degraded` / `Unhealthy`. Represent "not applicable / turned off" checks as a custom `Skipped`/`n/a` string inside the check's serialized `status` (a `HealthCheckResult` with data), not as a fourth `HealthStatus`. Do not invent other top-level values.

**Aggregation rule:** overall status is the worst of all checks. Return **HTTP 503** if ANY check is `Unhealthy` or `Degraded`; HTTP 200 only when all are `Healthy` (or `Skipped`).

**Probe logging contract (MANDATORY):**

Kubernetes hits `/readyz` every few seconds (thousands of calls/day per pod), and the VPS proxy polls just as often. Per-iteration INFO logging drowns the log pipeline.

| Outcome | Log level |
|---------|-----------|
| Success (all checks Healthy) | Debug |
| Failure (any check Unhealthy/Degraded) | Warning |

The probe handler emits no Info/Error. Exclude `/healthz`, `/readyz`, `/metrics` from request/access logging middleware (e.g. skip them in a Serilog request-logging filter or a custom middleware guard). Steady-state observability is the job of metrics (see Gate 5), not per-call logs.

**Endpoint paths:**

| Stack | Liveness | Readiness |
|-------|----------|-----------|
| ASP.NET Core API | `/healthz` | `/readyz` |

**Forbidden anti-patterns** (block progression in Gate 0):
1. Response caching / output caching in front of `/readyz`
2. `/ready` or `/health` alias instead of the canonical `/readyz` + `/healthz`
3. A single combined endpoint that mixes liveness and readiness
4. Readiness that returns 200 while a required dependency is down (no real `AddCheck`)
5. Liveness (`/healthz`) that probes external dependencies — liveness must be self-only, or a dependency blip will trigger pointless restarts
6. `Environment.Exit()` / crashing the host from inside a health check
7. String-matching a connection string for `tls=true`/`sslmode=` instead of parsing it properly
8. Info log on probe success — success is Debug, failure is Warning

## Implementation — ASP.NET Core Health Checks

**Registration (`Program.cs`):**

```csharp
builder.Services.AddHealthChecks()
    // Readiness: real dependency probes, tagged "ready"
    .AddNpgSql(
        connectionString: cfg.GetConnectionString("Postgres")!,
        name: "postgres", tags: new[] { "ready" })
    .AddRedis(
        cfg.GetConnectionString("Redis")!,
        name: "redis", tags: new[] { "ready" })
    .AddRabbitMQ(
        name: "rabbitmq", tags: new[] { "ready" })
    .AddUrlGroup(
        new Uri(cfg["Upstreams:Fees"]! + "/healthz"),
        name: "upstream_fees", tags: new[] { "ready" })
    // Liveness: cheap, self-only, tagged "live"
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" });
```

**Mapping (`Program.cs`):**

```csharp
// Liveness — only the "live"-tagged checks (no external dependencies)
app.MapHealthChecks("/healthz", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = WriteHealthJson,   // canonical contract writer
});

// Readiness — only the "ready"-tagged dependency checks
app.MapHealthChecks("/readyz", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = WriteHealthJson,
    ResultStatusCodes =
    {
        [HealthStatus.Healthy]   = StatusCodes.Status200OK,
        [HealthStatus.Degraded]  = StatusCodes.Status503ServiceUnavailable,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable,
    },
});
```

The `WriteHealthJson` `ResponseWriter` serializes the canonical contract above
(per-check `latency_ms` from `entry.Value.Duration`, `tls`, `version`,
`deployment_mode`) and logs at Debug on success / Warning on failure.

**Custom dependency check** (`IHealthCheck`) when the packaged checks don't fit —
e.g. TLS verification of the DB connection:

```csharp
public sealed class PostgresTlsHealthCheck : IHealthCheck
{
    private readonly string _connectionString;
    public PostgresTlsHealthCheck(string connectionString) => _connectionString = connectionString;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(_connectionString); // parse, don't string-match
        var tlsRequired = builder.SslMode is Npgsql.SslMode.Require or Npgsql.SslMode.VerifyFull;
        var data = new Dictionary<string, object> { ["tls"] = tlsRequired };
        try
        {
            await using var conn = new Npgsql.NpgsqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            return HealthCheckResult.Healthy("postgres reachable", data);
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("postgres unreachable", ex, data);
        }
    }
}
```

**Graceful drain:** register `IHostApplicationLifetime.ApplicationStopping` to
flip readiness to unhealthy first, wait the drain grace period so in-flight
requests finish and load balancers stop routing, then let the host shut down.
On K8s pair this with `terminationGracePeriodSeconds`; on the VPS give the proxy
time to notice the 503 before `docker stop`'s timeout fires.

## Gate Overview

| Gate | Name | Condition | Agent |
|------|------|-----------|-------|
| 0 | Stack Detection + Compliance Audit | Always | Orchestrator |
| 1 | Codebase Analysis | Always | ring:codebase-explorer |
| 2 | `/readyz` + `/healthz` Endpoint Implementation | Always | ring:backend-engineer-csharp |
| 3 | TLS Detection (parse connection strings, not string-match) | Always | ring:backend-engineer-csharp |
| 4 | Dependency Checks (DB / cache / queue / upstreams) | Always | ring:backend-engineer-csharp |
| 5 | Metrics Emission | Always | ring:backend-engineer-csharp |
| 6 | Circuit Breaker Carve-Out (Polly) | Skip only if no breakers | ring:backend-engineer-csharp |
| 7 | Liveness Self-Check + Graceful Drain | Always — NEVER skippable | ring:backend-engineer-csharp |
| 8 | Tests | Always | ring:backend-engineer-csharp |
| 9 | Code Review | Always | reviewers in parallel |
| 10 | User Validation | Always | User |
| 11 | Activation Guide (K8s probes + Docker HEALTHCHECK) | Always | Orchestrator |

Gates execute sequentially. Existing health-check code ≠ compliance. Gate 0 audit is mandatory.

## Gate 0: Stack Detection + Audit

Orchestrator executes directly. Three phases:

**Phase 1: Stack Detection**
```bash
grep -rn "AddHealthChecks\|MapHealthChecks\|IHealthCheck" --include=*.cs .
grep -rn "Npgsql\|SqlConnection\|EntityFrameworkCore" --include=*.cs .   # postgres / sql server / EF
grep -rn "StackExchange.Redis\|IDistributedCache" --include=*.cs .        # redis
grep -rn "RabbitMQ\|Azure.Messaging.ServiceBus\|Confluent.Kafka\|MassTransit" --include=*.cs .
grep -rn "HttpClient\|IHttpClientFactory\|AddHttpClient" --include=*.cs .  # upstreams
grep -rn "Polly\|AddStandardResilienceHandler\|CircuitBreaker" --include=*.cs .
grep -rn "DEPLOYMENT_MODE\|DeploymentMode\|ASPNETCORE_ENVIRONMENT" appsettings*.json Program.cs
```

**Phase 2: Compliance Audit (S1-S10)** (if health-check code detected)
- S1: Response contract shape (all required fields present via a custom `ResponseWriter`)
- S2: Status mapping (Healthy → 200; Degraded/Unhealthy → 503)
- S3: Aggregation rule (503 on Degraded/Unhealthy)
- S4: Endpoint paths (exact `/readyz` + `/healthz`, not `/ready`/`/health`)
- S5: No response/output caching in front of the probes
- S6: TLS detection parses the connection string (`NpgsqlConnectionStringBuilder` / `SqlConnectionStringBuilder`), not `Contains("tls=true")`
- S7: Liveness (`/healthz`) is self-only (tag `live`); readiness (`/readyz`) is dependency-only (tag `ready`)
- S8: Health metrics emitted (check status + duration)
- S9: Graceful drain on `ApplicationStopping`
- S10: Probe logging follows the contract (success = Debug, failure = Warning; no Info from the probe handler; `/readyz`, `/healthz`, `/metrics` excluded from access log)

**Phase 3: Anti-Pattern Detection**
Check for each of the 8 forbidden anti-patterns. Any match = COMPLIANT: false.

## Severity Reference

| Severity | Criteria |
|----------|----------|
| CRITICAL | `/healthz` probes external dependencies (restart storms); `Environment.Exit()` from a check; response caching over the probes |
| HIGH | Wrong status→code mapping; aggregation rule wrong; metrics not emitted; readiness returns 200 while a dependency is down; Info logging on probe success |
| MEDIUM | Missing `reason` on skipped checks; drain grace too short |
| LOW | Missing per-dep description; inconsistent version string |
