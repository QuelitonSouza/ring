# C# Standards - Compliance

> **Module:** compliance.md | **Parent:** [index.md](index.md)

This module is the consolidated compliance surface for the C# standards. It defines the Standards
Compliance report format used by the `ring:dev-refactor` workflow and a master self-verification
checklist that references every other module in this directory.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards. Ring
> standards are the baseline; `PROJECT_RULES.md` may add rules but must not weaken these.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Module Map](#module-map) | Which module owns which requirement |
| 2 | [Standards Compliance Output Format](#standards-compliance-output-format) | Report format for `ring:dev-refactor` |
| 3 | [Master Checklist](#master-checklist) | Self-verification across all modules |

---

## Module Map

Every requirement is owned by exactly one module. When checking compliance, load the owning module
for the authoritative pattern.

| Concern | Module | Key Sections | Applies |
|---------|--------|--------------|---------|
| AuthN/AuthZ, secrets, SQL safety, rate limiting, CORS, headers, Data Protection | [security.md](security.md) | Authentication, Authorization, Secret Management, SQL Safety, Rate Limiting, CORS | Always |
| `Program.cs`, DI, Options, logging, OpenTelemetry, health checks, connections, shutdown | [bootstrap.md](bootstrap.md) | Initialization Order, OpenTelemetry, Health Checks, Graceful Shutdown | Always |
| EF Core migrations, expand-contract, zero-downtime | [migration-safety.md](migration-safety.md) | Expand-Contract, Dangerous Operations, ACKNOWLEDGE | When SQL migrations present |
| Analyzers, `.editorconfig`, warnings-as-errors, nullable, coverage, containers | [quality.md](quality.md) | Build Quality Gates, Forbidden Runtime Patterns, Code Coverage | Always |
| Caching strategy, invalidation, stampede protection, graceful degradation | [caching.md](caching.md) | Cache-Aside, Key/TTL Conventions, Stampede Protection, Degradation | When the service caches |
| Idempotency-Key, dedup store, safe retries, in-flight duplicates | [idempotency.md](idempotency.md) | Idempotency-Key, Dedup Store, 409 Handling | When mutating endpoints must be safe to retry |
| Message contracts, idempotent consumers, retry/DLQ, transactional outbox | [messaging.md](messaging.md) | Contracts, Retry & DLQ, Outbox/Inbox | When the service publishes/consumes messages |
| Tenant resolution, EF global query filters, per-tenant isolation, propagation | [multi-tenant.md](multi-tenant.md) | Tenant Resolution, Query Filters, Isolation | When the service is multi-tenant |
| Unit/integration/property test coverage, anti-patterns, 85% threshold | [testing-unit.md](testing-unit.md), [testing-integration.md](testing-integration.md), [testing-property.md](testing-property.md) | Coverage Threshold, AAA, Testcontainers, Invariants | Always (integration/property as applicable) |

> **Note:** Core language conventions, architecture layering, domain modeling, and API patterns are
> covered by the sibling modules referenced in [index.md](index.md) (`core.md`, `architecture.md`,
> `domain.md`, `api-patterns.md`) and enforced in the Cross-Cutting checklist below. This module does
> not restate their patterns.
>
> **Conditional modules** (caching, idempotency, messaging, multi-tenant) apply only when the service
> uses that capability. If it does not, mark the category **N/A** in the compliance report with a brief
> reason — never silently skip it.

---

## Standards Compliance Output Format

When producing a Standards Compliance report (used by the `ring:dev-refactor` workflow), compare the
codebase against these C# standards and emit a table per category. The comparison table is **not
optional** — it is the evidence that each category was actually checked.

### If all Categories Are Compliant

```markdown
## Standards Compliance

### Ring C# Standards Comparison

#### Bootstrap & Observability
| Category | Current Pattern | Expected Pattern | Status | Evidence |
|----------|-----------------|------------------|--------|----------|
| Init order | config → logging → telemetry → infra → app → pipeline | Same (bootstrap.md) | Compliant | `src/Api/Program.cs:1` |
| Options validation | `.ValidateOnStart()` | `.ValidateOnStart()` | Compliant | `src/Api/Program.cs:22` |
| Logging | `ILogger<T>` templates | `ILogger<T>` templates | Compliant | `src/Application/UserService.cs:40` |
| Tracing | `ActivitySource` per service | `ActivitySource` per service | Compliant | `src/Application/UserService.cs:12` |
| Health checks | `/health` + `/readyz` | `/health` + `/readyz` | Compliant | `src/Api/Program.cs:48` |

#### Security
| Category | Current Pattern | Expected Pattern | Status | Evidence |
|----------|-----------------|------------------|--------|----------|
| AuthN | JwtBearer + Authority/Audience | JwtBearer + OIDC (security.md) | Compliant | `src/Api/Program.cs:30` |
| AuthZ | Policy-based | Policy-based | Compliant | `src/Api/Program.cs:36` |
| Secrets | User Secrets / Key Vault | Same | Compliant | `src/Api/Program.cs:10` |
| SQL safety | Parameterized (EF/Dapper) | Parameterized | Compliant | `src/Infrastructure/UserRepository.cs:55` |
| Rate limiting | Built-in .NET limiter | Built-in limiter | Compliant | `src/Api/Program.cs:60` |
| CORS | Named policy, no wildcard | Named policy, no wildcard | Compliant | `src/Api/Program.cs:44` |

#### Migration Safety
| Category | Current Pattern | Expected Pattern | Status | Evidence |
|----------|-----------------|------------------|--------|----------|
| Expand-contract | Followed | Followed (migration-safety.md) | Compliant | `Migrations/*.cs` |
| Down methods | Present, non-empty | Present | Compliant | `Migrations/*.cs` |

#### Quality
| Category | Current Pattern | Expected Pattern | Status | Evidence |
|----------|-----------------|------------------|--------|----------|
| Nullable | `enable` | `enable` | Compliant | `Directory.Build.props:5` |
| Warnings-as-errors | `true` | `true` | Compliant | `Directory.Build.props:6` |
| Forbidden patterns | none found | none | Compliant | grep clean |
| Coverage | 88% | >= 85% | Compliant | `coverage/Summary.txt` |

### Verdict: FULLY COMPLIANT

No migration actions required. All categories verified against Ring C# Standards.
```

### If any Category Is Non-Compliant

```markdown
## Standards Compliance

### Ring C# Standards Comparison

#### Bootstrap & Observability
| Category | Current Pattern | Expected Pattern | Status | File/Location |
|----------|-----------------|------------------|--------|---------------|
| Logging | `Console.WriteLine` | `ILogger<T>` templates (bootstrap.md) | Non-Compliant | `src/Application/UserService.cs:40` |
| Tracing | none | `ActivitySource` per method | Non-Compliant | `src/Application/UserService.cs` |
| Options validation | `Configure<T>` only | `.ValidateOnStart()` | Non-Compliant | `src/Api/Program.cs:22` |

#### Security
| Category | Current Pattern | Expected Pattern | Status | File/Location |
|----------|-----------------|------------------|--------|---------------|
| SQL safety | Interpolated Dapper query | Parameterized (security.md) | Non-Compliant | `src/Infrastructure/UserRepository.cs:55` |

### Verdict: NON-COMPLIANT (X of Y categories)

### Required Changes for Compliance

1. **Structured Logging Migration**
   - Replace: `Console.WriteLine` calls
   - With: `ILogger<T>` message-template logging (bootstrap.md § Structured Logging)
   - Files affected: `src/Application/UserService.cs`

2. **OpenTelemetry Instrumentation**
   - Add: `static ActivitySource` per service; `using var activity = ActivitySource.StartActivity(...)`
   - Register the source via `AddSource(...)` in the OpenTelemetry bootstrap (bootstrap.md § OpenTelemetry)
   - Files affected: `src/Application/*Service.cs`

3. **SQL Parameterization**
   - Replace: interpolated Dapper/`FromSqlRaw` queries
   - With: parameterized queries (security.md § SQL Safety)
   - Files affected: `src/Infrastructure/UserRepository.cs`
```

**CRITICAL:** The comparison table is not optional. It serves as:
1. **Evidence** that each category was actually checked
2. **Documentation** of the codebase's compliance status
3. **Audit trail** for future refactors

---

## Master Checklist

Before submitting C# code, verify all of the following. Each item links to its owning module.

### Security ([security.md](security.md))

- [ ] All protected endpoints require authentication + an explicit authorization policy
- [ ] JWT bearer configured with `Authority` + `Audience`; issuer/audience/lifetime validated; HTTPS metadata required outside dev
- [ ] No secrets in `appsettings.json` or source; secrets come from User Secrets / Key Vault / env
- [ ] No secrets, tokens, or PII logged; no `{@config}` destructuring of secret-bearing objects
- [ ] All raw SQL parameterized; whitelist used for dynamic identifiers
- [ ] Request DTOs validated; binding to DTOs, not entities (no over-posting)
- [ ] Security headers set; HSTS + HTTPS redirection in production
- [ ] Rate limiting enabled, partitioned by user with IP fallback; Forwarded Headers restricted to known proxies
- [ ] CORS uses an explicit configured origin allow-list; no wildcard in production
- [ ] Data Protection key ring persisted + protected for multi-instance (or documented as not required)

### Bootstrap & Observability ([bootstrap.md](bootstrap.md))

- [ ] `Program.cs` follows the mandated initialization order and middleware order
- [ ] All configuration is typed Options with `ValidateOnStart()`
- [ ] DI wired via per-layer extension methods; no service locator; no captive dependencies
- [ ] Logging uses `ILogger<T>` message templates; probes excluded from request logging
- [ ] OpenTelemetry traces + metrics + logs exported over OTLP; service methods create `Activity` spans
- [ ] Every service/repository method propagates `CancellationToken`
- [ ] `/health` (liveness) and `/readyz` (readiness with dependency checks) both mapped
- [ ] Connections pooled with timeouts; HTTP via `IHttpClientFactory` with resilience
- [ ] Graceful shutdown: `ShutdownTimeout` set, stopping token honored, no `Environment.Exit`

### Migration Safety ([migration-safety.md](migration-safety.md))

- [ ] Generated migration `Up`/`Down` reviewed by hand
- [ ] No `AddColumn(nullable: false)` without a default; no non-concurrent index on large tables
- [ ] No `DropColumn`/`DropTable`/`AlterColumn` outside a documented expand-contract sequence
- [ ] Working, non-empty `Down` for every migration
- [ ] Multi-tenant raw SQL is idempotent (`IF NOT EXISTS` / `IF EXISTS`)
- [ ] Migrations applied via an idempotent deploy-step script, not startup auto-migrate in production
- [ ] Any legitimately-BLOCKING contract operation carries an `ACKNOWLEDGE` comment with rationale

### Quality ([quality.md](quality.md))

- [ ] `Directory.Build.props`: `Nullable=enable`, `TreatWarningsAsErrors=true`, `EnforceCodeStyleInBuild=true`
- [ ] No `#nullable disable`; no null-forgiving `!` to silence real warnings
- [ ] Analyzer packages referenced (Sonar, StyleCop, Meziantou); `.editorconfig` present; `dotnet format --verify-no-changes` passes
- [ ] No forbidden runtime patterns (Console logging, `async void`, sync-over-async, `DateTime.Now`, `throw new Exception`, empty catch)
- [ ] Startup configuration validated (fail-fast)
- [ ] Coverage meets the project threshold (default 85% changed-code)
- [ ] If a Dockerfile exists: non-root `USER`, base images pinned (no `:latest`)

### Cross-Cutting (sibling modules — see [index.md](index.md))

- [ ] Clean Architecture layering respected; Domain has zero external dependencies (`architecture.md`)
- [ ] Domain entities always-valid via factory/constructor validation; `Result<T>` for expected errors (`domain.md`)
- [ ] Error codes use the service prefix; responses use `ProblemDetails` / RFC 7807 (`domain.md`, `api-patterns.md`)

### Testing ([testing-unit.md](testing-unit.md), [testing-integration.md](testing-integration.md), [testing-property.md](testing-property.md))

- [ ] Unit tests use xUnit `Theory`/`InlineData` with edge cases beyond the happy path; FluentAssertions; AAA
- [ ] Changed-code coverage meets the threshold (default 85%); no tests asserting only mock behavior
- [ ] Integration tests use `WebApplicationFactory` + Testcontainers for real dependencies (when the service has I/O boundaries)
- [ ] Property-based tests cover key invariants where applicable (FsCheck/CsCheck)

### Conditional modules (mark N/A with a reason when the capability is not used)

**Caching ([caching.md](caching.md))** — *when the service caches*
- [ ] Cache-aside via `IMemoryCache`/`IDistributedCache`/`HybridCache`; documented key naming + TTLs
- [ ] Stampede protection on hot keys; graceful degradation when the cache is unavailable

**Idempotency ([idempotency.md](idempotency.md))** — *when mutating endpoints must be retry-safe*
- [ ] `Idempotency-Key` honored with a dedup store; cached response replayed; 409 for in-flight duplicates

**Messaging ([messaging.md](messaging.md))** — *when the service publishes/consumes messages*
- [ ] Immutable record contracts; consumers idempotent; two-layer retry + DLQ; transactional outbox for dual writes

**Multi-tenancy ([multi-tenant.md](multi-tenant.md))** — *when the service is multi-tenant*
- [ ] Tenant resolved after auth; EF global query filters enforce isolation; tenant flows through cache keys + message headers
