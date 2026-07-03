# Helm Values Structure (.NET Standard)

## ConfigMap vs Secrets Classification

```text
CONFIGMAP (non-sensitive):
  ✅ ASPNETCORE_ENVIRONMENT, ASPNETCORE_HTTP_PORTS, ASPNETCORE_URLS
  ✅ Logging__LogLevel__Default, Serilog__MinimumLevel
  ✅ DB_HOST, DB_PORT, DB_NAME, DB_USER (NOT password)
  ✅ REDIS_HOST, REDIS_PORT, REDIS_DB
  ✅ RABBITMQ_HOST, RABBITMQ_PORT_AMQP
  ✅ OTEL_*, ENABLE_TELEMETRY, OTEL_EXPORTER_OTLP_ENDPOINT
  ✅ Feature flags, timeouts, HttpClient base addresses, pool sizes
  ✅ Downstream service URLs (*_BASE_URL)

SECRETS (sensitive):
  🔒 ConnectionStrings__Default (contains the password)
  🔒 DB_PASSWORD, REDIS_PASSWORD, RABBITMQ_DEFAULT_PASS
  🔒 API keys (*_API_KEY, *_SECRET, *_TOKEN)
  🔒 JWT signing keys (Jwt__Key, Jwt__Secret)
  🔒 OAuth credentials (*__ClientId, *__ClientSecret)
  🔒 Data-protection / encryption keys

RULE: If exposed in logs would be harmful → Secret
```

> **.NET connection strings** typically embed the password, so the full
> `ConnectionStrings__Default` value belongs in the **Secret**, not the
> ConfigMap. If you split host/user into the ConfigMap and only the password
> into the Secret, build the connection string in code from the parts instead.

---

## Top-Level values.yaml Structure

<cannot_skip>
values.yaml MUST follow this exact structure. Do NOT invent custom structures.
</cannot_skip>

```yaml
# 1. Global overrides
nameOverride: ""
fullnameOverride: ""
namespaceOverride: "{namespace}"

# 2. Global external dependency configuration (if applicable)
global:
  externalPostgresDefinitions:
    enabled: false
    connection:
      host: ""
      port: "5432"
    credentials:
      useExistingSecret:
        name: ""
      username: ""
      password: ""

# 3. Per-component configuration (REPEAT for each component)
{component}:
  name: "{service_name}-{component}"
  enabled: true
  replicaCount: 1
  revisionHistoryLimit: 10

  image:
    repository: myacr.azurecr.io/{service_name}-{component}
    pullPolicy: IfNotPresent
    tag: "1.0.0"
  imagePullSecrets: []

  nameOverride: ""
  fullnameOverride: ""

  annotations: {}
  podAnnotations: {}

  deploymentStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

  service:
    type: ClusterIP                    # ALWAYS ClusterIP
    port: {assigned_port}              # e.g. 8080 (matches ASPNETCORE_HTTP_PORTS)
    annotations: {}

  ingress:
    enabled: false
    className: "nginx"
    annotations: {}
    hosts: []
    tls: []

  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 200m
      memory: 256Mi

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80
    targetMemoryUtilizationPercentage: 80
    scaleDownStabilizationSeconds: 300

  pdb:
    enabled: true
    maxUnavailable: 1
    minAvailable: 0
    annotations: {}

  readinessProbe:
    initialDelaySeconds: 10
    periodSeconds: 5
    timeoutSeconds: 3
    successThreshold: 1
    failureThreshold: 3

  livenessProbe:
    initialDelaySeconds: 15
    periodSeconds: 20
    timeoutSeconds: 5
    successThreshold: 1
    failureThreshold: 3

  nodeSelector: {}
  tolerations: {}
  affinity: {}

  useExistingSecret: false
  existingSecretName: ""

  serviceAccount:
    create: true
    annotations: {}
    name: ""

  configmap:
    annotations: {}
    # Non-sensitive ASP.NET Core configuration
    ASPNETCORE_ENVIRONMENT: "Development"
    ASPNETCORE_HTTP_PORTS: "8080"
    Logging__LogLevel__Default: "Information"
    DB_HOST: "postgres"
    DB_PORT: "5432"
    DB_NAME: "app"
    DB_USER: "app"
    # ... service-specific vars

  secrets: {}
    # Sensitive configuration (leave EMPTY in committed values; source from Key Vault)
    # ConnectionStrings__Default: ""
    # Jwt__Key: ""

  extraEnvVars: {}

# 4. Common shared configuration (if multi-component)
common:
  configmap:
    ASPNETCORE_ENVIRONMENT: "Development"
    # Shared vars across all components

# 5. Dependency configurations
# ... (postgresql, redis, rabbitmq, keda)
```

> **Memory limits matter for .NET.** The runtime honours the cgroup memory limit
> to size the GC heap. Set explicit `resources.limits.memory`; without it the GC
> may size to the node's full memory. For latency-sensitive APIs consider
> `DOTNET_gcServer=1` (default in ASP.NET Core) and, on memory-constrained pods,
> `DOTNET_GCHeapHardLimitPercent`.

---

## Mandatory Configuration Groups

```text
FOR EVERY .NET service, MUST include:

1. APP / HOST CONFIG:
   ASPNETCORE_ENVIRONMENT, ASPNETCORE_HTTP_PORTS (or ASPNETCORE_URLS),
   Logging__LogLevel__Default

2. TELEMETRY (if applicable):
   ENABLE_TELEMETRY, OTEL_EXPORTER_OTLP_ENDPOINT,
   OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES

3. HEALTH:
   Health endpoints /healthz and /readyz are wired in Program.cs — no env var
   needed, but the probe ports must match ASPNETCORE_HTTP_PORTS.

4. AUTH (if applicable):
   Jwt__Authority, Jwt__Audience (ConfigMap); Jwt__Key (Secret)

5. DATABASE / INFRASTRUCTURE (per type used):
   PostgreSQL: DB_HOST, DB_PORT, DB_NAME, DB_USER (ConfigMap);
               ConnectionStrings__Default OR DB_PASSWORD (Secret)
   Redis:      REDIS_HOST, REDIS_PORT, REDIS_DB (ConfigMap);
               REDIS_PASSWORD (Secret)
   RabbitMQ:   RABBITMQ_HOST, RABBITMQ_PORT_AMQP, RABBITMQ_DEFAULT_USER (ConfigMap);
               RABBITMQ_DEFAULT_PASS (Secret)

VERIFY: Compare with the application's appsettings.json, appsettings.*.json and
        .env.example to ensure ALL configuration keys are covered. Missing keys
        fall back to defaults silently or cause runtime failures.
```

<block_condition>
HARD GATE: MUST read the application's appsettings.json / appsettings.*.json
and .env.example (if present) to extract ALL expected configuration keys. Do
NOT guess. Missing configuration is the #1 cause of CrashLoopBackOff and of
apps silently running with the wrong (default) settings in production.
</block_condition>
