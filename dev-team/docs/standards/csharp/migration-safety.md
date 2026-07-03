# C# Standards - Migration Safety

> **Module:** migration-safety.md | **Parent:** [index.md](index.md)

This module covers Entity Framework Core migration safety. All schema changes MUST be
backward-compatible and safe for zero-downtime rolling deployments. A bad migration can lock tables,
lose data, or break other services that share the schema.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards. Ring
> standards are the baseline; `PROJECT_RULES.md` may add rules but must not weaken these.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Principles](#principles) | Core migration safety rules |
| 2 | [Dangerous Operations](#dangerous-operations-detection) | Operations requiring special handling |
| 3 | [Expand-Contract Pattern](#expand-contract-pattern-mandatory) | Safe multi-deploy schema evolution |
| 4 | [Reviewing Generated Migrations](#reviewing-generated-migrations-mandatory) | Inspecting the `Up`/`Down` before merge |
| 5 | [ACKNOWLEDGE Convention](#acknowledge-convention) | Opting into an intentional breaking change |
| 6 | [Multi-Tenant Considerations](#multi-tenant-considerations) | Migrations that run per tenant |
| 7 | [Verification Commands](#verification-commands) | Automated pre-merge checks |

---

## Principles

Database migrations in production systems carry disproportionate risk. A bad migration can:
- Lock tables for minutes, blocking all traffic
- Cause data loss if a column is dropped prematurely
- Break the previous app version during a rolling deploy (new + old run simultaneously)
- Multiply impact in multi-tenant mode (runs once per tenant)

### Core Rules

1. **Backward-compatible.** The *previous* app version MUST keep working after the migration applies.
   Rolling deploys run old and new code against the new schema at the same time.
2. **Idempotent / re-runnable.** Prefer `IF NOT EXISTS` / `IF EXISTS` semantics for raw SQL,
   critical when the migration runs per tenant.
3. **Reversible.** Every migration MUST have a working `Down` method. Rollback is not optional.
4. **One logical change per migration.** Do not bundle unrelated schema changes.
5. **Migrations are applied by a controlled step**, not by `context.Database.EnsureCreated()` and not
   silently at app startup in production (see below).

### Applying Migrations

```csharp
// FORBIDDEN in production: implicit auto-migrate on every app start (race across replicas,
// no control over timing, cannot gate on safety review)
app.Services.GetRequiredService<AppDbContext>().Database.Migrate(); // don't do this in prod startup

// CORRECT: generate an idempotent SQL script in CI and apply it as a discrete deploy step
//   dotnet ef migrations script --idempotent --output migrations.sql
// then run migrations.sql via your deploy pipeline (single runner, before rolling out new pods)
```

---

## Dangerous Operations Detection

The following EF Core operations map to SQL that is dangerous in production.

### BLOCKING Operations (must be rewritten or expand-contracted)

| EF Core / SQL Operation | Risk | Safe Alternative |
|-------------------------|------|------------------|
| `AddColumn(nullable: false)` without `defaultValue` | Table rewrite + `ACCESS EXCLUSIVE` lock | Add nullable, backfill, then add the NOT NULL constraint |
| `DropColumn` | Breaks any app version still reading it | Expand-contract: stop reading → deploy → drop in a later migration |
| `AlterColumn` changing type | Table rewrite | Add a new column, migrate data, drop the old one |
| `DropTable` | Data loss, breaks dependents | Rename to `_deprecated_YYYYMMDD` first, drop in a later release |
| `RenameColumn` / `RenameTable` | Old app version breaks immediately | Expand-contract (add new, dual-write, drop old) |
| `CreateIndex` on a large table (non-concurrent) | Blocks writes for the build duration | Create the index `CONCURRENTLY` via raw SQL (see below) |

### WARNING Operations (review before merge)

| Operation | Risk | Recommendation |
|-----------|------|----------------|
| `AddColumn` with `defaultValue` | Metadata-only on PostgreSQL 11+ / SQL Server, but verify version | Confirm the target engine supports a metadata-only default |
| Large data backfill inside a migration | Long-running row locks | Batch updates (1,000–5,000 rows per transaction), or backfill from application code |

### Concurrent Index Creation (PostgreSQL)

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction, and EF wraps each migration in one. Use a
raw SQL migration with the transaction suppressed:

```csharp
public partial class AddTransactionsIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // suppressTransaction: true is REQUIRED — CONCURRENTLY cannot run in a transaction
        migrationBuilder.Sql(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transactions_tenant_date " +
            "ON transactions (tenant_id, created_at);",
            suppressTransaction: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_transactions_tenant_date;",
            suppressTransaction: true);
    }
}
```

---

## Expand-Contract Pattern (MANDATORY)

Any change that modifies an existing column or table MUST be split across separate deployments.

### Phase 1 — Expand (Migration N, Deploy 1)
- Add the new column/table alongside the old one; the new column is **nullable**.
- The application writes to **both** old and new; reads from **old** (still backward-compatible).

### Phase 2 — Migrate (Migration N+1, Deploy 2)
- Backfill the new column from the old data (batched).
- The application reads from **new**, still writes to **both**. Verify consistency.

### Phase 3 — Contract (Migration N+2, Deploy 3)
- Stop writing to the old column; add `NOT NULL` now that every row is populated.
- Drop the old column in this (or a later) migration.

**Never combine expand and contract in one migration or one PR** — each phase must be independently
deployable and rollbackable.

### Example: Renaming `Name` → `AccountName`

```csharp
// Migration 1 (Deploy 1): EXPAND — add nullable column, backfill
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>("account_name", "accounts", nullable: true, maxLength: 255);
    migrationBuilder.Sql("UPDATE accounts SET account_name = name WHERE account_name IS NULL;");
    // App now writes both name + account_name, reads account_name.
}

// Migration 2 (Deploy 2, separate PR): CONTRACT — enforce + drop old
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AlterColumn<string>("account_name", "accounts", nullable: false, maxLength: 255);
    // -- ACKNOWLEDGE: contract phase; expand (add account_name) deployed in PR #1234, consumers migrated.
    migrationBuilder.DropColumn("name", "accounts");
}
```

---

## Reviewing Generated Migrations (MANDATORY)

EF Core scaffolds migrations; you **MUST** read the generated `Up`/`Down` before merging. Scaffolding
routinely produces `DropColumn`, `AlterColumn`, or non-concurrent `CreateIndex` that are unsafe.

```bash
# Generate the migration
dotnet ef migrations add AddAccountName

# REVIEW the generated file under Migrations/ — check both Up and Down.
# Generate the idempotent script that will actually run in production and inspect it:
dotnet ef migrations script --idempotent --output migrations.sql
```

Checklist while reviewing the generated file:
- Does `Up` contain any BLOCKING operation above? If so, rewrite as expand-contract or use raw SQL.
- Is there a real `Down` (not empty, not `throw`)? Rollback must work.
- Are large tables getting a non-concurrent index? Convert to `CONCURRENTLY` raw SQL.

---

## ACKNOWLEDGE Convention

Some BLOCKING operations are legitimate in the correct expand-contract sequence (e.g. a contract-phase
`DropColumn` after the expand phase already shipped). Because a reviewer cannot distinguish an
intentional contract from an accidental destructive change, the author MUST state intent inline.

### Syntax

Place an SQL/C# comment on the line immediately above the dangerous statement:

```csharp
// ACKNOWLEDGE: <rationale>
```

- The comment MUST be on the line directly preceding the operation (no blank line between).
- `<rationale>` MUST be a real, human-readable explanation. Empty rationale is treated as missing.

### When It Applies

| Finding | ACKNOWLEDGE Appropriate When |
|---------|------------------------------|
| `DropColumn` | Contract phase, after the expand phase deployed in a prior PR and consumers migrated |
| `AlterColumn` type change on a large table | No expand-contract possible; a maintenance window / streaming migration is planned |

Findings with a safe alternative (non-concurrent `CreateIndex`, `AddColumn NOT NULL` without default,
`DropTable`, `TRUNCATE`) **cannot** be acknowledged away — rewrite them.

### Example

```csharp
// ACKNOWLEDGE: contract phase of expand-contract. Expand (add account_name) deployed in PR #1234
// on 2026-03-01; consumers migrated by 2026-04-01.
migrationBuilder.DropColumn("name", "accounts");
```

### Fail-Safe Default

No comment = BLOCKING. The absence of a comment is never read as approval. Intent MUST live in the
migration file itself, because only the file travels with the migration into every downstream tool.

---

## Multi-Tenant Considerations

In multi-tenant deployments (schema-per-tenant or database-per-tenant), a migration runs once per
tenant. This amplifies every risk.

| Single-Tenant Risk | Multi-Tenant Risk |
|--------------------|--------------------|
| 30 s table lock | 30 s lock × N tenants |
| Failed migration → roll back 1 DB | Partial state across N DBs |
| Index build blocks writes | Blocks writes for each tenant sequentially |

### Rules

1. **Idempotent.** If the run fails on tenant 5 of 20, re-running MUST safely skip tenants 1–4. Use
   `IF NOT EXISTS` / `IF EXISTS` in raw SQL.
2. **Per-tenant statement timeout** so one tenant's huge table cannot block the whole rollout.
3. **Log per-tenant progress** so partial failures are debuggable.

```csharp
// Idempotent raw SQL — safe to re-run per tenant
migrationBuilder.Sql(
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tx_tenant_date ON transactions (tenant_id, created_at);",
    suppressTransaction: true);
```

---

## Verification Commands

Run before merging any PR that adds an EF Core migration.

```bash
# 1. Locate new migration files on this branch
git diff --name-only origin/main -- '**/Migrations/*.cs' 'migrations*.sql'

# 2. Flag BLOCKING operations in generated migrations
grep -Ern "DropColumn|DropTable|\.AlterColumn" --include="*.cs" ./ | grep -i Migrations
grep -Ern "CreateIndex" --include="*.cs" ./ | grep -i Migrations   # verify large tables use CONCURRENTLY raw SQL

# 3. Flag AddColumn NOT NULL without a default
grep -Ern "AddColumn.*nullable: false" --include="*.cs" ./ | grep -iv "defaultValue"

# 4. Confirm a non-empty Down exists for each migration (no throw/empty body)
grep -Ern "protected override void Down" --include="*.cs" ./ -A2 | grep -i "NotImplemented\|throw"

# Expected: BLOCKING matches are either rewritten (expand-contract / CONCURRENTLY) or carry an
# ACKNOWLEDGE comment. Any Down that throws/NotImplemented is a failure.
```

---

## Anti-Rationalization Table

| Excuse | Why It's Wrong | Required Action |
|--------|----------------|-----------------|
| "The table is small" | Tables grow; today's small table is next quarter's large one. | **Apply safe patterns regardless of size** |
| "We can take a maintenance window" | Zero-downtime is the standard for SaaS. | **Use expand-contract** |
| "The Down is trivial, skip testing it" | Untested rollbacks fail when you need them most. | **Write and test Down** |
| "EF generated it, so it's fine" | Scaffolding emits unsafe drops/alters routinely. | **Review the generated Up/Down** |
| "Nobody reads that column" | Other services/views may; the old app version does during rollout. | **Expand-contract: deprecate first** |
| "Auto-migrate on startup is convenient" | Races across replicas, no safety gate. | **Apply an idempotent script as a deploy step** |
| "Multi-tenant just runs it N times" | N × risk, and partial failure is a debugging nightmare. | **Ensure idempotency** |

---

## Checklist

Before submitting an EF Core migration, verify:

- [ ] Generated `Up`/`Down` reviewed by hand; no unexpected `DropColumn`/`AlterColumn`
- [ ] No `AddColumn(nullable: false)` without a `defaultValue`
- [ ] No non-concurrent `CreateIndex` on large tables (use `CONCURRENTLY` + `suppressTransaction: true`)
- [ ] No `DropTable`/`DropColumn` outside a documented expand-contract sequence
- [ ] A working, non-empty `Down` exists
- [ ] Column/table modifications follow expand-contract across separate deploys
- [ ] Multi-tenant: raw SQL uses `IF NOT EXISTS` / `IF EXISTS`; per-tenant progress logged
- [ ] Migrations applied via an idempotent script deploy step, not startup auto-migrate in production
- [ ] Any legitimately-BLOCKING contract operation carries an `ACKNOWLEDGE` comment with rationale
