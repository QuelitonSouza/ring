# Helm Worker Patterns (.NET Standard)

Applies to .NET background services — a Generic Host running one or more
`BackgroundService` / `IHostedService` implementations (e.g. a queue consumer or
scheduled processor), typically created from the `Worker Service` template and
hosting no HTTP server.

## Dual-Mode Worker Pattern

MUST support both KEDA (default) and Deployment modes:

```text
MODE SELECTION:
  if keda.enabled OR keda.external:
    → Render ScaledJob (keda-scaled-job.yaml)
    → Render TriggerAuthentication (common/keda-trigger-authentication.yaml)
  else:
    → Render Deployment (deployment.yaml)
    → Render HPA (hpa.yaml)

GUARD in templates:
  ScaledJob:   {{- if or .Values.keda.enabled .Values.keda.external }}
  Deployment:  {{- if not (or .Values.keda.enabled .Values.keda.external) }}
```

---

## Worker Dual-Mode Pattern (Agent Reference)

```text
if service has a background worker (.NET BackgroundService / Worker host):

  MODE 1 - KEDA (default):
    Guard: {{- if or .Values.keda.enabled .Values.keda.external }}
    Template: keda-scaled-job.yaml
    + keda-trigger-authentication.yaml in common/

  MODE 2 - Deployment (fallback / always-on pool):
    Guard: {{- if not (or .Values.keda.enabled .Values.keda.external) }}
    Template: deployment.yaml + hpa.yaml
    replicaCount: minimum pool (typically 2+)

  BOTH modes MUST include:
    - Same container spec (envFrom, resources, env vars)
    - initContainers for dependency checks
    - Graceful shutdown honoured (see below)
```

> **Graceful shutdown (.NET):** the Generic Host stops `BackgroundService`
> instances on SIGTERM and waits up to `HostOptions.ShutdownTimeout`
> (default 30s). Set the pod `terminationGracePeriodSeconds` to be **greater
> than** that timeout so in-flight messages finish. For KEDA ScaledJobs this
> lets a job drain its batch before the pod is killed.

---

## ScaledJob Template (KEDA mode)

```text
MUST include:
- jobTargetRef with backoffLimit, ttlSecondsAfterFinished, activeDeadlineSeconds
- Container spec matching Deployment pattern (envFrom, resources, etc.)
- restartPolicy: Never
- Triggers with authenticationRef
- Polling interval, history limits, maxReplicaCount
```

For a queue-driven .NET worker, the trigger is typically the queue depth. The
worker should be written to process a bounded batch and then exit cleanly so the
job completes — pair this with `HostApplicationLifetime.StopApplication()` once
the queue is drained, or run as a finite console host rather than an endless
service.

---

## Worker Deployment Template (non-KEDA mode)

```text
MUST include:
- Same container spec as ScaledJob
- initContainers for dependency checks
- livenessProbe (see below)
- replicaCount as minimum pool size (typically 2+)
```

### Health checks for a worker with no HTTP server

A pure `BackgroundService` worker has no Kestrel endpoint, so httpGet probes do
not apply. Two accepted options:

```text
OPTION A - Add a minimal health endpoint (preferred for consumers):
  Host a tiny Kestrel listener exposing /healthz and /readyz via
  AddHealthChecks(), then use httpGet probes exactly like an API.
  This is the most observable option and reuses the standard probe template.

OPTION B - Command/liveness file probe (for jobs with no listener):
  livenessProbe:
    exec:
      command: ["/bin/sh", "-c", "test -f /tmp/healthy"]
  The worker touches /tmp/healthy on each successful loop iteration and stops
  touching it when unhealthy. Requires a writable /tmp (mount an emptyDir).
```

Prefer OPTION A when the worker is a long-running consumer; OPTION B suits
short-lived KEDA ScaledJobs where a full HTTP stack is unwarranted.
