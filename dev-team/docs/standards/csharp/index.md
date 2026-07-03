# C# Standards - Index

> **MAINTENANCE:** This directory is indexed in `dev-team/skills/shared-patterns/standards-coverage-table.md`.
> When adding/removing sections, follow the FOUR-FILE UPDATE RULE in CLAUDE.md.

This directory contains modular C# / ASP.NET Core standards for idiomatic, current .NET (8/9)
development. Load only the modules you need for the task at hand.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.
> Ring standards are the baseline; `PROJECT_RULES.md` may add project-specific rules but must
> not weaken the requirements defined here.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Quick Reference - Which File for What](#quick-reference---which-file-for-what) | Task-based file selection guide |
| 2 | [Module Index](#module-index) | All modules with descriptions |
| 3 | [Section Index (Full)](#section-index-full) | Complete section index with anchors |
| 4 | [Dependency Graph](#dependency-graph) | Module dependency relationships |
| 5 | [WebFetch URLs](#webfetch-urls) | Raw GitHub URLs for agent loading |

---

## Quick Reference - Which File for What

| Task | Load These Files |
|------|------------------|
| **New service (full setup)** | core.md → architecture.md → domain.md → api-patterns.md → bootstrap.md |
| **New feature (endpoint + logic)** | api-patterns.md → domain.md |
| **Project layout / DI wiring** | core.md → architecture.md → bootstrap.md |
| **Clean Architecture / Hexagonal** | architecture.md |
| **CQRS with MediatR** | architecture.md (+ domain.md for command validation) |
| **REST endpoint (Minimal API or Controller)** | api-patterns.md |
| **Error responses (ProblemDetails / RFC 7807)** | api-patterns.md (+ domain.md for error codes) |
| **API versioning** | api-patterns.md |
| **Model binding & validation** | api-patterns.md (+ domain.md for always-valid model) |
| **Pagination** | api-patterns.md |
| **Entities / value objects / aggregates** | domain.md |
| **Domain events** | domain.md |
| **Error codes convention** | domain.md |
| **Program.cs / DI / Options / observability** | bootstrap.md |
| **OpenTelemetry / Serilog / health checks** | bootstrap.md |
| **Caching (Cache-Aside / Write-Through / HybridCache)** | caching.md (+ multi-tenant.md for tenant-scoped keys) |
| **Idempotency for write APIs** | idempotency.md (+ multi-tenant.md for key scope) |
| **Async messaging (MassTransit / outbox / DLQ)** | messaging.md |
| **Multi-tenancy (isolation, tenant context)** | multi-tenant.md |
| **Auth (JWT/OIDC), CORS, rate limiting, secrets** | security.md |
| **SQL safety / input validation / security headers** | security.md |
| **EF Core migrations (zero-downtime, expand-contract)** | migration-safety.md |
| **Analyzers / warnings-as-errors / coverage / containers** | quality.md |
| **Unit tests (xUnit, FluentAssertions, Moq)** | testing-unit.md |
| **Integration tests (WebApplicationFactory, Testcontainers)** | testing-integration.md |
| **Property-based tests (FsCheck / CsCheck)** | testing-property.md |
| **Nullable reference types / analyzers** | core.md (+ quality.md for build gates) |
| **Records vs classes** | core.md |
| **Naming & folder conventions** | core.md → architecture.md |
| **Standards compliance check / refactor report** | compliance.md → ALL modules |

---

## Module Index

| # | Module | Description |
|---|--------|-------------|
| 1 | [core.md](core.md) | .NET/C# version, nullable reference types, analyzers & `.editorconfig`, `Directory.Build.props`, naming conventions, records, project layout, configuration (Options pattern) |
| 2 | [architecture.md](architecture.md) | Clean Architecture, DDD layering, Hexagonal (Ports & Adapters), dependency rule, folder structure, dependency injection, CQRS with MediatR |
| 3 | [api-patterns.md](api-patterns.md) | ASP.NET Core Minimal APIs and Controllers, JSON conventions, `ProblemDetails` (RFC 7807), API versioning, model binding & validation, pagination |
| 4 | [domain.md](domain.md) | Entities, value objects, aggregates, always-valid domain model, domain events, error codes convention, `Result<T>` error handling, persistence transformation |
| 5 | [caching.md](caching.md) | Cache provider selection, Cache-Aside / Write-Through / Write-Behind strategies, `HybridCache`, stampede protection, invalidation, TTL, graceful degradation |
| 6 | [idempotency.md](idempotency.md) | Idempotency for write APIs, `Idempotency-Key` headers, Redis `SetNX` dedup store, middleware, key scoping, replay/in-flight handling |
| 7 | [messaging.md](messaging.md) | MassTransit over RabbitMQ / Azure Service Bus, consumers, producers, retry/redelivery/DLQ, transactional outbox & inbox, observability |
| 8 | [multi-tenant.md](multi-tenant.md) | Isolation strategies, tenant context, resolution middleware, auth-before-tenant ordering, EF Core query filters, per-tenant connections, tenant-aware caching/messaging |
| 9 | [security.md](security.md) | JWT/OIDC authentication, policy-based authorization, secret management & redaction, SQL safety, input validation, security headers, rate limiting, CORS, Data Protection |
| 10 | [bootstrap.md](bootstrap.md) | `Program.cs` initialization order, Options pattern, dependency injection, Serilog structured logging, OpenTelemetry (traces/metrics/logs), health checks, connections, graceful shutdown |
| 11 | [migration-safety.md](migration-safety.md) | EF Core migration safety, dangerous-operation detection, expand-contract pattern, migration review, `ACKNOWLEDGE` convention, multi-tenant migrations, verification commands |
| 12 | [quality.md](quality.md) | Build quality gates, Roslyn analyzers, `.editorconfig` & StyleCop, forbidden runtime patterns, startup config validation, code coverage, container security |
| 13 | [compliance.md](compliance.md) | Module map, Standards Compliance report format for `ring:dev-refactor`, master self-verification checklist across all modules |
| 14 | [testing-unit.md](testing-unit.md) | xUnit / FluentAssertions / Moq, AAA pattern, naming, Theory/InlineData, edge cases, assertions, mocking, async tests, coverage, TDD RED → GREEN |
| 15 | [testing-integration.md](testing-integration.md) | Test pyramid, `WebApplicationFactory`, Testcontainers for .NET, shared fixtures & collections, test isolation, fixture centralization, guardrails |
| 16 | [testing-property.md](testing-property.md) | Property-based testing with FsCheck / CsCheck, `[Property]` pattern, common properties (commutativity, round-trip, idempotency), custom generators & arbitraries |

---

## Section Index (Full)

### Core Foundation (core.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Version | [#version](core.md#version) |
| 2 | Nullable Reference Types (MANDATORY) | [#nullable-reference-types-mandatory](core.md#nullable-reference-types-mandatory) |
| 3 | Project Configuration (MANDATORY) | [#project-configuration-mandatory](core.md#project-configuration-mandatory) |
| 4 | Code Analysis & `.editorconfig` | [#code-analysis--editorconfig](core.md#code-analysis--editorconfig) |
| 5 | Naming Conventions | [#naming-conventions](core.md#naming-conventions) |
| 6 | Records, Classes & Structs | [#records-classes--structs](core.md#records-classes--structs) |
| 7 | Project Layout | [#project-layout](core.md#project-layout) |
| 8 | Configuration (Options Pattern) (MANDATORY) | [#configuration-options-pattern-mandatory](core.md#configuration-options-pattern-mandatory) |
| 9 | Async/Await Conventions (MANDATORY) | [#asyncawait-conventions-mandatory](core.md#asyncawait-conventions-mandatory) |

### Architecture (architecture.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Clean Architecture (MANDATORY) | [#clean-architecture-mandatory](architecture.md#clean-architecture-mandatory) |
| 2 | The Dependency Rule (MANDATORY) | [#the-dependency-rule-mandatory](architecture.md#the-dependency-rule-mandatory) |
| 3 | Hexagonal (Ports & Adapters) | [#hexagonal-ports--adapters](architecture.md#hexagonal-ports--adapters) |
| 4 | Directory Structure | [#directory-structure](architecture.md#directory-structure) |
| 5 | Dependency Injection (MANDATORY) | [#dependency-injection-mandatory](architecture.md#dependency-injection-mandatory) |
| 6 | CQRS with MediatR (CONDITIONAL) | [#cqrs-with-mediatr-conditional](architecture.md#cqrs-with-mediatr-conditional) |

### API Patterns (api-patterns.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Minimal APIs vs Controllers | [#minimal-apis-vs-controllers](api-patterns.md#minimal-apis-vs-controllers) |
| 2 | JSON Naming Convention (camelCase) (MANDATORY) | [#json-naming-convention-camelcase-mandatory](api-patterns.md#json-naming-convention-camelcase-mandatory) |
| 3 | ProblemDetails / RFC 7807 (MANDATORY) | [#problemdetails--rfc-7807-mandatory](api-patterns.md#problemdetails--rfc-7807-mandatory) |
| 4 | HTTP Status Code Consistency (MANDATORY) | [#http-status-code-consistency-mandatory](api-patterns.md#http-status-code-consistency-mandatory) |
| 5 | API Versioning (MANDATORY) | [#api-versioning-mandatory](api-patterns.md#api-versioning-mandatory) |
| 6 | Model Binding & Validation | [#model-binding--validation](api-patterns.md#model-binding--validation) |
| 7 | Pagination Patterns | [#pagination-patterns](api-patterns.md#pagination-patterns) |
| 8 | OpenAPI Documentation | [#openapi-documentation](api-patterns.md#openapi-documentation) |

### Domain Patterns (domain.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Always-Valid Domain Model (MANDATORY) | [#always-valid-domain-model-mandatory](domain.md#always-valid-domain-model-mandatory) |
| 2 | Value Objects (MANDATORY) | [#value-objects-mandatory](domain.md#value-objects-mandatory) |
| 3 | Aggregates & Aggregate Roots | [#aggregates--aggregate-roots](domain.md#aggregates--aggregate-roots) |
| 4 | Domain Events | [#domain-events](domain.md#domain-events) |
| 5 | Error Codes Convention (MANDATORY) | [#error-codes-convention-mandatory](domain.md#error-codes-convention-mandatory) |
| 6 | Error Handling: Result Pattern (MANDATORY) | [#error-handling-result-pattern-mandatory](domain.md#error-handling-result-pattern-mandatory) |
| 7 | Persistence Transformation (MANDATORY) | [#persistence-transformation-mandatory](domain.md#persistence-transformation-mandatory) |

### Caching Strategy (caching.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Cache Provider Selection | [#cache-provider-selection](caching.md#cache-provider-selection) |
| 2 | Caching Strategy Patterns (MANDATORY) | [#caching-strategy-patterns-mandatory](caching.md#caching-strategy-patterns-mandatory) |
| 3 | HybridCache (.NET 9+) | [#hybridcache-net-9](caching.md#hybridcache-net-9) |
| 4 | Stampede Protection (MANDATORY) | [#stampede-protection-mandatory](caching.md#stampede-protection-mandatory) |
| 5 | Cache Invalidation | [#cache-invalidation](caching.md#cache-invalidation) |
| 6 | Key Naming and TTL | [#key-naming-and-ttl](caching.md#key-naming-and-ttl) |
| 7 | Graceful Degradation (MANDATORY) | [#graceful-degradation-mandatory](caching.md#graceful-degradation-mandatory) |
| 8 | Anti-Rationalization Table | [#anti-rationalization-table](caching.md#anti-rationalization-table) |
| 9 | Checklist | [#checklist](caching.md#checklist) |

### Idempotency (idempotency.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Idempotency Patterns (MANDATORY for Write APIs) | [#idempotency-patterns-mandatory-for-write-apis](idempotency.md#idempotency-patterns-mandatory-for-write-apis) |
| 2 | Configuration | [#configuration](idempotency.md#configuration) |
| 3 | HTTP Headers | [#http-headers](idempotency.md#http-headers) |
| 4 | Dedup Store | [#dedup-store](idempotency.md#dedup-store) |
| 5 | Middleware Implementation | [#middleware-implementation](idempotency.md#middleware-implementation) |
| 6 | Request Flow | [#request-flow](idempotency.md#request-flow) |
| 7 | Key Scope (Ask Before Implementing) | [#key-scope-ask-before-implementing](idempotency.md#key-scope-ask-before-implementing) |
| 8 | Which Endpoints Need Idempotency | [#which-endpoints-need-idempotency](idempotency.md#which-endpoints-need-idempotency) |
| 9 | Anti-Rationalization Table | [#anti-rationalization-table](idempotency.md#anti-rationalization-table) |
| 10 | Checklist | [#checklist](idempotency.md#checklist) |

### Messaging (messaging.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Transport Selection | [#transport-selection](messaging.md#transport-selection) |
| 2 | Bus Configuration | [#bus-configuration](messaging.md#bus-configuration) |
| 3 | Message Contracts | [#message-contracts](messaging.md#message-contracts) |
| 4 | Consumers | [#consumers](messaging.md#consumers) |
| 5 | Producers (Publish vs Send) | [#producers-publish-vs-send](messaging.md#producers-publish-vs-send) |
| 6 | Retry, Redelivery, and DLQ (MANDATORY) | [#retry-redelivery-and-dlq-mandatory](messaging.md#retry-redelivery-and-dlq-mandatory) |
| 7 | Transactional Outbox (MANDATORY for dual writes) | [#transactional-outbox-mandatory-for-dual-writes](messaging.md#transactional-outbox-mandatory-for-dual-writes) |
| 8 | Observability | [#observability](messaging.md#observability) |
| 9 | Anti-Rationalization Table | [#anti-rationalization-table](messaging.md#anti-rationalization-table) |
| 10 | Checklist | [#checklist](messaging.md#checklist) |

### Multi-Tenant (multi-tenant.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | When to Use Multi-Tenancy (CONDITIONAL) | [#when-to-use-multi-tenancy-conditional](multi-tenant.md#when-to-use-multi-tenancy-conditional) |
| 2 | Isolation Strategies | [#isolation-strategies](multi-tenant.md#isolation-strategies) |
| 3 | Tenant Context | [#tenant-context](multi-tenant.md#tenant-context) |
| 4 | Tenant Resolution Middleware (MANDATORY) | [#tenant-resolution-middleware-mandatory](multi-tenant.md#tenant-resolution-middleware-mandatory) |
| 5 | Auth-Before-Tenant Ordering (MANDATORY) | [#auth-before-tenant-ordering-mandatory](multi-tenant.md#auth-before-tenant-ordering-mandatory) |
| 6 | EF Core Global Query Filters | [#ef-core-global-query-filters](multi-tenant.md#ef-core-global-query-filters) |
| 7 | Per-Tenant Connection Strings | [#per-tenant-connection-strings](multi-tenant.md#per-tenant-connection-strings) |
| 8 | Tenant-Aware Caching | [#tenant-aware-caching](multi-tenant.md#tenant-aware-caching) |
| 9 | Tenant Propagation in Messaging | [#tenant-propagation-in-messaging](multi-tenant.md#tenant-propagation-in-messaging) |
| 10 | Anti-Rationalization Table | [#anti-rationalization-table](multi-tenant.md#anti-rationalization-table) |
| 11 | Checklist | [#checklist](multi-tenant.md#checklist) |

### Security (security.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Authentication (JWT Bearer / OIDC) (MANDATORY) | [#authentication-jwt-bearer--oidc-mandatory](security.md#authentication-jwt-bearer--oidc-mandatory) |
| 2 | Authorization (Policies & Roles) (MANDATORY) | [#authorization-policies--roles-mandatory](security.md#authorization-policies--roles-mandatory) |
| 3 | Secret Management (MANDATORY) | [#secret-management-mandatory](security.md#secret-management-mandatory) |
| 4 | Secret Redaction in Logs (MANDATORY) | [#secret-redaction-in-logs-mandatory](security.md#secret-redaction-in-logs-mandatory) |
| 5 | SQL Safety (MANDATORY) | [#sql-safety-mandatory](security.md#sql-safety-mandatory) |
| 6 | Input Validation (MANDATORY) | [#input-validation-mandatory](security.md#input-validation-mandatory) |
| 7 | Security Headers (MANDATORY) | [#security-headers-mandatory](security.md#security-headers-mandatory) |
| 8 | Rate Limiting (MANDATORY) | [#rate-limiting-mandatory](security.md#rate-limiting-mandatory) |
| 9 | CORS Configuration (MANDATORY) | [#cors-configuration-mandatory](security.md#cors-configuration-mandatory) |
| 10 | Data Protection (MANDATORY) | [#data-protection-mandatory](security.md#data-protection-mandatory) |

### Bootstrap & Observability (bootstrap.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Program.cs Initialization Order (MANDATORY) | [#programcs-initialization-order-mandatory](bootstrap.md#programcs-initialization-order-mandatory) |
| 2 | Configuration & Options Pattern (MANDATORY) | [#configuration--options-pattern-mandatory](bootstrap.md#configuration--options-pattern-mandatory) |
| 3 | Dependency Injection (MANDATORY) | [#dependency-injection-mandatory](bootstrap.md#dependency-injection-mandatory) |
| 4 | Structured Logging (MANDATORY) | [#structured-logging-mandatory](bootstrap.md#structured-logging-mandatory) |
| 5 | OpenTelemetry (Traces, Metrics, Logs) (MANDATORY) | [#opentelemetry-traces-metrics-logs-mandatory](bootstrap.md#opentelemetry-traces-metrics-logs-mandatory) |
| 6 | Health Checks (MANDATORY) | [#health-checks-mandatory](bootstrap.md#health-checks-mandatory) |
| 7 | Connection Management (MANDATORY) | [#connection-management-mandatory](bootstrap.md#connection-management-mandatory) |
| 8 | Graceful Shutdown (MANDATORY) | [#graceful-shutdown-mandatory](bootstrap.md#graceful-shutdown-mandatory) |

### Migration Safety (migration-safety.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Principles | [#principles](migration-safety.md#principles) |
| 2 | Dangerous Operations Detection | [#dangerous-operations-detection](migration-safety.md#dangerous-operations-detection) |
| 3 | Expand-Contract Pattern (MANDATORY) | [#expand-contract-pattern-mandatory](migration-safety.md#expand-contract-pattern-mandatory) |
| 4 | Reviewing Generated Migrations (MANDATORY) | [#reviewing-generated-migrations-mandatory](migration-safety.md#reviewing-generated-migrations-mandatory) |
| 5 | ACKNOWLEDGE Convention | [#acknowledge-convention](migration-safety.md#acknowledge-convention) |
| 6 | Multi-Tenant Considerations | [#multi-tenant-considerations](migration-safety.md#multi-tenant-considerations) |
| 7 | Verification Commands | [#verification-commands](migration-safety.md#verification-commands) |

### Quality (quality.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Build Quality Gates (MANDATORY) | [#build-quality-gates-mandatory](quality.md#build-quality-gates-mandatory) |
| 2 | Roslyn Analyzers (MANDATORY) | [#roslyn-analyzers-mandatory](quality.md#roslyn-analyzers-mandatory) |
| 3 | .editorconfig & StyleCop (MANDATORY) | [#editorconfig--stylecop-mandatory](quality.md#editorconfig--stylecop-mandatory) |
| 4 | Forbidden Runtime Patterns (CRITICAL) | [#forbidden-runtime-patterns-critical](quality.md#forbidden-runtime-patterns-critical) |
| 5 | Startup Configuration Validation (MANDATORY) | [#startup-configuration-validation-mandatory](quality.md#startup-configuration-validation-mandatory) |
| 6 | Code Coverage (MANDATORY) | [#code-coverage-mandatory](quality.md#code-coverage-mandatory) |
| 7 | Container Security (CONDITIONAL) | [#container-security-conditional](quality.md#container-security-conditional) |

### Compliance (compliance.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Module Map | [#module-map](compliance.md#module-map) |
| 2 | Standards Compliance Output Format | [#standards-compliance-output-format](compliance.md#standards-compliance-output-format) |
| 3 | Master Checklist | [#master-checklist](compliance.md#master-checklist) |

### Unit Testing (testing-unit.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Test Framework & Libraries (MANDATORY) | [#test-framework--libraries-mandatory](testing-unit.md#test-framework--libraries-mandatory) |
| 2 | AAA Pattern (MANDATORY) | [#aaa-pattern-mandatory](testing-unit.md#aaa-pattern-mandatory) |
| 3 | Test Naming Convention (MANDATORY) | [#test-naming-convention-mandatory](testing-unit.md#test-naming-convention-mandatory) |
| 4 | Theory / InlineData / MemberData (MANDATORY) | [#theory--inlinedata--memberdata-mandatory](testing-unit.md#theory--inlinedata--memberdata-mandatory) |
| 5 | Edge Case Coverage (MANDATORY) | [#edge-case-coverage-mandatory](testing-unit.md#edge-case-coverage-mandatory) |
| 6 | Assertion Requirements (MANDATORY) | [#assertion-requirements-mandatory](testing-unit.md#assertion-requirements-mandatory) |
| 7 | Mocking (MANDATORY) | [#mocking-mandatory](testing-unit.md#mocking-mandatory) |
| 8 | Async Test Patterns (MANDATORY) | [#async-test-patterns-mandatory](testing-unit.md#async-test-patterns-mandatory) |
| 9 | Coverage Threshold (MANDATORY) | [#coverage-threshold-mandatory](testing-unit.md#coverage-threshold-mandatory) |
| 10 | Unit Test Scope & Boundaries (MANDATORY) | [#unit-test-scope--boundaries-mandatory](testing-unit.md#unit-test-scope--boundaries-mandatory) |
| 11 | TDD RED → GREEN (MANDATORY) | [#tdd-red--green-mandatory](testing-unit.md#tdd-red--green-mandatory) |
| 12 | Unit Test Quality Gate (MANDATORY) | [#unit-test-quality-gate-mandatory](testing-unit.md#unit-test-quality-gate-mandatory) |
| 13 | Output Format (Gate 0 - Unit Testing) | [#output-format-gate-0---unit-testing](testing-unit.md#output-format-gate-0---unit-testing) |
| 14 | Anti-Rationalization Table (Unit Testing) | [#anti-rationalization-table-unit-testing](testing-unit.md#anti-rationalization-table-unit-testing) |

### Integration Testing (testing-integration.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | Test Pyramid | [#test-pyramid](testing-integration.md#test-pyramid) |
| 2 | Project & Naming Convention (MANDATORY) | [#project--naming-convention-mandatory](testing-integration.md#project--naming-convention-mandatory) |
| 3 | WebApplicationFactory (MANDATORY) | [#webapplicationfactory-mandatory](testing-integration.md#webapplicationfactory-mandatory) |
| 4 | Testcontainers for .NET (MANDATORY) | [#testcontainers-for-net-mandatory](testing-integration.md#testcontainers-for-net-mandatory) |
| 5 | Shared Fixtures & Collections (MANDATORY) | [#shared-fixtures--collections-mandatory](testing-integration.md#shared-fixtures--collections-mandatory) |
| 6 | Test Isolation (MANDATORY) | [#test-isolation-mandatory](testing-integration.md#test-isolation-mandatory) |
| 7 | Fixture Centralization (MANDATORY) | [#fixture-centralization-mandatory](testing-integration.md#fixture-centralization-mandatory) |
| 8 | Guardrails (Anti-Patterns) (MANDATORY) | [#guardrails-anti-patterns-mandatory](testing-integration.md#guardrails-anti-patterns-mandatory) |
| 9 | Test Failure Analysis (No Greenwashing) | [#test-failure-analysis-no-greenwashing](testing-integration.md#test-failure-analysis-no-greenwashing) |
| 10 | Integration Test Quality Gate (MANDATORY) | [#integration-test-quality-gate-mandatory](testing-integration.md#integration-test-quality-gate-mandatory) |
| 11 | Output Format (Gate 0 - Integration Testing) | [#output-format-gate-0---integration-testing](testing-integration.md#output-format-gate-0---integration-testing) |
| 12 | Anti-Rationalization Table (Integration Testing) | [#anti-rationalization-table-integration-testing](testing-integration.md#anti-rationalization-table-integration-testing) |

### Property-Based Testing (testing-property.md)

| # | Section | Anchor |
|---|---------|--------|
| 1 | What Is Property-Based Testing | [#what-is-property-based-testing](testing-property.md#what-is-property-based-testing) |
| 2 | Library & Setup (MANDATORY) | [#library--setup-mandatory](testing-property.md#library--setup-mandatory) |
| 3 | Property Test Pattern (MANDATORY) | [#property-test-pattern-mandatory](testing-property.md#property-test-pattern-mandatory) |
| 4 | Common Properties | [#common-properties](testing-property.md#common-properties) |
| 5 | Custom Generators & Arbitraries | [#custom-generators--arbitraries](testing-property.md#custom-generators--arbitraries) |
| 6 | Property Test Quality Gate (MANDATORY) | [#property-test-quality-gate-mandatory](testing-property.md#property-test-quality-gate-mandatory) |
| 7 | Output Format (Gate 0 - Property-Based Testing) | [#output-format-gate-0---property-based-testing](testing-property.md#output-format-gate-0---property-based-testing) |
| 8 | Anti-Rationalization Table (Property Testing) | [#anti-rationalization-table-property-testing](testing-property.md#anti-rationalization-table-property-testing) |

---

## Dependency Graph

```
FOUNDATION
core.md (load first)
    │  Version, NRT, analyzers, naming, records, layout, Options, async
    │
    ├── ARCHITECTURE
    │   ├── architecture.md (depends on core.md)
    │   │   └── Clean Architecture, Hexagonal, DI, CQRS with MediatR
    │   └── domain.md (depends on core.md)
    │       └── Entities, value objects, aggregates, domain events,
    │           error codes, Result<T>, persistence transformation
    │
    ├── API
    │   └── api-patterns.md (depends on domain.md, architecture.md)
    │       └── Minimal APIs / Controllers, ProblemDetails, versioning,
    │           validation, pagination (uses error codes + Result<T>)
    │
    ├── CROSS-CUTTING (depend on core.md; wired in bootstrap.md)
    │   ├── bootstrap.md ....... Program.cs order, DI, Options, Serilog,
    │   │                        OpenTelemetry, health checks, shutdown
    │   ├── security.md ........ JWT/OIDC, authz, secrets, SQL safety,
    │   │                        headers, rate limiting, CORS, Data Protection
    │   ├── caching.md ......... Cache-Aside/Write-Through, HybridCache,
    │   │                        stampede protection (tenant-scoped keys)
    │   ├── idempotency.md ..... Idempotency-Key dedup, Redis SetNX,
    │   │                        middleware, key scoping
    │   ├── messaging.md ....... MassTransit, retry/DLQ, transactional outbox
    │   ├── multi-tenant.md .... isolation, tenant context, query filters
    │   │                        (feeds caching + idempotency + messaging keys)
    │   └── migration-safety.md  EF Core zero-downtime, expand-contract
    │
    ├── QUALITY
    │   ├── quality.md ......... build gates, analyzers, forbidden patterns,
    │   │                        coverage, container security
    │   └── compliance.md ...... module map, compliance report format,
    │                            master checklist (references ALL modules)
    │
    └── TESTING
        ├── testing-unit.md ......... xUnit/FluentAssertions/Moq, AAA,
        │                             Theory, edge cases, TDD RED → GREEN
        ├── testing-integration.md .. WebApplicationFactory, Testcontainers,
        │                             fixtures, isolation
        └── testing-property.md ..... FsCheck/CsCheck, invariants, generators
```

Recommended load order for a new service:
**core → architecture → domain → api-patterns → bootstrap** (then cross-cutting
modules as the feature requires: security, caching, idempotency, messaging,
multi-tenant, migration-safety), with **testing-*** and **quality/compliance**
applied throughout.

---

## WebFetch URLs

For agents loading standards via WebFetch:

| Module | URL |
|--------|-----|
| **index.md** | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/index.md` |
| core.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/core.md` |
| architecture.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/architecture.md` |
| api-patterns.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/api-patterns.md` |
| domain.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/domain.md` |
| caching.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/caching.md` |
| idempotency.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/idempotency.md` |
| messaging.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/messaging.md` |
| multi-tenant.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/multi-tenant.md` |
| security.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/security.md` |
| bootstrap.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/bootstrap.md` |
| migration-safety.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/migration-safety.md` |
| quality.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/quality.md` |
| compliance.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/compliance.md` |
| testing-unit.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/testing-unit.md` |
| testing-integration.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/testing-integration.md` |
| testing-property.md | `https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/csharp/testing-property.md` |
