---
name: ring:hardening-dockerfiles
description: "Hardening .NET (ASP.NET Core) Dockerfiles to reach Docker Hub Health Score grade A: enforcing a non-root USER, minimal chiseled/distroless multi-stage base images (mcr.microsoft.com/dotnet/aspnet), no fixable critical/high CVEs, no AGPL-3.0 deps, and SBOM+provenance attestations. Use when creating a new Dockerfile, auditing one for security, or preparing images for publication — critical for VPS Docker deploys where there is no cluster admission control. Skip when the project has no Dockerfile, changes are app-code-only, or you consume pre-built images."
---

# Docker Security (Health Score Grade A)

## When to use
- Creating a new Dockerfile for a .NET service
- Auditing an existing .NET Dockerfile for security
- Preparing images for publication
- Docker Hub health score is below grade A

## Skip when
- Project has no Dockerfile and none is being created
- Changes are application-code only with no Docker modifications
- Using pre-built images without a custom Dockerfile

## Related
**Complementary:** ring:dev-implementation, ring:dev-devops, ring:implementing-readyz

## Why this matters here
Their backends deploy BOTH on Kubernetes (AKS) AND on a **VPS with Docker (Compose / plain `docker run`)**.

- On **AKS** you *can* add a safety net — `runAsNonRoot: true`, read-only root FS, `securityContext`, and admission policies can reject a bad image at the cluster edge.
- On the **VPS there is no such net.** Whatever the Dockerfile bakes in *is* the security posture. A container that runs as root, ships build tools, or drags CVEs into the final layer is exposed directly on the box. **Harden the image itself so it is safe on the VPS with zero orchestrator help** — then AKS is a bonus, not a crutch.

## Health Score Policies

| # | Policy | Weight | Compliance |
|---|--------|--------|------------|
| 1 | Default non-root user | Required | `USER` directive with non-root user |
| 2 | No fixable critical/high CVEs | Required | Chiseled/distroless or Alpine, multi-stage |
| 3 | No high-profile vulnerabilities (CISA KEV) | Required | Up-to-date base images |
| 4 | No AGPL v3 licenses | Required | Audit dependencies |
| 5 | Supply chain attestations (SBOM + provenance) | Required | Pipeline config |
| 6 | No outdated base images | Optional | Only for Docker Hub hosted images |
| 7 | No unapproved base images | Optional | Only for Docker Hub hosted images |

Policies 6-7 are **not evaluated** when using non-Docker Hub base images (`mcr.microsoft.com/dotnet/*`, `gcr.io/distroless`, etc.).

## Policy Implementation

### Policy 1 — Non-Root User

The modern .NET base images ship a pre-created non-root user `app` (UID 1654). Prefer it:

```dockerfile
# ASP.NET Core 8/9 runtime images: use the built-in non-root user
USER $APP_UID
# equivalently: USER app
```

For the **chiseled** images the non-root user is already the default, but keep the directive explicit. If you must create one manually (custom base):

```dockerfile
# Debian/Ubuntu base
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
```

`USER root` does NOT satisfy this policy. Also expose a non-privileged port
(>1024) — a non-root user cannot bind 80. Set `ASPNETCORE_HTTP_PORTS=8080` (the
.NET 8+ images already default to 8080) and `EXPOSE 8080`.

### Policies 2 & 3 — Minimal Attack Surface

Use a multi-stage build: full SDK to build, minimal runtime to ship. Ranked from smallest/most-hardened:

```dockerfile
# Smallest + hardened: chiseled Ubuntu (no shell, no package manager, non-root by default)
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled

# Chiseled + extras (globalization/ICU, tzdata) when the app needs them
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled-extra

# Distroless-equivalent alternative
FROM gcr.io/distroless/dotnet-debian12

# Alpine (small, has a shell — fine, but larger attack surface than chiseled)
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
```

Chiseled images have **no shell and no package manager**, which removes most of
the CVE surface and makes the "no fixable critical/high CVEs" policy trivial to
hold. Multi-stage is **mandatory** — never ship the SDK.

### Policy 4 — No AGPL v3

Audit both the NuGet dependency licenses and any OS packages:

```bash
# NuGet package licenses
dotnet list package --include-transitive

# Filesystem/OS + license scan of the built image
trivy image --scanners license --severity CRITICAL myorg/myservice:latest
```

Replace any AGPL-3.0 dependency.

### Policy 5 — Supply Chain Attestations (Pipeline)

```yaml
# docker/build-push-action config
sbom: true
provenance: mode=max
```

Not a Dockerfile concern — verify CI/CD includes both parameters. (For the VPS,
also keep the SBOM so you can re-scan deployed images out-of-band.)

## Dockerfile Templates

### ASP.NET Core Web API — chiseled, non-root (recommended)
```dockerfile
# ---- build stage ----
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["MyService.csproj", "./"]
RUN dotnet restore "MyService.csproj" --locked-mode
COPY . .
RUN dotnet publish "MyService.csproj" -c Release -o /app/publish \
    /p:UseAppHost=false

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "MyService.dll"]
```

### ASP.NET Core — Alpine variant (when a shell is required)
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src
COPY ["MyService.csproj", "./"]
RUN dotnet restore "MyService.csproj" --locked-mode
COPY . .
RUN dotnet publish "MyService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app/publish .
USER appuser
ENTRYPOINT ["dotnet", "MyService.dll"]
```

## Audit Checklist

```
CRITICAL (blocks grade A):
[ ] USER directive with non-root user (USER $APP_UID / USER app)
[ ] Multi-stage build (SDK only in build stage, runtime image ships no build tools)
[ ] Minimal base image (chiseled/distroless preferred, Alpine acceptable)
[ ] Non-privileged port (ASPNETCORE_HTTP_PORTS=8080, EXPOSE 8080)
[ ] No secrets in image layers (no appsettings with secrets, no COPY of .env)

HIGH (CVE risk):
[ ] Base image tag is current (e.g. 9.0-noble-chiseled, not a stale minor)
[ ] Package versions pinned; restore uses --locked-mode
[ ] No SDK / dev dependencies in the final stage

MEDIUM:
[ ] .dockerignore excludes .git, bin/, obj/, appsettings.*.json secrets, tests
[ ] COPY used (not ADD)
[ ] Cache layers ordered: restore before COPY of source

SUPPLY CHAIN (pipeline):
[ ] sbom: true in build-push-action
[ ] provenance: mode=max

VPS-SPECIFIC (no orchestrator net):
[ ] Container runs read-only where possible (docker run --read-only, tmpfs for /tmp)
[ ] --cap-drop ALL unless a capability is genuinely needed
[ ] Health check present so a hung container is visible without K8s probes
```

## Report Template

```markdown
## Health Score Compliance

| Policy | Status | Details |
|--------|--------|---------|
| Default non-root user | PASS/FAIL | USER {user} at line {N} |
| No fixable CVEs | PASS/RISK | Base: {image} |
| No KEV vulnerabilities | PASS/RISK | Base image {status} |
| No AGPL v3 licenses | PASS/RISK | {N} deps audited |
| Supply chain attestations | PASS/MISSING | sbom: {yes/no}, provenance: {yes/no} |

**Grade A: {ACHIEVED / NOT ACHIEVED}**

## VPS Hardening (no orchestrator)
| Control | Status | Notes |
|---------|--------|-------|
| Non-root at runtime | PASS/FAIL | |
| Read-only root FS feasible | YES/NO | |
| Capabilities dropped | YES/NO | |

## Actions Taken
| File | Action | Changes |
```
