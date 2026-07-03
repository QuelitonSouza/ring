---
name: ring:auditing-dependency-security
description: "Auditing a NuGet (or npm/pip) dependency for supply-chain risk before install: checks typosquatting, maintainer/age risk, vulnerability DBs (dotnet list package --vulnerable, GHSA, OSV), and lockfile hash pinning (packages.lock.json), then emits a risk score and approve/conditional/escalate/block decision. Use when adding or updating a dependency, reviewing a dependency PR, or investigating a compromise. Skip when no new dependency is involved or it is already vetted."
---

# Dependency Security Check

## When to use
- Adding a new NuGet package to any .NET project
- Running `dotnet add package`, `dotnet restore`, `npm install`, or equivalent
- Auditing existing dependencies for supply-chain risk
- Reviewing a PR that adds or updates dependencies
- Investigating a potential supply-chain compromise

## Skip when
- No dependencies are being added, updated, or audited
- Task involves only internal code changes with no new package references
- Dependency is already vetted and pinned in a lockfile

## Related
**Complementary:** ring:hardening-dockerfiles, ring:dev-implementation


Supply-chain gate for every `dotnet add package` / install command in the codebase.

## Pre-Install Checks

### 1. Package Identity Verification

```
For every package, verify:
├── Typosquatting: compare against known popular packages
│   e.g., "Newtonsoft.Jso" vs "Newtonsoft.Json", "Serillog" vs "Serilog"
├── Homoglyph attacks: look-alike Unicode characters
├── Author / owner risk (nuget.org):
│   - Unverified owner / no verified prefix reservation = higher risk
│   - Owner account created recently = flag
│   - Recent ownership transfer = CRITICAL flag
│   - Very low total download count for a "popular-sounding" name = flag
└── Package age: first published < 30 days = flag
```

Prefer packages whose ID prefix is **reserved** on nuget.org (blue check) —
prefix reservation blocks a whole class of typosquats.

### 2. Vulnerability Database Check

| Source | Ecosystem | What It Covers |
|--------|-----------|----------------|
| `dotnet list package --vulnerable` | NuGet | Native .NET scan against the GitHub Advisory DB |
| `dotnet list package --vulnerable --include-transitive` | NuGet | Same, including transitive deps (REQUIRED — most CVEs are transitive) |
| `dotnet list package --deprecated` | NuGet | Deprecated / legacy / critical-bugs flags |
| GitHub Advisory Database (GHSA) | All | GHSA linked to CVEs; source feed for `--vulnerable` |
| OSV.dev | All | Google aggregated CVEs (cross-check) |
| NuGet.org API | NuGet | Metadata, owners, publish history, deprecation |
| npm registry API / `npm audit` | npm | Metadata, maintainers, install scripts |

Run the native scan first:

```bash
dotnet restore
dotnet list package --vulnerable --include-transitive
dotnet list package --deprecated
```

Any reported vulnerability at High/Critical severity blocks until upgraded or
mitigated. If a project uses Central Package Management, run the audit at the
solution root so `Directory.Packages.props` versions are the ones evaluated.

### 3. Behavioral Signals

| Signal | Risk Level | Description |
|--------|-----------|-------------|
| Build/restore hooks | HIGH | MSBuild `.targets`/`.props` in the package that run on build, `init.ps1`/`install.ps1` (legacy) |
| Network access at init/module load | CRITICAL | Package phones home on load or in a module initializer |
| File system access outside project | HIGH | Reads `~/.aws`, `%USERPROFILE%`, tokens, env vars |
| Obfuscated code / IL | CRITICAL | Base64 payloads, reflection-loaded assemblies, `Assembly.Load` of embedded blobs |
| Native binary bundled | HIGH | Pre-compiled native DLLs/`.so` under `runtimes/` without source |
| Excessive/unexpected permissions | MEDIUM | Package requests capabilities unrelated to its stated purpose |

Inspect a suspect `.nupkg` by unzipping it (`.nupkg` is a ZIP) and reviewing
`*.targets`, `*.props`, and any `tools/` scripts before trusting it.

### 4. Lockfile Integrity

| Ecosystem | Lockfile | Hash Requirement |
|-----------|----------|-----------------|
| NuGet | packages.lock.json | Enable with `<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>`; restore with `--locked-mode` in CI so hashes (`contentHash`) are verified and drift fails the build |
| npm | package-lock.json | `integrity` field (SHA-512) must be present for ALL deps |
| pip | requirements.txt | `--require-hashes` MUST be enforced |

For .NET, commit `packages.lock.json` and gate CI on:

```bash
dotnet restore --locked-mode   # fails if the graph drifts from the lockfile
```

Enable NuGet's own audit (on by default in modern SDKs) and keep it strict:

```xml
<PropertyGroup>
  <NuGetAudit>true</NuGetAudit>
  <NuGetAuditMode>all</NuGetAuditMode>      <!-- direct + transitive -->
  <NuGetAuditLevel>low</NuGetAuditLevel>
</PropertyGroup>
```

## Risk Scoring

```
risk_score = weighted_sum(
  typosquatting_similarity * 25,
  maintainer_risk          * 20,   # unverified owner / new account / transfer
  package_age_risk         * 15,
  vulnerability_count      * 20,   # weighted by severity, from dotnet list --vulnerable
  behavioral_flags         * 15,   # build hooks, native blobs, obfuscation
  lockfile_integrity       * 5     # packages.lock.json present + locked-mode
)
```

Score thresholds:
- 0-25: LOW — proceed
- 26-50: MEDIUM — proceed with documentation
- 51-75: HIGH — escalate to the tech lead before installing
- 76-100: CRITICAL — block installation

## Decision Matrix

| Risk Level | Action |
|-----------|--------|
| LOW (0-25) | ✅ Approve — document in PR |
| MEDIUM (26-50) | ⚠️ Conditional — mitigations required |
| HIGH (51-75) | 🚨 Escalate to tech lead before installing |
| CRITICAL (76-100) | ❌ Block — do not install |

## Report Template

```markdown
## Dependency Security Report

Package: {name} @ {version}
Ecosystem: {nuget|npm|pip}
Risk Score: {score}/100 — {LOW|MEDIUM|HIGH|CRITICAL}

### Verification Results

| Check | Status | Details |
|-------|--------|---------|
| Typosquatting check | PASS/FLAG | {comparison} |
| Owner verification | PASS/FLAG | {owner, prefix reserved?, account age} |
| Vulnerability scan | PASS/FLAG | {`dotnet list package --vulnerable` output: CVE count, severity} |
| Deprecation check | PASS/FLAG | {`dotnet list package --deprecated` result} |
| Behavioral analysis | PASS/FLAG | {build hooks, native blobs, obfuscation} |
| Lockfile integrity | PASS/FAIL | {packages.lock.json present + locked-mode enforced} |

### Decision
{APPROVED|CONDITIONAL|ESCALATE|BLOCKED}

### Required Actions (if not APPROVED)
1. {specific mitigations or alternatives}
```

## Mitigations for MEDIUM Risk

- Pin the exact version in the `.csproj` (or `Directory.Packages.props` under Central Package Management) and commit `packages.lock.json`
- Prefer a package with a **reserved ID prefix** (verified owner) over an unverified one
- Vendor the dependency (copy source into the repo) if it is small and rarely updated
- Document why this specific package was chosen over alternatives
- Enable **GitHub Dependabot** for NuGet (`.github/dependabot.yml`, `package-ecosystem: "nuget"`) and turn on Dependabot security updates so future CVEs raise PRs automatically
- Add the package to CI's `dotnet list package --vulnerable` gate so regressions fail the build
