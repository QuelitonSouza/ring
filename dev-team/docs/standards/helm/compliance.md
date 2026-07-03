# Helm Standards Compliance

## Standards Compliance Output Format

When invoked from the `ring:dev-refactor` skill with a codebase-report.md, the
Helm reviewer MUST produce a Standards Compliance section comparing the chart
against these .NET Helm conventions.

### Output Format

```markdown
## Standards Compliance

| # | Convention | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Chart naming (-helm suffix) | ✅/❌ | Chart.yaml name field |
| 2 | ConfigMap/Secrets split | ✅/❌ | file:line |
| 3 | Security context (runAsNonRoot, drop ALL, readOnlyRootFilesystem) | ✅/❌ | file:line |
| 4 | Probe paths match app (/healthz, /readyz) | ✅/❌ | file:line |
| 5 | Config coverage (100% of appsettings/.env) | ✅/❌ | N covered / M total |
| 6 | HPA enabled | ✅/❌ | file:line |
| 7 | PDB enabled | ✅/❌ | file:line |
| 8 | Service ClusterIP | ✅/❌ | file:line |
| 9 | Ingress disabled by default | ✅/❌ | file:line |
| 10 | Labels (app.kubernetes.io/*) | ✅/❌ | file:line |
| 11 | Resource limits set (memory for GC) | ✅/❌ | file:line |
```

## Checklist

```text
CHECK each item:

[ ] Chart.yaml name has -helm suffix (unless documented exception)
[ ] All values quoted in ConfigMap ({{ $value | quote }})
[ ] No hardcoded credentials in values.yaml (placeholders / empty; source from Key Vault)
[ ] Connection string password lives in the Secret, not the ConfigMap
[ ] Security context: runAsNonRoot: true, drop ALL capabilities, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false
[ ] Service type is ClusterIP (never NodePort or LoadBalancer)
[ ] HPA enabled by default with CPU and memory metrics
[ ] PDB enabled by default
[ ] Liveness probe → /healthz, readiness probe → /readyz, both verified against Program.cs
[ ] initContainers wait for all infrastructure dependencies
[ ] EF Core migrations run as a pre-upgrade hook Job, not in app startup
[ ] Secrets support useExistingSecret pattern (Key Vault CSI / External Secrets)
[ ] All configuration keys from appsettings.json + .env.example are present
[ ] Memory resource limit set (the .NET GC sizes the heap from the cgroup limit)
[ ] OTEL injection is conditional on ENABLE_TELEMETRY
[ ] terminationGracePeriodSeconds ≥ HostOptions.ShutdownTimeout for workers
[ ] Ingress disabled by default
```
