# Helm Dependencies (.NET Standard)

## Dependency Chart Versions (Current Standard)

```text
postgresql:  bitnami v16.x   (charts.bitnami.com/bitnami)
redis:       bitnami v20.x   (charts.bitnami.com/bitnami)
rabbitmq:    bitnami v15.x   (charts.bitnami.com/bitnami)
keda:        kedacore v2.17.x (kedacore.github.io/charts)
```

> **Prefer managed data services on Azure.** For production on AKS, back
> PostgreSQL with **Azure Database for PostgreSQL Flexible Server** and Redis
> with **Azure Cache for Redis** rather than in-cluster subcharts. Use the
> subcharts (below) for local/dev and CI, and set `postgresql.enabled: false`
> etc. in production values, pointing the app at the managed endpoint via the
> `global.external*Definitions` block.

---

## Supported Dependencies Configuration

```text
FOR EACH dependency in dependencies:

  postgresql:
    Chart: bitnami/postgresql (version 16.x)
    Condition: postgresql.enabled
    Values: auth.username, auth.password, auth.database, primary.persistence.size

  redis:
    Chart: bitnami/redis (version 20.x)
    Condition: redis.enabled
    Values: auth.enabled, auth.password, master.persistence.size

  rabbitmq:
    Chart: bitnami/rabbitmq (version 15.x)
    Condition: rabbitmq.enabled
    Values: auth.username, auth.password, persistence.size

  keda:
    Chart: kedacore/keda (version 2.17.x)
    Condition: keda.enabled
    Values: crds.install, operator.resources
```

Declare these in `Chart.yaml` under `dependencies:` with a `condition:` so each
can be toggled per environment:

```yaml
dependencies:
  - name: postgresql
    version: "16.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
  - name: redis
    version: "20.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
```

Run `helm dependency update` after editing dependencies.

---

## Bootstrap Jobs (External Dependencies & Migrations)

```text
if global.externalPostgresDefinitions.enabled:
  → Create bootstrap-postgres.yaml Job
  → Idempotent: check if DB/role exists before creating
  → Use initContainer to wait for DB availability
  → Create role, database, grant privileges

EF Core migrations (.NET):
  → Run as a pre-upgrade Helm hook Job, NOT inside app startup
  → Job runs the migration bundle or `dotnet {App}.dll --migrate`
  → Annotations:
       "helm.sh/hook": "pre-upgrade,pre-install"
       "helm.sh/hook-weight": "-1"
       "helm.sh/hook-delete-policy": "before-hook-creation,hook-succeeded"
  → Reuse the app image + envFrom (Secret + ConfigMap) so the connection string matches
```

Example migration Job container command using a self-contained EF migration
bundle produced at build time (`dotnet ef migrations bundle`):

```yaml
containers:
  - name: db-migrate
    image: "{{ .Values.api.image.repository }}:{{ .Values.api.image.tag }}"
    command: ["/app/efbundle", "--connection", "$(ConnectionStrings__Default)"]
    envFrom:
      - secretRef:
          name: {{ include "api.fullname" . }}
      - configMapRef:
          name: {{ include "api.fullname" . }}
    restartPolicy: Never
```

Migrations must be idempotent and safe to run on every deploy; EF Core's
`__EFMigrationsHistory` table guarantees each migration applies once.
