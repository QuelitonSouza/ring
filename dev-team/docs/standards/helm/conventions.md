# Helm Conventions (.NET Standard)

## Chart Naming

```text
RULE: Chart name in Chart.yaml MUST have "-helm" suffix.

EXAMPLES:
  ✅ onboarding-helm
  ✅ transaction-helm
  ✅ ledger-api-helm
  ❌ onboarding (missing -helm)
```

If a chart genuinely must not carry the suffix (e.g. a shared infrastructure
chart that is referenced by that bare name elsewhere), document the exception
in `docs/PROJECT_RULES.md` rather than inventing it ad hoc.

---

## Chart.yaml Template

```yaml
apiVersion: v2
name: {service}-helm
description: A Helm chart for deploying {service} (ASP.NET Core)
type: application
home: https://github.com/{org}/{service}/tree/main/deploy/charts/{service}
sources:
  - https://github.com/{org}/{service}
maintainers:
  - name: "{team}"
    email: "{team-email}"
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - dotnet
  - aspnetcore
  - {service}
```

`appVersion` tracks the application (container image) version; `version` tracks
the chart. Bump `version` on any chart change, `appVersion` on any app release.

---

## Directory Structure

```text
{service}/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── _helpers.tpl              # OR helpers.tpl (both valid)
│   ├── {component}/              # Per-component directory
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   ├── secrets.yaml
│   │   ├── ingress.yaml
│   │   ├── hpa.yaml
│   │   ├── pdb.yaml
│   │   └── sa.yaml               # ServiceAccount
│   └── common/                   # Shared resources
│       └── keda-trigger-authentication.yaml
└── charts/                       # Subchart dependencies
```

---

## Image Repository Convention

```text
FORMAT: {registry}/{org}/{service-name}

Registries commonly used with .NET on AKS:
  - Azure Container Registry:  {acrname}.azurecr.io/{service-name}
  - GitHub Container Registry: ghcr.io/{org}/{service-name}

For multi-component:
  {registry}/{org}/{service}-{component}

EXAMPLES:
  myacr.azurecr.io/onboarding-api
  myacr.azurecr.io/onboarding-worker
  ghcr.io/{org}/transaction-api
```

Application images are built FROM `mcr.microsoft.com/dotnet/aspnet:8.0`
(runtime) via a multi-stage build — see `deploy-docker-vps.md` and the
project Dockerfile. The chart never references the SDK image.

---

## Service Type Rule

<cannot_skip>
Service type MUST always be ClusterIP.
No NodePort. No LoadBalancer. Ingress handles external access.
</cannot_skip>

On AKS, external access is served by the ingress controller (e.g. NGINX
ingress or Application Gateway Ingress Controller). Individual services stay
internal.

---

## Port Allocation

```text
Recommended port ranges:
  8080-8099: ASP.NET Core APIs (Kestrel default in containers is 8080)
  5432:      PostgreSQL
  5672:      RabbitMQ AMQP
  6379:      Redis
  15672:     RabbitMQ management

ASP.NET Core in a container listens on 8080 by default (ASPNETCORE_HTTP_PORTS=8080).
The containerPort and Service targetPort MUST match ASPNETCORE_HTTP_PORTS.
```
