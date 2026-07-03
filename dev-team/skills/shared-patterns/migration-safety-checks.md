# Migration Safety Checks (MANDATORY for Gate 0.5D)

**⛔ MIGRATION SAFETY (MANDATORY when schema migration files are present):**

See [migration-safety.md](../../docs/standards/csharp/migration-safety.md) for the complete standard including the expand-contract pattern, multi-tenant considerations, and anti-rationalization table.

**Home:** These checks are executed by the running-dev-cycle skill (Step 12.0.5b) — Gate 0.5D, a post-cycle conditional gate that runs once per cycle when schema migration files are present in the diff against `origin/main`.

## When This Applies

This check ONLY runs when the current branch contains new or modified schema migration files compared to the base branch (main/develop). Migrations may be EF Core migrations (`Migrations/*.cs` with `Up()`/`Down()` methods) or raw SQL scripts (`**/*.sql`). If no migration files are detected, this check is automatically skipped.

Detection:
```bash
# EF Core migrations (C# migration classes) + raw SQL scripts
git diff --name-only origin/main -- '**/Migrations/*.cs' '**/migrations/*.sql' '**/*.sql' 2>/dev/null | grep -v -i "test"
```

## What Gets Checked

The patterns below describe the underlying SQL emitted by an EF Core migration (`migrationBuilder.Sql(...)`, `AddColumn`, `DropColumn`, `CreateIndex`, `AlterColumn`, etc.) or written directly in a raw SQL script. Provider notes cover both **PostgreSQL** and **SQL Server**.

### BLOCKING (returns to Gate 0)
| Pattern | Risk | Required Fix |
|---------|------|-------------|
| `AddColumn`/`ADD COLUMN ... NOT NULL` without a default | Table rewrite; ACCESS EXCLUSIVE lock (PostgreSQL) / schema-modification lock (SQL Server) | Add as nullable → backfill → add the NOT NULL constraint in a later migration |
| `DropColumn`/`DROP COLUMN` | Breaks services still reading the column | Expand-contract: deprecate first, drop in a later release |
| `DropTable`/`DROP TABLE` | Data loss | Rename to `_deprecated_YYYYMMDD` first |
| `TRUNCATE TABLE` | Data loss | Never in production migrations |
| `CreateIndex` on a large table without an online/concurrent option | Write-blocking lock | PostgreSQL: `CREATE INDEX CONCURRENTLY`. SQL Server: `WITH (ONLINE = ON)` (Enterprise) or schedule off-peak |
| `AlterColumn`/`ALTER COLUMN TYPE` | Table rewrite | Add new column, migrate data, drop old (expand-contract) |
| Missing `Down()` implementation (EF Core) / missing `.down.sql` | Cannot roll back | Implement the `Down()` method / create the matching DOWN script |
| Empty `Down()` / empty DOWN script | Rollback will silently do nothing | Write the actual rollback SQL/`migrationBuilder` calls |

### WARNING (flags but does not block)
| Pattern | Risk | Recommendation |
|---------|------|----------------|
| DDL without `IF NOT EXISTS`/`IF EXISTS` in raw SQL | Not idempotent for multi-tenant re-runs | Add conditional DDL (or rely on EF Core's per-schema history table for tenant isolation) |
| Large `UPDATE` without batching | Row/page locks on large tables | Batch in 1000-5000 row increments |
| `dotnet ef database update` invoked at app startup without a migration lock | Concurrent instances racing the migration | Gate migrations behind a single-runner/leader step in the deploy pipeline |

## Anti-Rationalization

| Excuse | Response |
|--------|----------|
| "The table is small" | Tables grow. Apply safe patterns regardless. |
| "We'll do a maintenance window" | Zero-downtime is the standard for SaaS. |
| "The Down() migration is trivial" | Untested rollbacks fail when needed most. Write it. |
| "CONCURRENTLY / ONLINE is slower" | 2x slower without blocking writes > fast with blocking writes. |
| "Nobody reads this column" | You don't know that. Deprecate first, drop later. |
| "EF Core generates the migration, so it's safe" | Scaffolded migrations reflect the model diff, not operational safety. Review the emitted `Up()`/SQL against this table before merging. |
