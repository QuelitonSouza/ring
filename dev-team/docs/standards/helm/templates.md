# Helm Template Patterns (.NET Standard)

## Deployment Pattern

MUST include in this order:

```text
1. Conditional guard (if component.enabled)
2. metadata: name (from fullname helper), namespace (global.namespace), labels, annotations
3. spec.revisionHistoryLimit (default 10)
4. spec.replicas: CONDITIONAL on autoscaling.enabled
5. spec.strategy: from values (RollingUpdate default)
6. spec.selector.matchLabels
7. Pod template:
   a. imagePullSecrets
   b. serviceAccountName
   c. securityContext (pod-level: fsGroup only when a sidecar needs shared volume access)
   d. initContainers (wait-for-dependencies using busybox:1.37)
   e. containers:
      - envFrom: secretRef THEN configMapRef (order matters)
      - env: HOST_IP for OTEL (conditional)
      - resources from values
      - readinessProbe: httpGet to VERIFIED path (/readyz)
      - livenessProbe: httpGet to VERIFIED path (/healthz)
   f. volumes (conditional)
   g. nodeSelector, affinity, tolerations
```

### Deployment Template Sections

MUST include these sections in order:

```text
1. Conditional guard: {{- if .Values.{component}.enabled }}
2. metadata: name, namespace, labels, annotations
3. spec.replicas: conditional on autoscaling.enabled
4. spec.strategy: from values
5. spec.selector.matchLabels
6. spec.template.metadata: labels + podAnnotations
7. spec.template.spec:
   a. imagePullSecrets
   b. serviceAccountName
   c. securityContext (pod-level)
   d. initContainers (wait-for-dependencies if needed)
   e. containers:
      - name, image, imagePullPolicy
      - ports (containerPort, named "http")
      - envFrom (secretRef + configMapRef)
      - env (dynamic: HOST_IP for OTEL)
      - resources
      - readinessProbe (httpGet to /readyz — validates all dependencies)
      - livenessProbe (httpGet to /healthz — process liveness only)
      - securityContext (container-level)
   f. volumes (conditional)
   g. nodeSelector, affinity, tolerations
```

---

## Security Context (MANDATORY)

```yaml
# Container-level (EVERY container)
securityContext:
  runAsUser: 1000                 # matches non-root user in the .NET image
  runAsGroup: 1000
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
```

```yaml
# Pod-level
securityContext:
  fsGroup: 1000                    # only when a shared writable volume is required
```

> **.NET note:** `readOnlyRootFilesystem: true` works with ASP.NET Core as long
> as the app does not write to disk. If the framework needs a writable temp
> path, mount an `emptyDir` at `/tmp` and set `TMPDIR=/tmp` rather than dropping
> `readOnlyRootFilesystem`. Data-protection keys, if used, must be persisted to a
> mounted volume or a distributed store (Redis / Blob), never the read-only root.

<forbidden>
- runAsUser: 0 (root) without explicit justification
- Missing capabilities drop
- Missing runAsNonRoot: true
- allowPrivilegeEscalation: true
</forbidden>

---

## Image Declaration Pattern (MANDATORY)

All container image references in templates (Deployments, Jobs, CronJobs, initContainers) MUST use the structured `repository/tag/pullPolicy` format from values.yaml AND include a `kindIs` backward-compatibility guard.

### Why

CI image-bump automation uses `yq` to update image tags independently. A flat
string like `image: "repo/name:tag"` cannot be targeted by tag alone — the tag
field must be a separate key. Existing values files may still use the old
string format during migration, so templates must handle both.

### values.yaml Structure

```yaml
{component}:
  image:
    repository: myacr.azurecr.io/{service-name}
    pullPolicy: IfNotPresent
    tag: "1.0.0"
```

### Template Pattern (with kindIs guard)

```yaml
{{- $img := .Values.{component}.image -}}
{{- if kindIs "string" $img }}
image: {{ $img | quote }}
imagePullPolicy: Always
{{- else }}
image: "{{ $img.repository | default "myacr.azurecr.io/{service-name}" }}:{{ $img.tag | default "latest" }}"
imagePullPolicy: {{ $img.pullPolicy | default "IfNotPresent" }}
{{- end }}
```

### Rules

```text
1. EVERY container spec (main, sidecar, init, migration, job) MUST use this pattern
2. The `kindIs "string"` branch provides backward compatibility during migration
3. The `else` branch (map format) is the target state — new charts MUST use map format in values.yaml
4. Default repository MUST match the {registry}/{org}/{service-name} convention
5. Default tag SHOULD be "latest" for jobs/migrations, specific version for app containers
6. Default pullPolicy: IfNotPresent for app containers, Always for jobs/migrations
7. initContainers using well-known images (e.g., busybox:1.37) MAY use inline strings
```

<forbidden>
- Flat string image values in new charts (use structured repository/tag/pullPolicy)
- Templates that access .image.repository without kindIs guard
- Hardcoded image tags in templates (always read from values)
</forbidden>

---

## Health Check Verification

<cannot_skip>
Probe paths MUST match the actual application endpoints.
Wrong paths = CrashLoopBackOff. This is the #1 deployment failure cause.
</cannot_skip>

```text
ASP.NET Core HEALTH CHECK CONVENTION:
  Liveness:   /healthz   → process is alive (no dependency checks)
  Readiness:  /readyz    → deep dependency checks (DB, cache, queue) with real connectivity

Wire these with the built-in health-check middleware:

  builder.Services.AddHealthChecks()
      .AddNpgSql(connectionString, tags: ["ready"])
      .AddRedis(redisConnection, tags: ["ready"]);

  app.MapHealthChecks("/healthz", new HealthCheckOptions {
      Predicate = _ => false            // liveness: no dependency checks
  });
  app.MapHealthChecks("/readyz", new HealthCheckOptions {
      Predicate = check => check.Tags.Contains("ready")
  });

VERIFY by reading Program.cs / Startup.cs. Do NOT guess.
See ring:implementing-readyz for the readiness contract; /readyz performs deep
dependency checks, /healthz only signals process liveness.
```

### Health Check Path Convention

```text
VERIFY health endpoints by reading application source code:
  - Look in Program.cs for app.MapHealthChecks("/healthz", ...) and app.MapHealthChecks("/readyz", ...)
  - Confirm the ready predicate filters on the "ready" tag (deep checks)

COMMON PATHS:
  - /healthz  → liveness (process only)
  - /readyz   → readiness with dependency checks (ring:implementing-readyz)

NEVER use paths that don't exist in the application.
Wrong probe paths = CrashLoopBackOff.
```

### Probe Template

```yaml
readinessProbe:
  httpGet:
    path: /readyz
    port: http
  initialDelaySeconds: {{ .Values.{component}.readinessProbe.initialDelaySeconds }}
  periodSeconds: {{ .Values.{component}.readinessProbe.periodSeconds }}
livenessProbe:
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: {{ .Values.{component}.livenessProbe.initialDelaySeconds }}
  periodSeconds: {{ .Values.{component}.livenessProbe.periodSeconds }}
```

---

## Secrets Template

```text
MUST include:
- Guard: {{- if not .Values.{component}.useExistingSecret }}
- Helm hook annotations:
    "helm.sh/hook": "pre-install,pre-upgrade"
    "helm.sh/hook-weight": "-5"
- type: Opaque
- data: using range + b64enc OR stringData with range + quote
```

### Two Valid Patterns

```text
Pattern 1 (b64enc - explicit encoding):
  data:
    KEY: {{ .Values.{component}.secrets.KEY | default "" | b64enc | quote }}

Pattern 2 (stringData - auto encoding, preferred):
  stringData:
    {{- range $key, $value := .Values.{component}.secrets }}
    {{ $key }}: {{ $value | quote }}
    {{- end }}

MUST have helm hook annotations:
  annotations:
    "helm.sh/hook": "pre-install,pre-upgrade"
    "helm.sh/hook-weight": "-5"

MUST support existing secrets:
  {{- if not .Values.{component}.useExistingSecret }}
```

> **Prefer external secret stores on AKS.** For real workloads, source secrets
> from Azure Key Vault via the Secrets Store CSI driver (or External Secrets
> Operator) and set `useExistingSecret: true` pointing at the synced Kubernetes
> Secret. Inline `secrets:` values are for local/dev only and MUST stay empty in
> committed values files.

---

## initContainers Pattern (wait-for-dependencies)

```yaml
initContainers:
  - name: wait-for-dependencies
    image: busybox:1.37
    envFrom:
    - configMapRef:
        name: {{ include "{component}.fullname" . }}
    command:
      - /bin/sh
      - -c
      - >
        for svc in "$DB_HOST:$DB_PORT" "$RABBITMQ_HOST:$RABBITMQ_PORT_AMQP";
        do
          echo "Checking $svc...";
          while ! nc -z $(echo $svc | cut -d: -f1) $(echo $svc | cut -d: -f2); do
            echo "$svc is not ready yet, waiting...";
            sleep 5;
          done;
          echo "$svc is ready!";
        done;
```

EF Core migrations should run as a separate pre-upgrade Job/initContainer
(`dotnet ef database update` or a bundled migration executable), never inside
the app container's normal startup path. See dependencies.md → Bootstrap Jobs.

---

## envFrom Pattern (Bulk Injection)

```yaml
envFrom:
- secretRef:
    name: {{ if .Values.{component}.useExistingSecret }}{{ .Values.{component}.existingSecretName }}{{ else }}{{ include "{component}.fullname" . }}{{ end }}
- configMapRef:
    name: {{ include "{component}.fullname" . }}
```

> **.NET configuration mapping:** ASP.NET Core reads environment variables into
> `IConfiguration` automatically. Use the double-underscore separator for nested
> keys — e.g. `ConnectionStrings__Default`, `Logging__LogLevel__Default`,
> `Serilog__MinimumLevel`. Keep those keys in the ConfigMap (non-secret) and the
> connection-string passwords in the Secret.

---

## Dynamic Environment Variables

```yaml
# OpenTelemetry (only when enabled)
{{- if eq (toString .Values.{component}.configmap.ENABLE_TELEMETRY) "true" }}
env:
- name: "HOST_IP"
  valueFrom:
    fieldRef:
      fieldPath: status.hostIP
- name: "OTEL_EXPORTER_OTLP_ENDPOINT"
  value: "http://$(HOST_IP):4317"
{{- end }}
```

The OpenTelemetry .NET SDK reads `OTEL_EXPORTER_OTLP_ENDPOINT` and
`OTEL_RESOURCE_ATTRIBUTES` from the environment, so no code change is needed to
point at a node-local collector.

---

## HPA Template

```text
CONDITIONAL: Only render when autoscaling.enabled AND not using KEDA

Guard: {{- if .Values.{component}.autoscaling.enabled }}

MUST use apiVersion: autoscaling/v2
MUST include both CPU and memory metrics (conditional on values)
MUST include scaleDown stabilization window
```

---

## ConfigMap Template

```text
MUST include:
1. Common shared values: {{- range $key, $value := .Values.common.configmap }}
2. Component-specific values: {{- range $key, $value := .Values.{component}.configmap }}
3. Extra env vars: {{- with .Values.{component}.extraEnvVars }}

ALL values MUST be quoted: {{ $value | quote }}
```

---

## Helpers (_helpers.tpl)

MUST define these helper functions per component:

```text
FOR EACH component in components:
  DEFINE:
    - {component}.name          → truncated to 63 chars
    - {component}.fullname      → truncated to 63 chars
    - {component}.chart         → {chartName}-{version} replacing + with _
    - {component}.labels        → standard Kubernetes labels
    - {component}.selectorLabels → app.kubernetes.io/name + instance
    - {component}.versionLabelValue → truncated to 63 chars

  ALSO DEFINE (if applicable):
    - {component}.serviceAccountName
    - global.namespace          → from namespaceOverride or Release.Namespace
```

### Mandatory Labels

```yaml
labels:
  helm.sh/chart: {{ include "{component}.chart" .context }}
  app.kubernetes.io/name: {{ .name }}
  app.kubernetes.io/instance: {{ .context.Release.Name }}
  app.kubernetes.io/version: {{ include "{component}.versionLabelValue" .context }}
  app.kubernetes.io/managed-by: {{ .context.Release.Service }}
```

For multi-component charts, ALSO add:
```yaml
  app.kubernetes.io/component: {component-name}
  app.kubernetes.io/part-of: {service_name}
```
