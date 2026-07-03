# Docker on VPS Deployment Standard (.NET)

> **⚠️ MAINTENANCE:** This file is indexed in `dev-team/skills/shared-patterns/standards-coverage-table.md`.
> When adding/removing `## ` sections, follow the FOUR-FILE UPDATE RULE in CLAUDE.md.

This file defines how to deploy containerized **.NET (ASP.NET Core)** applications
to a single **VPS using Docker + Docker Compose** — the workflow for services that
do not run on Kubernetes. For Kubernetes/AKS deployments use
`docs/standards/helm/` instead.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [When to Use This vs Helm](#when-to-use-this-vs-helm) | Choosing VPS/Docker over Kubernetes |
| 2 | [Multi-Stage Dockerfile](#multi-stage-dockerfile) | ASP.NET Core build + non-root runtime |
| 3 | [Compose Topology](#compose-topology) | App + reverse proxy + Postgres/Redis |
| 4 | [Reverse Proxy & TLS](#reverse-proxy--tls) | Caddy / Nginx / Traefik |
| 5 | [Environment & Secrets](#environment--secrets) | .env, compose secrets, appsettings mapping |
| 6 | [Health Checks](#health-checks) | Container healthcheck + ASP.NET Core probes |
| 7 | [Restart Policies](#restart-policies) | Surviving crashes and reboots |
| 8 | [Log Rotation](#log-rotation) | Bounding the Docker json-file driver |
| 9 | [Zero-Downtime Restarts](#zero-downtime-restarts) | Deploy without dropping requests |
| 10 | [Backups](#backups) | Postgres dumps + volume snapshots |

**Meta-sections (not checked by agents):**
- [Checklist](#checklist) - Self-verification before deploying to the VPS

---

## When to Use This vs Helm

| Use Docker-on-VPS when... | Use Helm/AKS when... |
|---------------------------|----------------------|
| Single VPS, one (or few) services | Multi-node cluster, many services |
| No Kubernetes control plane | Kubernetes already in place |
| Simple, self-managed host | Autoscaling, rolling multi-replica |
| Cost-sensitive, low ops overhead | HA / multi-AZ requirements |

The Dockerfile is **identical** for both targets — only the orchestration
(compose vs Helm) differs. Build once, deploy anywhere.

---

## Multi-Stage Dockerfile

Multi-stage build: SDK image builds and publishes, runtime image ships only the
published output. Runs as the built-in non-root `app` user.

```dockerfile
# syntax=docker/dockerfile:1

# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first for layer-cache friendliness
COPY ["src/App.Api/App.Api.csproj", "src/App.Api/"]
COPY ["src/App.Domain/App.Domain.csproj", "src/App.Domain/"]
RUN dotnet restore "src/App.Api/App.Api.csproj"

# Build + publish
COPY . .
RUN dotnet publish "src/App.Api/App.Api.csproj" \
    -c Release -o /app/publish \
    --no-restore /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# ASP.NET Core listens on 8080 by default in the container images
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0

COPY --from=build /app/publish .

# The aspnet image ships a non-root "app" user (UID 1654). Use it.
USER app

EXPOSE 8080

# Container-level health check (see Health Checks section)
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD ["dotnet", "/app/healthcheck.dll"]

ENTRYPOINT ["dotnet", "App.Api.dll"]
```

Notes:
- **Pin the base image** to a specific major version (`:8.0`). Never `:latest`.
- **Non-root:** the `aspnet` image already provides an `app` user — `USER app`
  is mandatory; do not run as root.
- **`UseAppHost=false`** skips the native apphost, keeping the image slim; the
  entrypoint invokes `dotnet App.Api.dll` directly.
- Chiseled/distroless variant for a smaller attack surface:
  `mcr.microsoft.com/dotnet/aspnet:8.0-jammy-chiseled` (already non-root, no shell —
  use an httpGet health check instead of a shell-based one).

### .dockerignore (MANDATORY)

```gitignore
**/bin/
**/obj/
**/.vs/
**/.git/
**/*.user
**/appsettings.*.local.json
.env
.env.*
Dockerfile*
docker-compose*.yml
```

---

## Compose Topology

One `docker-compose.yml` describes the whole VPS stack: reverse proxy (edge),
the .NET app, and its data stores. Only the reverse proxy publishes host ports —
everything else stays on the internal Docker network.

```yaml
# docker-compose.yml
services:
  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy
    networks: [edge, internal]
    logging: &default-logging
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  api:
    image: myacr.azurecr.io/app-api:${APP_VERSION:?set APP_VERSION}
    restart: unless-stopped
    env_file: .env
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_HTTP_PORTS: "8080"
    # NO host ports — only the reverse proxy reaches it, over the internal network
    expose:
      - "8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "dotnet", "/app/healthcheck.dll"]
      interval: 30s
      timeout: 3s
      start_period: 20s
      retries: 3
    networks: [internal]
    logging: *default-logging

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks: [internal]
    logging: *default-logging

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [internal]
    logging: *default-logging

networks:
  edge:
  internal:
    internal: true        # no outbound internet for data-tier services

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

Key rules:
- **Only the reverse proxy binds host ports.** The app uses `expose:` (network-
  internal), never `ports:`. Postgres/Redis are never reachable from the host's
  public interface.
- **`internal: true`** on the data network blocks outbound internet for the DB
  and cache tier, shrinking the blast radius.
- **Pin every image tag** (`postgres:16-alpine`, `caddy:2.8-alpine`) — no
  `:latest`. Pin the app with `${APP_VERSION}` sourced from `.env`.
- `depends_on ... condition: service_healthy` gates startup on real readiness,
  not just container creation.

---

## Reverse Proxy & TLS

Terminate TLS at the edge proxy and forward plaintext to the app over the
internal network. **Caddy** is the lowest-effort choice (automatic Let's Encrypt).

### Caddy (recommended default)

```caddyfile
# Caddyfile
api.example.com {
    encode gzip zstd
    reverse_proxy api:8080 {
        health_uri /healthz
        health_interval 10s
    }
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        -Server
    }
}
```

Caddy provisions and renews certificates automatically; no cron, no certbot.

### Nginx (if you already run it)

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With Nginx/Traefik you must configure ASP.NET Core to trust the forwarded
headers so `Request.Scheme` and the client IP are correct:

```csharp
app.UseForwardedHeaders(new ForwardedHeadersOptions {
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
```

### Traefik (if you want label-driven routing)

Traefik discovers services from compose labels — good when the number of apps
grows. Add labels to the `api` service and let Traefik own ports 80/443 instead
of Caddy. Use one edge proxy, not several.

---

## Environment & Secrets

ASP.NET Core reads environment variables straight into `IConfiguration`. Use the
**double-underscore** separator for nested keys.

### .env (never committed — add to .gitignore)

```bash
# .env  (chmod 600; owned by the deploy user)

# App
APP_VERSION=1.4.2
ASPNETCORE_ENVIRONMENT=Production

# Connection string password lives here, not in appsettings.json
ConnectionStrings__Default=Host=postgres;Port=5432;Database=app;Username=app;Password=${POSTGRES_PASSWORD}

# Postgres
POSTGRES_USER=app
POSTGRES_PASSWORD=change-me-strong
POSTGRES_DB=app

# Redis
REDIS_PASSWORD=change-me-strong
Redis__Configuration=redis:6379,password=${REDIS_PASSWORD}

# Auth
Jwt__Authority=https://auth.example.com
Jwt__Key=change-me-64-bytes

# Telemetry
ENABLE_TELEMETRY=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

Provide a committed **`.env.example`** with the same keys and placeholder
values so the required set is documented.

### Rules

| Guideline | Reason |
|-----------|--------|
| `.env` in `.gitignore`, `chmod 600` | Keep secrets off git and off other users |
| Commit `.env.example` | Document required keys |
| `${VAR:?message}` in compose | Fail fast when a required var is unset |
| Nested keys use `__` | Maps to ASP.NET Core `IConfiguration` sections |
| Never bake secrets into the image | Image layers are inspectable; use runtime env |

### Compose file secrets (stronger than .env)

For higher-sensitivity values, use Docker's file-based secrets so they land in
`/run/secrets/<name>` (tmpfs) instead of the process environment:

```yaml
services:
  api:
    secrets:
      - jwt_key
secrets:
  jwt_key:
    file: ./secrets/jwt_key.txt   # chmod 600, outside the repo
```

Read it in .NET from `/run/secrets/jwt_key` at startup (e.g. a small
configuration provider), rather than from an env var.

---

## Health Checks

Two layers, both required:

1. **ASP.NET Core endpoints** — wired in `Program.cs`:

```csharp
builder.Services.AddHealthChecks()
    .AddNpgSql(cfg.GetConnectionString("Default")!, tags: ["ready"])
    .AddRedis(cfg["Redis:Configuration"]!, tags: ["ready"]);

app.MapHealthChecks("/healthz", new() { Predicate = _ => false });               // liveness
app.MapHealthChecks("/readyz",  new() { Predicate = c => c.Tags.Contains("ready") }); // readiness
```

- `/healthz` → process alive, no dependency checks (fast).
- `/readyz` → real connectivity to Postgres/Redis (used by the reverse proxy).

2. **Container `HEALTHCHECK`** — lets Docker mark the container `unhealthy` and
   lets `depends_on: condition: service_healthy` gate startup.
   - On a shell-less chiseled image, use an httpGet-style probe binary or
     `curl`-less approach: ship a tiny `healthcheck.dll` that GETs
     `http://localhost:8080/healthz` and exits non-zero on failure.

Point the reverse proxy's upstream health probe at **`/readyz`** so it only
routes traffic to a pod/container whose dependencies are actually up.

---

## Restart Policies

```yaml
restart: unless-stopped
```

- **`unless-stopped`** for every long-running service: Docker restarts it on
  crash and after a host reboot, but respects an explicit `docker compose stop`.
- Do **not** use `restart: always` for one-shot jobs (migrations); use
  `restart: "no"` and run them via `docker compose run --rm migrate`.
- Ensure the Docker daemon itself is enabled on boot: `systemctl enable docker`.

EF Core migrations as a one-shot service:

```yaml
  migrate:
    image: myacr.azurecr.io/app-api:${APP_VERSION}
    restart: "no"
    env_file: .env
    entrypoint: ["/app/efbundle"]
    depends_on:
      postgres:
        condition: service_healthy
    networks: [internal]
```

Run before flipping traffic: `docker compose run --rm migrate`.

---

## Log Rotation

The default `json-file` driver grows unbounded and will fill the VPS disk. Cap
it per service (see the `&default-logging` anchor in the compose above) or set a
daemon-wide default:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
```

Apply with `systemctl restart docker` (recreates containers). Prefer **structured
JSON logging** from the app (Serilog with the compact JSON formatter) so logs
stay machine-parseable and shippable to a collector later.

---

## Zero-Downtime Restarts

A single-VPS stack can still deploy without dropping requests:

1. **Pull the new image** by tag: `docker compose pull api`.
2. **Run migrations** first (idempotent): `docker compose run --rm migrate`.
3. **Recreate only the app**, letting the proxy keep serving until it's healthy:
   ```bash
   docker compose up -d --no-deps --wait api
   ```
   `--wait` blocks until the new container reports `healthy` (from the
   `HEALTHCHECK`), so the proxy's `/readyz` probe only shifts traffic once the
   new container is ready.
4. Because only the reverse proxy holds the public socket, it drains old
   upstreams and picks up the new container automatically.

For true overlap (old and new serving simultaneously), scale the app to 2 behind
the proxy during the switch:

```bash
docker compose up -d --no-deps --scale api=2 --wait api
docker compose up -d --no-deps --scale api=1 api
```

Set a `stop_grace_period` (e.g. `30s`) on the app so in-flight requests and
`BackgroundService` shutdown (`HostOptions.ShutdownTimeout`) complete before the
container is killed.

---

## Backups

### Postgres (logical dump, nightly)

```bash
#!/usr/bin/env bash
# /opt/app/backup-postgres.sh  — run from cron
set -euo pipefail
TS=$(date +%F_%H%M)
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > "/opt/app/backups/db_${TS}.dump"
# retain 14 days
find /opt/app/backups -name 'db_*.dump' -mtime +14 -delete
```

Cron entry: `0 3 * * * cd /opt/app && ./backup-postgres.sh`.
Restore: `docker compose exec -T postgres pg_restore -U $USER -d $DB --clean < db.dump`.

### Volumes (offline snapshot)

```bash
docker run --rm \
  -v app_postgres_data:/data:ro \
  -v /opt/app/backups:/backup \
  alpine tar czf /backup/postgres_vol_$(date +%F).tar.gz -C /data .
```

### Rules

| Guideline | Reason |
|-----------|--------|
| Automate via cron | Manual backups get skipped |
| Copy backups **off** the VPS | A dead VPS takes local backups with it (e.g. `rclone` to object storage) |
| Test a restore periodically | An untested backup is a hope, not a backup |
| Redis: `appendonly yes` + volume | AOF gives point-in-time recovery for the cache/state |

---

## Checklist

Before deploying to the VPS, verify:

- [ ] Dockerfile uses a multi-stage build and pins the base image (no `:latest`)
- [ ] Container runs as the non-root `app` user (`USER app`)
- [ ] `.dockerignore` excludes `bin/`, `obj/`, `.env`, secrets
- [ ] Only the reverse proxy binds host ports; app uses `expose:`
- [ ] Data tier on an `internal: true` network (no public exposure)
- [ ] `.env` is gitignored, `chmod 600`; `.env.example` committed
- [ ] Required env vars use `${VAR:?}` so compose fails fast
- [ ] `/healthz` and `/readyz` wired in Program.cs; container `HEALTHCHECK` present
- [ ] `restart: unless-stopped` on all long-running services; docker enabled on boot
- [ ] Log rotation configured (per-service `max-size`/`max-file` or daemon.json)
- [ ] EF Core migrations run as a one-shot step before traffic switch
- [ ] TLS terminated at the proxy with auto-renewing certificates
- [ ] Nightly Postgres dump + volume snapshot, copied off-host, restore tested
