---
name: ring:creating-helm-charts
description: "Creating Helm charts for containerized .NET (ASP.NET Core) services on Kubernetes/AKS via ring:devops-engineer: standardized chart structure, full configuration coverage from appsettings.json + .env.example, security defaults (runAsNonRoot, readOnlyRootFilesystem, drop ALL), ClusterIP-only services, and ASP.NET Core health probes (/healthz liveness, /readyz readiness); validates helm lint and template render. Use when creating, modifying, or reviewing a chart, or migrating a docker-compose setup to Helm. Skip for app-code-only changes or docker-compose-only (VPS) deployments — those use ring:deploy-docker-vps instead."
---

# Helm Chart Creation & Maintenance

## When to use
- Creating a new Helm chart for a .NET service deployed to Kubernetes/AKS
- Modifying an existing Helm chart (adding components, dependencies, templates)
- Reviewing a Helm chart PR for convention compliance
- Migrating a docker-compose setup to Helm for Kubernetes

## Skip when
- Modifying only application code (no chart changes)
- Deploying to the VPS with Docker (no Kubernetes) → use the `deploy-docker-vps.md` standard
- Single-question check (use a targeted read of `dev-team/docs/standards/helm/` instead)

## Related
**Complementary:** ring:hardening-dockerfiles (container hardening), ring:implementing-readyz (readiness probes)

**Standards reference:** `dev-team/docs/standards/helm/`
**Executor agent:** `ring:devops-engineer`

You orchestrate. `ring:devops-engineer` creates chart files.

## Step 1: Validate Input

Required: `service_name`, `chart_type` (single | multi-component | umbrella), `components` (non-empty).
Optional: `dependencies` (postgresql, redis, rabbitmq, keda), `has_worker`, `namespace`.

## Step 2: Naming Convention

```text
Default: {service_name}-helm  (e.g., onboarding-helm, transaction-helm)
Document any suffix exception in docs/PROJECT_RULES.md.
```

## Step 3: Dispatch Agent

```yaml
Task:
  subagent_type: "ring:devops-engineer"
  model: "opus"
  description: "Create Helm chart for {service_name}"
  prompt: |
    ## Helm Chart Creation (.NET / ASP.NET Core)

    service_name: {service_name}
    components: {components}
    dependencies: {dependencies}
    chart_type: {chart_type}
    namespace: {namespace}

    Standards: Load dev-team/docs/standards/helm/ files via WebFetch:
      https://raw.githubusercontent.com/QuelitonSouza/ring/main/dev-team/docs/standards/helm/index.md
    then the modules index.md points to.

    ## Required Steps
    1. Read the application's appsettings.json, appsettings.*.json and .env.example
       — extract ALL configuration keys (missing keys = CrashLoopBackOff or silent
       wrong-default behavior). Use __ (double underscore) for nested keys.
    2. Verify health endpoints in Program.cs:
       app.MapHealthChecks("/healthz", ...)  → liveness (no dependency checks)
       app.MapHealthChecks("/readyz", ...)   → readiness (deep dependency checks, "ready" tag)
    3. Create chart structure:

    charts/{service_name}-helm/
    ├── Chart.yaml
    ├── values.yaml
    ├── templates/
    │   ├── _helpers.tpl
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── configmap.yaml
    │   ├── secret.yaml (if secrets exist)
    │   ├── hpa.yaml
    │   ├── pdb.yaml
    │   └── serviceaccount.yaml
    └── charts/ (dependencies)

    4. Chart.yaml: name ({service}-helm), version, appVersion, description, type: application
    5. _helpers.tpl: name, fullname, chart, labels, selectorLabels, versionLabelValue
    6. values.yaml structure:
       - Per-component config sections
       - image.repository/tag/pullPolicy (structured map, not flat string)
       - configmap: all non-secret keys (ASPNETCORE_ENVIRONMENT, ASPNETCORE_HTTP_PORTS,
         Logging__LogLevel__Default, DB_HOST, ...)
       - secrets: all sensitive keys — EMPTY placeholders (ConnectionStrings__Default,
         Jwt__Key, ...); source from Azure Key Vault via useExistingSecret
       - service: type: ClusterIP, port matching ASPNETCORE_HTTP_PORTS (8080)
       - resources: requests/limits — MUST set memory limit (the .NET GC sizes from cgroup)
       - probes: livenessProbe → /healthz, readinessProbe → /readyz
       - dependency config sections

    7. Security defaults (container-level, EVERY container):
       - runAsNonRoot: true, runAsUser: 1000
       - readOnlyRootFilesystem: true (mount emptyDir at /tmp if the app writes temp files)
       - allowPrivilegeEscalation: false
       - capabilities.drop: [ALL]

    8. Service type: ALWAYS ClusterIP (never NodePort or LoadBalancer)
    9. EF Core migrations: run as a pre-upgrade hook Job, not in app startup

    ## Required Output
    - Config Coverage table (100% of appsettings.json + .env.example covered)
    - helm lint result: MUST PASS
    - helm template render: MUST produce valid YAML
    - Files created list
```

## Step 4: Validate Output

```text
if config_keys_missing > 0:
  → FAIL: list missing keys, re-dispatch

if helm lint fails:
  → Re-dispatch with specific lint errors

if all checks PASS:
  → Proceed to worker setup or final validation
```

## Worker Chart (if has_worker = true)

Additional dispatch for a .NET `BackgroundService` / Worker component:
- Dual-mode: KEDA ScaledJob (default) OR Deployment fallback — see worker-patterns.md
- Same configmap/secrets references as the API
- No Service when the worker hosts no HTTP server
- Liveness via a minimal /healthz listener (preferred) or a file/exec probe
- terminationGracePeriodSeconds ≥ HostOptions.ShutdownTimeout so in-flight messages drain

## Validation Checklist

```markdown
## Helm Chart Validation

| Check | Status | Evidence |
|-------|--------|----------|
| Config coverage (100%) | ✅/❌ | X/Y keys mapped |
| helm lint PASS | ✅/❌ | command output |
| helm template renders | ✅/❌ | YAML valid |
| Security context set | ✅/❌ | deployment.yaml:{line} |
| Service type = ClusterIP | ✅/❌ | service.yaml:{line} |
| Probes match endpoints (/healthz, /readyz) | ✅/❌ | deployment.yaml:{line} |
| Memory limit set | ✅/❌ | values.yaml:{line} |
| No real secrets in values | ✅/❌ | |
```
