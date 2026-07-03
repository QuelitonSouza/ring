# Standards Coverage Table Pattern

This file defines the MANDATORY output format for agents comparing codebases against Ring standards. It ensures every section in the standards is explicitly checked and reported.

---

## ⛔ CRITICAL: All Sections Are Required

**This is NON-NEGOTIABLE. Every section listed in the Agent → Standards Section Index below MUST be checked.**

| Rule | Enforcement |
|------|-------------|
| **Every section MUST be checked** | No exceptions. No skipping. |
| **Every section MUST appear in output table** | Missing row = INCOMPLETE output |
| **Subsections are INCLUDED** | If "Containers" is listed, all content (Dockerfile, Docker Compose) MUST be checked |
| **N/A requires explicit reason** | Cannot mark N/A without justification |

**If you skip any section → Your output is REJECTED. Start over.**

**If you invent section names → Your output is REJECTED. Start over.**

---

## ⛔ CRITICAL: Section Names Are Not Negotiable

**You MUST use the EXACT section names from this file. You CANNOT:**

| FORBIDDEN | Example | Why Wrong |
|-----------|---------|-----------|
| Invent names | "Security", "Code Quality" | Not in coverage table |
| Rename sections | "Config" instead of "Configuration Loading" | Breaks traceability |
| Merge sections | "Error Handling & Logging" | Each section = one row |
| Use abbreviations | "Bootstrap" instead of "Bootstrap Pattern" | Must match exactly |
| Skip sections | Omitting "RabbitMQ Worker Pattern" | Mark N/A instead |

**Your output table section names MUST match the "Section to Check" column below EXACTLY.**

---

## Why This Pattern Exists

**Problem:** Agents might skip sections from standards files, either by:
- Only checking "main" sections
- Assuming some sections don't apply
- Not enumerating all sections systematically
- Skipping subsections (e.g., checking Dockerfile but skipping Docker Compose)

**Solution:** Require a completeness table that MUST list every section from the WebFetch result with explicit status. All content within each section MUST be evaluated.

---

## MANDATORY: Standards Coverage Table

### ⛔ HARD GATE: Before Outputting Findings

**You MUST output a Standards Coverage Table that enumerates every section from the WebFetch result.**

**REQUIRED: When checking a section, you MUST check all subsections and patterns within it.**

| Section | What MUST Be Checked |
|---------|---------------------|
| Containers | Dockerfile patterns and Docker Compose patterns |
| Infrastructure as Code | Terraform structure and state management and modules |
| Observability | Logging and Tracing (structured JSON logs, OpenTelemetry spans) |
| Security | Secrets management and Network policies |

### Process

1. **Parse the WebFetch result** - Extract all `## Section` headers from the standards file
2. **Count sections** - Record total number of sections found
3. **For each section** - Determine status and evidence
4. **Output table** - MUST have one row per section
5. **Verify completeness** - Table row count MUST equal section count

### Output Format

```markdown
## Standards Coverage Table

**Standards File:** {filename}.md (from WebFetch)
**Total Sections Found:** {N}
**Table Rows:** {N} (MUST match)

| # | Section (from WebFetch) | Status | Evidence |
|---|-------------------------|--------|----------|
| 1 | {Section 1 header} | ✅/⚠️/❌/N/A | file:line or reason |
| 2 | {Section 2 header} | ✅/⚠️/❌/N/A | file:line or reason |
| ... | ... | ... | ... |
| N | {Section N header} | ✅/⚠️/❌/N/A | file:line or reason |

**Completeness Verification:**
- Sections in standards: {N}
- Rows in table: {N}
- Status: ✅ Complete / ❌ Incomplete
```

### Status Legend

| Status | Meaning | When to Use |
|--------|---------|-------------|
| ✅ Compliant | Codebase follows this standard | Code matches expected pattern |
| ⚠️ Partial | Some compliance, needs improvement | Partially implemented or minor gaps |
| ❌ Non-Compliant | Does not follow standard | Missing or incorrect implementation |
| N/A | Not applicable to this codebase | Standard doesn't apply (with reason) |

---

## ⛔ CRITICAL: Standards Boundary Enforcement

**You MUST check only what the standards file explicitly defines. Never invent requirements.**

See [shared-patterns/standards-boundary-enforcement.md](standards-boundary-enforcement.md) for:
- Complete list of what IS and IS not required per agent
- Agent-specific requirement boundaries
- Self-verification checklist

**⛔ HARD GATE:** Before flagging any item as non-compliant:
1. Verify the requirement EXISTS in the WebFetch result
2. Quote the EXACT standard that requires it
3. If you cannot quote it → Do not flag it

---

## Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "I checked the important sections" | You don't decide importance. All sections MUST be checked. | **List every section in table** |
| "Some sections obviously don't apply" | Report them as N/A with reason. Never skip silently. | **Include in table with N/A status** |
| "The table would be too long" | Completeness > brevity. Every section MUST be visible. | **Output full table regardless of length** |
| "I already mentioned these in findings" | Findings ≠ Coverage table. Both are REQUIRED. | **Output table BEFORE detailed findings** |
| "WebFetch result was unclear" | Parse all `## ` headers. If truly unclear, STOP and report blocker. | **Report blocker or parse all headers** |
| "I checked Dockerfile, that covers Containers" | Containers = Dockerfile + Docker Compose. Partial ≠ Complete. | **Check all subsections within each section** |
| "Project doesn't use Docker Compose" | Report as N/A with evidence. Never assume. VERIFY first. | **Search for docker-compose.yml, report finding** |
| "Only checking what exists in codebase" | Standards define what SHOULD exist. Missing = Non-Compliant. | **Report missing patterns as ❌ Non-Compliant** |
| "My section name is clearer" | Consistency > clarity. Coverage table names are the contract. | **Use EXACT names from coverage table** |
| "I combined related sections for brevity" | Each section = one row. Merging loses traceability. | **One row per section, no merging** |
| "I added a useful section like 'Security'" | You don't decide sections. Coverage table does. | **Only output sections from coverage table** |
| "'Logging' is the same as 'Logging Standards'" | Names must match EXACTLY. Variations break automation. | **Use exact string from coverage table** |

---

## Completeness Check (SELF-VERIFICATION)

**Before submitting output, verify:**

```text
1. Did I extract all ## headers from WebFetch result?     [ ]
2. Does my table have exactly that many rows?             [ ]
3. Does every row have a status (✅/⚠️/❌/N/A)?           [ ]
4. Does every ⚠️/❌ have evidence (file:line)?           [ ]
5. Does every N/A have a reason?                         [ ]

If any checkbox is unchecked → FIX before submitting.
```

---

## Integration with Findings

**Order of output:**

1. **Standards Coverage Table** (this pattern) - Shows completeness
2. **Detailed Findings** - Only for ⚠️ Partial and ❌ Non-Compliant items

The Coverage Table ensures nothing is skipped. The Detailed Findings provide actionable information for gaps.

---

## Example Output

```markdown
## Standards Coverage Table

**Standards File:** csharp.md (from WebFetch)
**Total Sections Found:** 24
**Table Rows:** 24 (MUST match)

| # | Section (from WebFetch) | Status | Evidence |
|---|-------------------------|--------|----------|
| 1 | Version | ✅ | .csproj:3 (.NET 8) |
| 2 | Core Dependency: lib-commons-csharp | ✅ | .csproj:5 |
| 3 | Frameworks & Libraries | ✅ | ASP.NET Core, EF Core in .csproj |
| 4 | Configuration | ⚠️ | src/Configuration/AppSettings.cs:12 |
| 5 | Observability | ❌ | Not implemented |
| 6 | Bootstrap | ✅ | src/Program.cs:15 |
| 7 | Access Manager Integration | ✅ | src/Middleware/AuthMiddleware.cs:25 |
| 8 | License Manager Integration | N/A | Not a licensed project |
| 9 | Data Transformation | ✅ | src/Adapters/Postgres/Mapper.cs:8 |
| 10 | Error Codes Convention | ⚠️ | Uses generic codes |
| 11 | Error Handling | ✅ | Consistent Result pattern |
| 12 | Function Design | ✅ | Small methods, clear names |
| 13 | Pagination Patterns | N/A | No list endpoints |
| 14 | Testing | ❌ | No tests found |
| 15 | Logging | ⚠️ | Missing structured fields |
| 16 | Code Analysis | ✅ | .editorconfig present |
| 17 | Architecture Patterns | ✅ | Clean Architecture |
| 18 | Directory Structure | ✅ | Follows QuelitonSouza pattern |
| 19 | Async/Await Patterns | ✅ | CancellationToken propagation |
| 20 | RabbitMQ Worker Pattern | N/A | No message queue |
| 21 | Always-Valid Domain Model | ✅ | Constructor validation |
| 22 | Nullable Reference Types | ✅ | NRT enabled |
| 23 | Dependency Injection | ✅ | Built-in DI |
| 24 | Middleware Pipeline | ✅ | Correct ordering |

**Completeness Verification:**
- Sections in standards: 24
- Rows in table: 24
- Status: ✅ Complete
```

---

## How Agents Reference This Pattern

Agents MUST include this in their Standards Compliance section:

```markdown
## Standards Compliance Output (Conditional)

**Detection:** Prompt contains `**MODE: ANALYSIS only**`

**When triggered, you MUST:**
1. Output Standards Coverage Table per [shared-patterns/standards-coverage-table.md](../skills/shared-patterns/standards-coverage-table.md)
2. Then output detailed findings for ⚠️/❌ items

See [shared-patterns/standards-coverage-table.md](../skills/shared-patterns/standards-coverage-table.md) for:
- Table format
- Status legend
- Anti-rationalization rules
- Completeness verification checklist
```

---

## Agent → Standards Section Index

**IMPORTANT:** When updating a standards file, you MUST also update the corresponding section index below.

**Meta-sections (EXCLUDED from agent checks):**
Standards files may contain these meta-sections that are not counted in section indexes:
- `## Checklist` - Self-verification checklist for developers
- `## Standards Compliance` - Output format examples for agents
- `## Standards Compliance Output Format` - Output templates

These sections describe HOW to use the standards, not WHAT the standards are.

### ring:backend-engineer-csharp → csharp.md

> **Modular expansion:** `csharp.md` is the concise baseline. Deep, task-specific standards live in the
> modular folder `dev-team/docs/standards/csharp/` (16 modules — see `csharp/index.md`). When auditing a
> task that touches caching, idempotency, messaging, multi-tenancy, security/auth, EF migrations, or
> testing, load the matching module from `csharp/` in addition to the sections below.

| # | Section to Check | Anchor | Key Subsections |
|---|------------------|--------|-----------------|
| 1 | Version | `#version` | .NET 8+, C# 12 |
| 2 | Core Dependency: lib-commons-csharp | `#core-dependency-lib-commons-csharp-mandatory` | NuGet foundation package |
| 3 | Frameworks & Libraries | `#frameworks--libraries` | ASP.NET Core, EF Core, Dapper, xUnit, Moq, Serilog, OpenTelemetry |
| 4 | Configuration | `#configuration` | IConfiguration, Options pattern |
| 5 | Observability | `#observability` | OpenTelemetry .NET SDK, ActivitySource |
| 6 | Bootstrap | `#bootstrap` | Program.cs, WebApplication builder |
| 7 | Access Manager Integration | `#access-manager-integration-mandatory` | **CONDITIONAL** - Check if project has auth |
| 8 | License Manager Integration | `#license-manager-integration-mandatory` | **CONDITIONAL** - Check if project is licensed |
| 9 | Data Transformation | `#data-transformation-mandatory` | DTOs, ToEntity/FromEntity patterns |
| 10 | Error Codes Convention | `#error-codes-convention-mandatory` | Service-prefixed codes |
| 11 | Error Handling | `#error-handling` | Result pattern, ProblemDetails |
| 12 | Function Design | `#function-design-mandatory` | Single responsibility |
| 13 | Pagination Patterns | `#pagination-patterns` | Cursor and page-based with IQueryable |
| 14 | Testing | `#testing` | xUnit, Moq, FluentAssertions, edge cases |
| 15 | Logging | `#logging` | Serilog structured logging |
| 16 | Code Analysis | `#code-analysis` | Roslyn analyzers, .editorconfig |
| 17 | Architecture Patterns | `#architecture-patterns` | Clean Architecture |
| 18 | Directory Structure | `#directory-structure` | .NET project structure |
| 19 | Async/Await Patterns | `#asyncawait-patterns` | Task, CancellationToken, Channel |
| 20 | RabbitMQ Worker Pattern | `#rabbitmq-worker-pattern` | MassTransit, BackgroundService |
| 21 | Always-Valid Domain Model | `#always-valid-domain-model-mandatory` | Constructor validation, invariant protection |
| 22 | Nullable Reference Types | `#nullable-reference-types-mandatory` | NRT enforcement, annotations |
| 23 | Dependency Injection | `#dependency-injection-mandatory` | Built-in DI, service lifetimes |
| 24 | Middleware Pipeline | `#middleware-pipeline` | ASP.NET Core middleware ordering |

---

### ring:backend-engineer-csharp → csharp/ (modular standards)

**These modular sections are checked IN ADDITION TO the baseline `csharp.md` sections above** — never as a replacement. When a task touches a capability covered by a module below, every section of that module MUST appear as a row in the coverage table with an explicit status. Conditional modules (**caching**, **idempotency**, **messaging**, **multi-tenant**) are marked `N/A` with a stated reason when the service does not use that capability — never skipped silently. `csharp/index.md` (its "Section Index (Full)") is the maintenance source of truth for this list; keep the two in sync per the FOUR-FILE UPDATE RULE.

**core.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Version | `csharp/core.md#version` |
| 2 | Nullable Reference Types (MANDATORY) | `csharp/core.md#nullable-reference-types-mandatory` |
| 3 | Project Configuration (MANDATORY) | `csharp/core.md#project-configuration-mandatory` |
| 4 | Code Analysis & `.editorconfig` | `csharp/core.md#code-analysis--editorconfig` |
| 5 | Naming Conventions | `csharp/core.md#naming-conventions` |
| 6 | Records, Classes & Structs | `csharp/core.md#records-classes--structs` |
| 7 | Project Layout | `csharp/core.md#project-layout` |
| 8 | Configuration (Options Pattern) (MANDATORY) | `csharp/core.md#configuration-options-pattern-mandatory` |
| 9 | Async/Await Conventions (MANDATORY) | `csharp/core.md#asyncawait-conventions-mandatory` |

**architecture.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Clean Architecture (MANDATORY) | `csharp/architecture.md#clean-architecture-mandatory` |
| 2 | The Dependency Rule (MANDATORY) | `csharp/architecture.md#the-dependency-rule-mandatory` |
| 3 | Hexagonal (Ports & Adapters) | `csharp/architecture.md#hexagonal-ports--adapters` |
| 4 | Directory Structure | `csharp/architecture.md#directory-structure` |
| 5 | Dependency Injection (MANDATORY) | `csharp/architecture.md#dependency-injection-mandatory` |
| 6 | CQRS with MediatR (CONDITIONAL) | `csharp/architecture.md#cqrs-with-mediatr-conditional` |

**api-patterns.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Minimal APIs vs Controllers | `csharp/api-patterns.md#minimal-apis-vs-controllers` |
| 2 | JSON Naming Convention (camelCase) (MANDATORY) | `csharp/api-patterns.md#json-naming-convention-camelcase-mandatory` |
| 3 | ProblemDetails / RFC 7807 (MANDATORY) | `csharp/api-patterns.md#problemdetails--rfc-7807-mandatory` |
| 4 | HTTP Status Code Consistency (MANDATORY) | `csharp/api-patterns.md#http-status-code-consistency-mandatory` |
| 5 | API Versioning (MANDATORY) | `csharp/api-patterns.md#api-versioning-mandatory` |
| 6 | Model Binding & Validation | `csharp/api-patterns.md#model-binding--validation` |
| 7 | Pagination Patterns | `csharp/api-patterns.md#pagination-patterns` |
| 8 | OpenAPI Documentation | `csharp/api-patterns.md#openapi-documentation` |

**domain.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Always-Valid Domain Model (MANDATORY) | `csharp/domain.md#always-valid-domain-model-mandatory` |
| 2 | Value Objects (MANDATORY) | `csharp/domain.md#value-objects-mandatory` |
| 3 | Aggregates & Aggregate Roots | `csharp/domain.md#aggregates--aggregate-roots` |
| 4 | Domain Events | `csharp/domain.md#domain-events` |
| 5 | Error Codes Convention (MANDATORY) | `csharp/domain.md#error-codes-convention-mandatory` |
| 6 | Error Handling: Result Pattern (MANDATORY) | `csharp/domain.md#error-handling-result-pattern-mandatory` |
| 7 | Persistence Transformation (MANDATORY) | `csharp/domain.md#persistence-transformation-mandatory` |

**caching.md** — CONDITIONAL: mark all rows `N/A` (reason: service does not use caching) when no cache provider is configured.

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Cache Provider Selection | `csharp/caching.md#cache-provider-selection` |
| 2 | Caching Strategy Patterns (MANDATORY) | `csharp/caching.md#caching-strategy-patterns-mandatory` |
| 3 | HybridCache (.NET 9+) | `csharp/caching.md#hybridcache-net-9` |
| 4 | Stampede Protection (MANDATORY) | `csharp/caching.md#stampede-protection-mandatory` |
| 5 | Cache Invalidation | `csharp/caching.md#cache-invalidation` |
| 6 | Key Naming and TTL | `csharp/caching.md#key-naming-and-ttl` |
| 7 | Graceful Degradation (MANDATORY) | `csharp/caching.md#graceful-degradation-mandatory` |
| 8 | Anti-Rationalization Table | `csharp/caching.md#anti-rationalization-table` |
| 9 | Checklist | `csharp/caching.md#checklist` |

**idempotency.md** — CONDITIONAL: mark all rows `N/A` (reason: no write APIs requiring idempotency) when the service exposes no idempotent write endpoints.

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Idempotency Patterns (MANDATORY for Write APIs) | `csharp/idempotency.md#idempotency-patterns-mandatory-for-write-apis` |
| 2 | Configuration | `csharp/idempotency.md#configuration` |
| 3 | HTTP Headers | `csharp/idempotency.md#http-headers` |
| 4 | Dedup Store | `csharp/idempotency.md#dedup-store` |
| 5 | Middleware Implementation | `csharp/idempotency.md#middleware-implementation` |
| 6 | Request Flow | `csharp/idempotency.md#request-flow` |
| 7 | Key Scope (Ask Before Implementing) | `csharp/idempotency.md#key-scope-ask-before-implementing` |
| 8 | Which Endpoints Need Idempotency | `csharp/idempotency.md#which-endpoints-need-idempotency` |
| 9 | Anti-Rationalization Table | `csharp/idempotency.md#anti-rationalization-table` |
| 10 | Checklist | `csharp/idempotency.md#checklist` |

**messaging.md** — CONDITIONAL: mark all rows `N/A` (reason: no async messaging / message broker) when the service uses no MassTransit / RabbitMQ / Azure Service Bus.

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Transport Selection | `csharp/messaging.md#transport-selection` |
| 2 | Bus Configuration | `csharp/messaging.md#bus-configuration` |
| 3 | Message Contracts | `csharp/messaging.md#message-contracts` |
| 4 | Consumers | `csharp/messaging.md#consumers` |
| 5 | Producers (Publish vs Send) | `csharp/messaging.md#producers-publish-vs-send` |
| 6 | Retry, Redelivery, and DLQ (MANDATORY) | `csharp/messaging.md#retry-redelivery-and-dlq-mandatory` |
| 7 | Transactional Outbox (MANDATORY for dual writes) | `csharp/messaging.md#transactional-outbox-mandatory-for-dual-writes` |
| 8 | Observability | `csharp/messaging.md#observability` |
| 9 | Anti-Rationalization Table | `csharp/messaging.md#anti-rationalization-table` |
| 10 | Checklist | `csharp/messaging.md#checklist` |

**multi-tenant.md** — CONDITIONAL: mark all rows `N/A` (reason: single-tenant service) when the service is not multi-tenant.

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | When to Use Multi-Tenancy (CONDITIONAL) | `csharp/multi-tenant.md#when-to-use-multi-tenancy-conditional` |
| 2 | Isolation Strategies | `csharp/multi-tenant.md#isolation-strategies` |
| 3 | Tenant Context | `csharp/multi-tenant.md#tenant-context` |
| 4 | Tenant Resolution Middleware (MANDATORY) | `csharp/multi-tenant.md#tenant-resolution-middleware-mandatory` |
| 5 | Auth-Before-Tenant Ordering (MANDATORY) | `csharp/multi-tenant.md#auth-before-tenant-ordering-mandatory` |
| 6 | EF Core Global Query Filters | `csharp/multi-tenant.md#ef-core-global-query-filters` |
| 7 | Per-Tenant Connection Strings | `csharp/multi-tenant.md#per-tenant-connection-strings` |
| 8 | Tenant-Aware Caching | `csharp/multi-tenant.md#tenant-aware-caching` |
| 9 | Tenant Propagation in Messaging | `csharp/multi-tenant.md#tenant-propagation-in-messaging` |
| 10 | Anti-Rationalization Table | `csharp/multi-tenant.md#anti-rationalization-table` |
| 11 | Checklist | `csharp/multi-tenant.md#checklist` |

**security.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Authentication (JWT Bearer / OIDC) (MANDATORY) | `csharp/security.md#authentication-jwt-bearer--oidc-mandatory` |
| 2 | Authorization (Policies & Roles) (MANDATORY) | `csharp/security.md#authorization-policies--roles-mandatory` |
| 3 | Secret Management (MANDATORY) | `csharp/security.md#secret-management-mandatory` |
| 4 | Secret Redaction in Logs (MANDATORY) | `csharp/security.md#secret-redaction-in-logs-mandatory` |
| 5 | SQL Safety (MANDATORY) | `csharp/security.md#sql-safety-mandatory` |
| 6 | Input Validation (MANDATORY) | `csharp/security.md#input-validation-mandatory` |
| 7 | Security Headers (MANDATORY) | `csharp/security.md#security-headers-mandatory` |
| 8 | Rate Limiting (MANDATORY) | `csharp/security.md#rate-limiting-mandatory` |
| 9 | CORS Configuration (MANDATORY) | `csharp/security.md#cors-configuration-mandatory` |
| 10 | Data Protection (MANDATORY) | `csharp/security.md#data-protection-mandatory` |

**bootstrap.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Program.cs Initialization Order (MANDATORY) | `csharp/bootstrap.md#programcs-initialization-order-mandatory` |
| 2 | Configuration & Options Pattern (MANDATORY) | `csharp/bootstrap.md#configuration--options-pattern-mandatory` |
| 3 | Dependency Injection (MANDATORY) | `csharp/bootstrap.md#dependency-injection-mandatory` |
| 4 | Structured Logging (MANDATORY) | `csharp/bootstrap.md#structured-logging-mandatory` |
| 5 | OpenTelemetry (Traces, Metrics, Logs) (MANDATORY) | `csharp/bootstrap.md#opentelemetry-traces-metrics-logs-mandatory` |
| 6 | Health Checks (MANDATORY) | `csharp/bootstrap.md#health-checks-mandatory` |
| 7 | Connection Management (MANDATORY) | `csharp/bootstrap.md#connection-management-mandatory` |
| 8 | Graceful Shutdown (MANDATORY) | `csharp/bootstrap.md#graceful-shutdown-mandatory` |

**migration-safety.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Principles | `csharp/migration-safety.md#principles` |
| 2 | Dangerous Operations Detection | `csharp/migration-safety.md#dangerous-operations-detection` |
| 3 | Expand-Contract Pattern (MANDATORY) | `csharp/migration-safety.md#expand-contract-pattern-mandatory` |
| 4 | Reviewing Generated Migrations (MANDATORY) | `csharp/migration-safety.md#reviewing-generated-migrations-mandatory` |
| 5 | ACKNOWLEDGE Convention | `csharp/migration-safety.md#acknowledge-convention` |
| 6 | Multi-Tenant Considerations | `csharp/migration-safety.md#multi-tenant-considerations` |
| 7 | Verification Commands | `csharp/migration-safety.md#verification-commands` |

**quality.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Build Quality Gates (MANDATORY) | `csharp/quality.md#build-quality-gates-mandatory` |
| 2 | Roslyn Analyzers (MANDATORY) | `csharp/quality.md#roslyn-analyzers-mandatory` |
| 3 | .editorconfig & StyleCop (MANDATORY) | `csharp/quality.md#editorconfig--stylecop-mandatory` |
| 4 | Forbidden Runtime Patterns (CRITICAL) | `csharp/quality.md#forbidden-runtime-patterns-critical` |
| 5 | Startup Configuration Validation (MANDATORY) | `csharp/quality.md#startup-configuration-validation-mandatory` |
| 6 | Code Coverage (MANDATORY) | `csharp/quality.md#code-coverage-mandatory` |
| 7 | Container Security (CONDITIONAL) | `csharp/quality.md#container-security-conditional` |

**compliance.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Module Map | `csharp/compliance.md#module-map` |
| 2 | Standards Compliance Output Format | `csharp/compliance.md#standards-compliance-output-format` |
| 3 | Master Checklist | `csharp/compliance.md#master-checklist` |

**testing-unit.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Test Framework & Libraries (MANDATORY) | `csharp/testing-unit.md#test-framework--libraries-mandatory` |
| 2 | AAA Pattern (MANDATORY) | `csharp/testing-unit.md#aaa-pattern-mandatory` |
| 3 | Test Naming Convention (MANDATORY) | `csharp/testing-unit.md#test-naming-convention-mandatory` |
| 4 | Theory / InlineData / MemberData (MANDATORY) | `csharp/testing-unit.md#theory--inlinedata--memberdata-mandatory` |
| 5 | Edge Case Coverage (MANDATORY) | `csharp/testing-unit.md#edge-case-coverage-mandatory` |
| 6 | Assertion Requirements (MANDATORY) | `csharp/testing-unit.md#assertion-requirements-mandatory` |
| 7 | Mocking (MANDATORY) | `csharp/testing-unit.md#mocking-mandatory` |
| 8 | Async Test Patterns (MANDATORY) | `csharp/testing-unit.md#async-test-patterns-mandatory` |
| 9 | Coverage Threshold (MANDATORY) | `csharp/testing-unit.md#coverage-threshold-mandatory` |
| 10 | Unit Test Scope & Boundaries (MANDATORY) | `csharp/testing-unit.md#unit-test-scope--boundaries-mandatory` |
| 11 | TDD RED → GREEN (MANDATORY) | `csharp/testing-unit.md#tdd-red--green-mandatory` |
| 12 | Unit Test Quality Gate (MANDATORY) | `csharp/testing-unit.md#unit-test-quality-gate-mandatory` |
| 13 | Output Format (Gate 0 - Unit Testing) | `csharp/testing-unit.md#output-format-gate-0---unit-testing` |
| 14 | Anti-Rationalization Table (Unit Testing) | `csharp/testing-unit.md#anti-rationalization-table-unit-testing` |

**testing-integration.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Test Pyramid | `csharp/testing-integration.md#test-pyramid` |
| 2 | Project & Naming Convention (MANDATORY) | `csharp/testing-integration.md#project--naming-convention-mandatory` |
| 3 | WebApplicationFactory (MANDATORY) | `csharp/testing-integration.md#webapplicationfactory-mandatory` |
| 4 | Testcontainers for .NET (MANDATORY) | `csharp/testing-integration.md#testcontainers-for-net-mandatory` |
| 5 | Shared Fixtures & Collections (MANDATORY) | `csharp/testing-integration.md#shared-fixtures--collections-mandatory` |
| 6 | Test Isolation (MANDATORY) | `csharp/testing-integration.md#test-isolation-mandatory` |
| 7 | Fixture Centralization (MANDATORY) | `csharp/testing-integration.md#fixture-centralization-mandatory` |
| 8 | Guardrails (Anti-Patterns) (MANDATORY) | `csharp/testing-integration.md#guardrails-anti-patterns-mandatory` |
| 9 | Test Failure Analysis (No Greenwashing) | `csharp/testing-integration.md#test-failure-analysis-no-greenwashing` |
| 10 | Integration Test Quality Gate (MANDATORY) | `csharp/testing-integration.md#integration-test-quality-gate-mandatory` |
| 11 | Output Format (Gate 0 - Integration Testing) | `csharp/testing-integration.md#output-format-gate-0---integration-testing` |
| 12 | Anti-Rationalization Table (Integration Testing) | `csharp/testing-integration.md#anti-rationalization-table-integration-testing` |

**testing-property.md**

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | What Is Property-Based Testing | `csharp/testing-property.md#what-is-property-based-testing` |
| 2 | Library & Setup (MANDATORY) | `csharp/testing-property.md#library--setup-mandatory` |
| 3 | Property Test Pattern (MANDATORY) | `csharp/testing-property.md#property-test-pattern-mandatory` |
| 4 | Common Properties | `csharp/testing-property.md#common-properties` |
| 5 | Custom Generators & Arbitraries | `csharp/testing-property.md#custom-generators--arbitraries` |
| 6 | Property Test Quality Gate (MANDATORY) | `csharp/testing-property.md#property-test-quality-gate-mandatory` |
| 7 | Output Format (Gate 0 - Property-Based Testing) | `csharp/testing-property.md#output-format-gate-0---property-based-testing` |
| 8 | Anti-Rationalization Table (Property Testing) | `csharp/testing-property.md#anti-rationalization-table-property-testing` |

---

### ring:backend-engineer-typescript → typescript.md

| # | Section to Check | Anchor | Key Subsections |
|---|------------------|--------|-----------------|
| 1 | Version | `#version` | TypeScript 5.0+, Node.js 20+ |
| 2 | Strict Configuration | `#strict-configuration-mandatory` | tsconfig.json strict mode |
| 3 | Frameworks & Libraries | `#frameworks--libraries` | Express, Fastify, NestJS, Prisma, Zod, Vitest |
| 4 | Type Safety | `#type-safety` | No any, branded types, discriminated unions |
| 5 | Zod Validation Patterns | `#zod-validation-patterns` | Schema validation |
| 6 | Dependency Injection | `#dependency-injection` | TSyringe patterns |
| 7 | AsyncLocalStorage for Context | `#asynclocalstorage-for-context` | Request context propagation |
| 8 | Testing | `#testing` | Type-safe mocks, fixtures, edge cases |
| 9 | Error Handling | `#error-handling` | Custom error classes |
| 10 | Function Design | `#function-design-mandatory` | Single responsibility |
| 11 | Naming Conventions | `#naming-conventions` | Files, interfaces, types |
| 12 | Directory Structure | `#directory-structure` | QuelitonSouza pattern |
| 13 | RabbitMQ Worker Pattern | `#rabbitmq-worker-pattern` | Async message processing |
| 14 | Always-Valid Domain Model | `#always-valid-domain-model-mandatory` | Constructor validation, invariant protection |

---

### frontend-bff-engineer-typescript → typescript.md

**Same sections as ring:backend-engineer-typescript (14 sections).** See above.

---

### ring:frontend-engineer → frontend.md

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Framework | `#framework` |
| 2 | Libraries & Tools | `#libraries--tools` |
| 3 | State Management Patterns | `#state-management-patterns` |
| 4 | Form Patterns | `#form-patterns` |
| 5 | Styling Standards | `#styling-standards` |
| 6 | Typography Standards | `#typography-standards` |
| 7 | Animation Standards | `#animation-standards` |
| 8 | Component Patterns | `#component-patterns` |
| 9 | Accessibility | `#accessibility` |
| 10 | Performance | `#performance` |
| 11 | Directory Structure | `#directory-structure` |
| 12 | Forbidden Patterns | `#forbidden-patterns` |
| 13 | Standards Compliance Categories | `#standards-compliance-categories` |

---

### ring:frontend-designer → frontend.md

**Same sections as ring:frontend-engineer (13 sections).** See above.

---

### ring:devops-engineer → devops.md

| # | Section to Check | Subsections (all REQUIRED) |
|---|------------------|---------------------------|
| 1 | Cloud Provider (MANDATORY) | Provider table |
| 2 | Infrastructure as Code (MANDATORY) | Terraform structure, State management, Module pattern, Best practices |
| 3 | Containers (MANDATORY) | **Dockerfile patterns, Docker Compose (Local Dev), .env file**, Image guidelines |
| 4 | Helm (MANDATORY) | Chart structure, Chart.yaml, values.yaml |
| 5 | Observability (MANDATORY) | Logging (Structured JSON), Tracing (OpenTelemetry) |
| 6 | Security (MANDATORY) | Secrets management, Network policies |
| 7 | Makefile Standards (MANDATORY) | Required commands (build, lint, test, cover, up, down, etc.), Component delegation pattern |

**⛔ HARD GATE:** When checking "Containers", you MUST verify BOTH Dockerfile and Docker Compose patterns. Checking only one = INCOMPLETE.

**⛔ HARD GATE:** When checking "Makefile Standards", you MUST verify all required commands exist: `build`, `lint`, `test`, `cover`, `up`, `down`, `start`, `stop`, `restart`, `rebuild-up`, `set-env`, `generate-docs`.

---

### ring:sre → sre.md

| # | Section to Check | Anchor |
|---|------------------|--------|
| 1 | Observability | `#observability` |
| 2 | Logging | `#logging` |
| 3 | Tracing | `#tracing` |
| 4 | OpenTelemetry with lib-commons | `#opentelemetry-with-lib-commons-mandatory-for-go` |
| 5 | Structured Logging with lib-common-js | `#structured-logging-with-lib-common-js-mandatory-for-typescript` |
| 6 | Health Checks | `#health-checks` |

---

### ring:qa-analyst → csharp.md or typescript.md

**Note:** ring:qa-analyst checks testing-related sections based on project language.

**For C# projects:**
| # | Section to Check |
|---|------------------|
| 1 | Testing (MANDATORY) |
| 2 | Edge Case Coverage (MANDATORY) |
| 3 | Test Naming Convention (MANDATORY) |
| 4 | Code Analysis (MANDATORY) |

**For TypeScript projects:**
| # | Section to Check |
|---|------------------|
| 1 | Testing Patterns (MANDATORY) |
| 2 | Edge Case Coverage (MANDATORY) |
| 3 | Type Safety Rules (MANDATORY) |

**Test Quality Gate Checks (Gate 3 Exit - all REQUIRED):**
| # | Check | Detection |
|---|-------|-----------|
| 1 | Skipped tests | `grep -rn "\.skip\|\.todo\|xit"` = 0 |
| 2 | Assertion-less tests | All tests have expect/assert |
| 3 | Shared state | No beforeAll DB/state mutation |
| 4 | Edge cases | ≥2 per acceptance criterion |
| 5 | TDD evidence | RED phase captured |
| 6 | Test isolation | No order dependency |

---

## Maintenance Instructions

**When you add/modify a section in a standards file:**

1. Edit `dev-team/docs/standards/{file}.md` - Add your new `## Section Name`
2. Edit THIS file - Add the section to the corresponding agent table above
3. Verify row count matches section count

**Anti-Rationalization:**

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "I'll update the index later" | Later = never. Sync drift causes missed checks. | **Update BOTH files in same commit** |
| "The section is minor" | Minor ≠ optional. All sections must be indexed. | **Add to index regardless of size** |
| "Agents parse dynamically anyway" | Index is the explicit contract. Dynamic is backup. | **Index is source of truth** |
