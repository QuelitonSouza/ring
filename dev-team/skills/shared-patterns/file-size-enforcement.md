# File Size Enforcement (MANDATORY)

## Standard Reference

**Source:** `csharp/domain.md` → File Organization (MANDATORY), `typescript.md` → File Organization (MANDATORY)

**Rule:** Max 1000 lines per file (soft limit). Files exceeding 1500 lines are hard-blocked.

**Cohesion judgment (applies before splitting):** File size is a proxy for cognitive load, not a rule in itself. Before splitting, ask: does this file represent a single cohesive concern (state machine, parser, schema definition, table-driven tests, tightly-coupled domain logic)? If splitting would require inventing artificial boundaries or creating import gymnastics between the parts, keep it together. Splits must reduce cognitive load, not just line count.

**Enforcement bands:**
- ≤ 1000 lines: no action
- 1001–1500 lines: examine with cohesion judgment. If coherent → keep. If fragmentable without artificial boundaries → split.
- > 1500 lines: HARD BLOCK unless explicit cohesion justification is documented in the PR description.

This is a **HARD GATE** — not a suggestion.

---

## Thresholds

| Lines | Action |
|-------|--------|
| ≤ 1000 | ✅ Compliant — no action |
| 1001-1500 | ⚠️ EXAMINE — apply cohesion judgment. Coherent → keep. Fragmentable without artificial boundaries → split. |
| > 1500 | ❌ HARD BLOCK — split required unless explicit cohesion justification is documented in the PR description |

**These thresholds apply to ALL source files** (`*.cs`, `*.ts`, `*.tsx`) **including test files**. Auto-generated files (OpenAPI/Swagger clients, EF Core migrations scaffolds, source-generated code, `*.g.cs`, `*.Designer.cs`, `*.generated.cs`, `*.gen.ts`, `*.generated.ts`, `*.d.ts`) are exempt.

**Gate 0 enforcement:** Any non-exempt file > 1500 lines after implementation = hard block (loop back to agent). Files in the 1001-1500 band require cohesion review — keep if coherent, split if fragmentable without artificial boundaries.

---

## When to Check

| Context | Check Point |
|---------|-------------|
| **running-dev-cycle Gate 0** | After implementation agent completes — verify no file exceeds 1500 lines; 1001-1500 = cohesion review; >1500 = hard block. The Delivery Verification Exit Check (implementing-tasks) MUST run file-size verification. |
| **running-dev-cycle Gate 8** | Code reviewers MUST flag any file > 1000 lines as a MEDIUM+ issue (apply cohesion judgment); files > 1500 lines are CRITICAL. |
| **planning-backend-refactor Step 4** | Agents MUST flag files > 1000 lines as ISSUE-XXX (HIGH; cohesion override allowed). Files > 1500 lines = CRITICAL. |
| **implementing-tasks** | Agent MUST NOT create files > 1500 lines. Files in the 1001-1500 band require cohesion justification or proactive split. |

---

## Verification Commands

```bash
# C#/.NET projects — excludes tests, generated, designer, and scaffolded files
# Note: awk filters out the "total" row emitted by wc when multiple files are counted
# Threshold 1000 is the soft limit; apply cohesion judgment to 1001-1500 band; >1500 = hard block.
find . -name "*.cs" \
  ! -name "*Tests.cs" \
  ! -name "*.Designer.cs" \
  ! -name "*.g.cs" \
  ! -name "*.generated.cs" \
  ! -path "*/bin/*" \
  ! -path "*/obj/*" \
  ! -path "*/Migrations/*" \
  -exec wc -l {} + | awk '$1 > 1000 && $NF != "total" {print}' | sort -rn

# C# test files (checked separately — same 1000-line soft limit)
find . -name "*Tests.cs" \
  ! -path "*/bin/*" \
  ! -path "*/obj/*" \
  -exec wc -l {} + | awk '$1 > 1000 && $NF != "total" {print}' | sort -rn

# TypeScript projects — excludes node_modules, dist, build, generated, declaration files, mocks
find . \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  ! -path "*/out/*" \
  ! -path "*/.next/*" \
  ! -path "*/generated/*" \
  ! -path "*/__generated__/*" \
  ! -path "*/__mocks__/*" \
  ! -path "*/mocks/*" \
  ! -name "*.d.ts" \
  ! -name "*.gen.ts" \
  ! -name "*.generated.ts" \
  ! -name "*.mock.ts" \
  -exec wc -l {} + | awk '$1 > 1000 && $NF != "total" {print}' | sort -rn
```

---

## Split Strategy

When a file exceeds the threshold, split by **responsibility boundaries** (not arbitrary line counts):

### C#/.NET

| Pattern | Split Into |
|---------|-----------|
| CRUD + validation + business logic | `*Command.cs`, `*Query.cs`, `*Validator.cs` |
| Provisioning + deprovisioning | `*Provision.cs`, `*Deprovision.cs` |
| Controller/handler with settings + cache + CRUD | `*Controller.cs`, `*Controller.Settings.cs`, `*Controller.Cache.cs` (partial classes) |
| Service with lifecycle + helpers | `*Service.cs`, `*Service.Helpers.cs` |
| Large test class | Split test class to mirror source file split |

**C#/.NET rules:**
1. All split files stay in the **same namespace** — zero breaking changes
2. Use `partial class` to split members of one type across files while keeping the same type
3. Test files split to match: `Foo.cs` → `FooTests.cs`
4. Run `dotnet build` and `dotnet test` after each split to verify

### TypeScript

| Pattern | Split Into |
|---------|-----------|
| Service with CRUD + validation + helpers | `*.service.ts`, `*.validator.ts`, `*.helpers.ts` |
| Controller with routes + middleware + handlers | `*.controller.ts`, `*.middleware.ts` |
| Large module barrel | Split into sub-modules by domain concept |
| Large test file | Split test file to mirror source file split |

**TypeScript rules:**
1. Split files stay in the **same module/directory** — update barrel exports (`index.ts`) if needed
2. Split by logical responsibility (class methods can be extracted to separate service/helper files)
3. Test files split to match: `foo.service.ts` → `foo.service.spec.ts`
4. Run `tsc --noEmit && npm test` after each split to verify

---

## Agent Instructions

### For implementing-tasks (Gate 0) — C#/.NET

Include in C# implementation agent prompts:

```
⛔ FILE SIZE ENFORCEMENT (MANDATORY):
- Soft limit 1000 lines, hard block 1500 lines (including test files)
- Before splitting, apply cohesion judgment: if the file is a single cohesive concern (state machine, parser, schema, table-driven tests, tightly-coupled domain logic) and splitting would force artificial boundaries or import gymnastics, KEEP IT TOGETHER
- Splits must reduce cognitive load, not just line count
- Split by responsibility boundaries (not arbitrary line counts)
- Each split file stays in the same namespace
- Use partial class to split members of one type across files
- Test files MUST be split to match source files
- After splitting, verify: dotnet build && dotnet test
- Files 1001-1500 lines = examine with cohesion judgment. Files > 1500 lines = HARD BLOCK unless cohesion justification is documented in the PR description.

Reference: csharp/domain.md → File Organization (MANDATORY)
```

### For implementing-tasks (Gate 0) — TypeScript

Include in TypeScript implementation agent prompts:

```
⛔ FILE SIZE ENFORCEMENT (MANDATORY):
- Soft limit 1000 lines, hard block 1500 lines (including test files)
- Before splitting, apply cohesion judgment: if the file is a single cohesive concern (state machine, parser, schema, table-driven tests, tightly-coupled domain logic) and splitting would force artificial boundaries or import gymnastics, KEEP IT TOGETHER
- Splits must reduce cognitive load, not just line count
- Split by logical responsibility (not arbitrary line counts)
- Update barrel exports (index.ts) if needed after splitting
- Test files MUST be split to match source files
- After splitting, verify: tsc --noEmit && npm test
- Files 1001-1500 lines = examine with cohesion judgment. Files > 1500 lines = HARD BLOCK unless cohesion justification is documented in the PR description.

Reference: typescript.md → File Organization (MANDATORY)
```

### For planning-backend-refactor (Step 4 agents)

Include in ALL analysis agent prompts:

```
⛔ FILE SIZE ENFORCEMENT (MANDATORY):
- Any source file > 1000 lines (including test files) MUST be flagged as ISSUE-XXX
- Files 1001-1500 lines: severity HIGH (subject to cohesion override — document reasoning if kept)
- Files > 1500 lines: severity CRITICAL with explicit decomposition plan unless cohesion justification is documented
- Apply cohesion judgment: state machines, parsers, schemas, table-driven tests, tightly-coupled domain logic may remain whole if splitting creates artificial boundaries
- Include line count and proposed split (or cohesion rationale to keep) in the finding
- Each file = one ISSUE-XXX (not grouped)
```

---

## Anti-Rationalization

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "It's all one class, can't split" | Members of the same type can live in different files via `partial class` (same namespace) | **Split by member responsibility** |
| "File will be split later" | Later = never. Split NOW during implementation. | **Split before gate passes** |
| "It's only 1100 lines, just over the limit" | 1001-1500 band requires cohesion review, not automatic pass. Apply judgment: coherent → keep; fragmentable without artificial boundaries → split. | **Apply cohesion judgment, document outcome** |
| "Splitting adds complexity" | Large files ARE complexity. Small focused files reduce cognitive load. | **Split by responsibility** |
| "Tests will break" | Split test files to match. Same namespace = same access. | **Split tests alongside source** |
| "Auto-generated code is large" | Auto-generated files (OpenAPI clients, EF Core migration scaffolds, source-generated code) are exempt. | **Check if truly auto-generated** |
| "This is a temporary file" | Temporary becomes permanent. Standards apply to all files. | **Split or delete** |
| "Test files don't count" | Large test files are equally hard to maintain. Same threshold applies. | **Split test files to match source** |
