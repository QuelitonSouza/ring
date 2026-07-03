# Multi-Tenant Analysis Checklist (MANDATORY)

**⛔ MULTI-TENANT ANALYSIS (MANDATORY):**

See [multi-tenant.md § Canonical Model Compliance](../../docs/standards/csharp/multi-tenant.md#hard-gate-canonical-model-compliance) for the canonical patterns and [multi-tenant.md § Canonical File Map](../../docs/standards/csharp/multi-tenant.md#canonical-file-map) for valid file locations.

**Existence ≠ Compliance.** Code that has "some multi-tenant" but does not match the canonical model is NON-COMPLIANT and MUST be flagged as a gap.

## Compliance Audit

1. WebFetch multi-tenant.md: https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/multi-tenant.md
2. **Detection:** Check if any multi-tenant code exists (e.g. `MultiTenantEnabled` config flag, a `TenantMiddleware`, an `ITenantContext`/`ITenantProvider` abstraction, or EF Core global query filters keyed on a tenant id).
3. **If multi-tenant code exists → run compliance audit:**
   - **Config vars:** MUST use the canonical `MultiTenant__*` configuration keys (bound via `IOptions<MultiTenantOptions>`) — not ad-hoc names like `TenantManagerUrl`, `TENANT_URL`, etc. — plus `ApplicationName`.
   - **Tenant resolution middleware:** MUST resolve the tenant early in the ASP.NET Core pipeline (via a dedicated `TenantMiddleware` / `UseTenantResolution()`) and populate a scoped `ITenantContext`. Tenant resolution strategy (host, header `X-Tenant-Id`, JWT claim) MUST be centralized, not duplicated per controller.
   - **Pipeline ordering:** Authentication/authorization MUST run before tenant-scoped data access so an unauthenticated request never binds to a tenant connection. Register tenant resolution after `UseAuthentication()`/`UseAuthorization()`.
   - **Data isolation:** MUST enforce tenant scoping in EF Core via **global query filters** (`modelBuilder.Entity<T>().HasQueryFilter(e => e.TenantId == _tenant.Id)`) for shared-schema isolation, OR per-tenant connection strings / schemas for stronger isolation — resolved from `ITenantContext`, never a static/singleton `DbContext` connection.
   - **DbContext lifetime:** The tenant-scoped `DbContext` (and its connection) MUST be resolved per request from DI (`Scoped`), reading the tenant from `ITenantContext`. No process-wide singleton holding a tenant-bound connection.
   - **Cache keys:** Every cache operation (e.g. `IDistributedCache` / Redis) MUST prefix keys with the tenant id so tenants cannot read each other's cached values.
   - **Object storage:** Every blob/object key (e.g. Azure Blob, S3) MUST be namespaced by tenant id.
   - **Messaging:** Tenant isolation on the message bus MUST be explicit — separate queues/topics or virtual hosts per tenant (Layer 1) plus a `TenantId` message header/property (Layer 2 — audit). Producers set it; consumers restore the tenant context from it before processing.
   - **Resilience:** Calls to any tenant-management/provisioning service MUST be wrapped in a resilience pipeline (e.g. Polly circuit breaker + timeout).
   - **Backward compat:** MUST have a `MultiTenant_BackwardCompatibility` test proving the service works with tenancy disabled.
   - **Non-canonical files:** MUST NOT introduce bespoke tenant packages/namespaces (`Internal/Tenant/`, `MultiTenancy/`, custom middleware duplicating resolution). See the adding-multi-tenancy skill (Phase 3 — Non-Canonical File Detection) for the specific grep commands.
   - Each non-compliant item → ISSUE-XXX with severity based on impact
4. **If multi-tenant code is MISSING entirely** → ISSUE-XXX (CRITICAL): "Service does not support multi-tenant mode. MUST run the adding-multi-tenancy skill."
5. **If non-compliant** → ISSUE-XXX per component: "Multi-tenant [component] is non-compliant. MUST be replaced with the canonical pattern."
6. **Backward compatibility:** Service MUST work with `MultiTenant__Enabled=false` (default) and without any `MultiTenant__*` config present.

## Performance & Operational Readiness

**These checks apply when multi-tenant IS implemented. Flag as ISSUE-XXX if missing.**

### Connection Pool Health
```bash
# Check pool configuration is parameterized (not hardcoded)
grep -rn "MaxPoolSize\|MinPoolSize\|Max Pool Size\|Min Pool Size" src/ --include="*.cs" | grep -v -i "test"
# Expected: Pool limits come from configuration (connection string / options bound from config), not hardcoded literals

# Check for hardcoded pool sizes outside configuration/bootstrap
grep -rn "Max Pool Size=\|MaxPoolSize *=" src/ --include="*.cs" | grep -v -i "test" | grep -v -i "config\|options\|appsettings"
# Expected: 0 matches outside configuration binding.
```
- ISSUE if pool limits are hardcoded → MEDIUM: "Pool limits MUST come from configuration (e.g. `MultiTenant__MaxTenantPools`), not literals"
- ISSUE if idle/connection lifetime is unbounded → MEDIUM: "MUST configure connection idle timeout / lifetime to prevent leaks"

### Circuit Breaker Configuration
```bash
# Verify a resilience pipeline / circuit breaker is configured with config-driven thresholds
grep -rn "AddResiliencePipeline\|CircuitBreaker\|AddStandardResilienceHandler" src/ --include="*.cs"
# Expected: threshold and break duration come from configuration, not hardcoded
```
- ISSUE if circuit breaker uses hardcoded values → MEDIUM: "Circuit breaker thresholds MUST come from `MultiTenant__CircuitBreaker__*` configuration"

### Metrics Implementation
```bash
# Verify the mandatory tenant metrics are emitted (Meter / counters)
grep -rn "tenant_connections_total\|tenant_connection_errors_total\|tenant_consumers_active\|tenant_messages_processed_total" src/ --include="*.cs"
# Expected: all four metrics present (emitted via System.Diagnostics.Metrics / OpenTelemetry)
```
- ISSUE if any metric missing → MEDIUM: "Missing multi-tenant metric: [name]. All four are MANDATORY."
- ISSUE if metrics are not no-op in single-tenant mode → LOW: "Metrics MUST be no-op when `MultiTenant__Enabled=false`"

### Graceful Shutdown
```bash
# Verify tenant-scoped resources are disposed on shutdown
grep -rn "IHostApplicationLifetime\|IAsyncDisposable\|StopAsync\|Dispose(" src/ --include="*.cs" | grep -v -i "test"
# Expected: per-tenant connection managers / consumers disposed in the shutdown path (IHostedService.StopAsync / IAsyncDisposable)
```
- ISSUE if managers/consumers not disposed on shutdown → HIGH: "Tenant connection managers MUST be disposed on graceful shutdown to prevent leaks"

### Error Handling Completeness
```bash
# Verify tenant sentinel exceptions are handled
grep -rn "TenantNotFoundException\|CircuitBreakerOpen\|TenantContextRequired\|TenantNotProvisioned" src/ --include="*.cs"
# Expected: handled centrally in middleware / an exception handler / problem-details mapping
```
- ISSUE if tenant exceptions not handled → HIGH: "Multi-tenant error [name] not handled. See multi-tenant.md § Error Handling."

### Single-Tenant Adaptability (for non-MT codebases analyzed by the planning-backend-refactor skill)
```bash
# Check for global/static DbContext or connection singletons (non-MT-adaptable)
# This catches static/singleton connection holders, NOT scoped DI resolution.
grep -rn "static .*DbContext\|static .*SqlConnection\|static .*NpgsqlConnection\|AddSingleton<.*DbContext" src/ --include="*.cs" | grep -v -i "test"
# Expected: 0 matches. DbContext must be Scoped (per request) so it can bind to the resolved tenant.

# Check that the tenant is read from an injected ITenantContext, not a global/ambient static
grep -rn "TenantContext\.Current\|AsyncLocal<.*Tenant\|static.*CurrentTenant" src/ --include="*.cs" | grep -v -i "test"
# Expected: prefer constructor-injected ITenantContext over ambient/static tenant access.
```
- ISSUE if a static/singleton DbContext or connection is found → HIGH: "Static/singleton database context blocks per-tenant routing. Refactor to a Scoped DbContext resolving the tenant from ITenantContext via DI."
- ISSUE if tenant is read from ambient static state instead of injected `ITenantContext` → MEDIUM: "Tenant MUST be resolved from an injected ITenantContext (Scoped), not ambient/static state, for reliable MT adaptation."
