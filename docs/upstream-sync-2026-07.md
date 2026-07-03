# Sincronização com o Upstream (LerianStudio/ring) — Análise de Gap

> **Data:** 2026-07-02
> **Upstream:** https://github.com/LerianStudio/ring (Go)
> **Fork:** QuelitonSouza/ring (adaptado para C#/.NET + times PT-BR)
> **Objetivo:** portar as melhorias de metodologia do upstream, adaptando o que é
> específico de Go para o ecossistema Microsoft (C#/.NET), sem quebrar o que já funciona.

## Contexto essencial

- Os dois repositórios **não têm histórico git em comum** (o fork foi criado copiando
  arquivos). Não há merge/rebase possível — a sincronização é **porte seletivo de conteúdo**.
- O upstream está **muito à frente** em volume: +132 arquivos no `dev-team`, +50 no
  `default`, +38 no `pm-team`, +9 no `tw-team` (o `shared` está igual).
- Nem tudo deve ser portado. Muito da evolução é **infraestrutura interna da Lerian**
  (Lerian Map/Gandalf, `lib-commons`/`lib-observability`/`lib-systemplane`) ou **específico
  de Go** — nada disso existe no mundo .NET.

## Legenda de decisão

| Marca | Significado |
|-------|-------------|
| 🟢 **PORT** | Agnóstico de linguagem — portar quase como está |
| 🟡 **ADAPT** | Específico de Go — recriar equivalente em C#/.NET |
| 🔴 **SKIP** | Interno Lerian / Go-only — não se aplica ao seu fork |

---

## Fase 1 — Metodologia portável (🟢 PORT)

### shared-patterns de alto valor (o speedup "Prancy Bentley")
| Arquivo upstream | O que traz | Prioridade |
|------------------|-----------|------------|
| `dev-team/skills/shared-patterns/standards-cache-protocol.md` | Cache de standards por ciclo (WebFetch cai de ~20 para ~5) | ⭐ Alta |
| `dev-team/skills/shared-patterns/gate-cadence-classification.md` | Taxonomia subtask/task/cycle — 40–50% menos wall-clock | ⭐ Alta |
| `dev-team/skills/shared-patterns/file-size-enforcement.md` | Limite de tamanho de arquivo (qualidade/refino) | Média |
| `dev-team/skills/shared-patterns/migration-safety-checks.md` | Checklist de segurança em migração de schema | Média |
| `dev-team/skills/shared-patterns/multi-tenant-analysis.md` | Análise de multi-tenancy (conceito portável) | Média |
| `dev-team/skills/shared-patterns/anti-rationalization-visual-report.md` | Relatório visual anti-racionalização | Baixa |

### Skills de capacidade (produção/operação) — agnósticas
| Arquivo upstream | O que traz | Prioridade |
|------------------|-----------|------------|
| `dev-team/skills/reviewing-operational-risk/` | Revisão de risco operacional (+ script de scan) | ⭐ Alta |
| `dev-team/skills/auditing-dependency-security/` | Auditoria de segurança de dependências | ⭐ Alta |
| `dev-team/skills/hardening-dockerfiles/` | Hardening de Dockerfile | ⭐ Alta |
| `dev-team/skills/implementing-readyz/` | Health/readiness endpoints (readyz) | Média |
| `dev-team/skills/load-testing-with-k6/` | Teste de carga com k6 | Média |
| `dev-team/skills/adding-multi-tenancy/` | Adicionar multi-tenancy | Média |
| `dev-team/skills/applying-composition-patterns/` | Padrões de composição | Média |
| `dev-team/skills/planning-backend-refactor/` | Planejar refactor de backend | Média |
| `dev-team/skills/planning-codebase-simplification/` | Planejar simplificação de codebase | Baixa |
| `dev-team/skills/creating-helm-charts/` + `docs/standards/helm/` | Helm (infra, agnóstico) | Baixa* |

### Agents revisores especializados — agnósticos
Portar como novos agentes revisores (complementam os seus atuais):
`security-reviewer`, `perf-reviewer`, `test-reviewer`, `dead-code-reviewer`,
`obs-reviewer`, `logic-reviewer`, `code-reviewer`, `commons-reviewer`.

> *Helm só vale se você usa Kubernetes; se o deploy é Azure App Service/Container Apps,
> pode virar um standard "deploy .NET no Azure" em vez de Helm.

---

## Fase 2 — Standards de Go → C#/.NET (🟡 ADAPT)

Hoje seu fork tem `dev-team/docs/standards/csharp.md` (**arquivo único**). O upstream
transformou `golang.md` numa **pasta modular** com 20 módulos. Proposta: criar
`dev-team/docs/standards/csharp/` espelhando os módulos, adaptados ao stack .NET.

| Módulo Go (upstream) | Equivalente C#/.NET a criar | Stack alvo |
|----------------------|------------------------------|-----------|
| `golang/architecture.md` (CQRS) | `csharp/architecture.md` | Clean Arch, DDD, Hexagonal, MediatR/CQRS |
| `golang/api-patterns.md` | `csharp/api-patterns.md` | ASP.NET Core (Minimal API/Controllers), ProblemDetails |
| `golang/domain.md` + `domain-modeling.md` | `csharp/domain.md` | Entidades, Value Objects, agregados |
| `golang/caching.md` | `csharp/caching.md` | IMemoryCache, IDistributedCache, Redis |
| `golang/idempotency.md` | `csharp/idempotency.md` | Idempotency-Key, chave de dedup |
| `golang/messaging.md` | `csharp/messaging.md` | MassTransit, Azure Service Bus, RabbitMQ |
| `golang/multi-tenant.md` | `csharp/multi-tenant.md` | Tenant middleware, filtro global EF Core |
| `golang/migration-safety.md` | `csharp/migration-safety.md` | EF Core migrations, expand/contract |
| `golang/security.md` | `csharp/security.md` | Auth (JWT/OIDC), rate limiting, CORS, DataProtection |
| `golang/bootstrap.md` | `csharp/bootstrap.md` | DI, `Program.cs`, OpenTelemetry .NET |
| `golang/core.md` | `csharp/core.md` | Convenções base, nullable, analyzers |
| `golang/quality.md` | `csharp/quality.md` | Analyzers, StyleCop, warnings-as-errors |
| `golang/testing-unit.md` | `csharp/testing-unit.md` | xUnit, FluentAssertions, Moq/NSubstitute |
| `golang/testing-integration.md` | `csharp/testing-integration.md` | WebApplicationFactory, Testcontainers |
| `golang/testing-property.md` | `csharp/testing-property.md` | FsCheck |
| `golang/idempotency`,`compliance` | `csharp/compliance.md` | Checklist de conformidade consolidado |
| `golang/index.md` | `csharp/index.md` | Índice modular + tabela "qual arquivo pra quê" |

> Também atualizar `standards-coverage-table.md` e `standards-workflow.md` (que já existem
> no seu fork) para apontar para a nova pasta `csharp/`.

---

## SKIP — não portar (🔴)

Interno Lerian ou Go-only. Nenhuma ação:
- **Lerian Map / Gandalf** — sync de board kanban via webhook proprietário.
- **`lib-commons` / `lib-observability` / `lib-systemplane` / `huma`** — bibliotecas Go da Lerian
  (skills `adopting-lib-commons-huma-wrapper`, `migrating-to-lib-observability`,
  `migrating-to-lib-systemplane`, `using-assert`).
- **`detecting-goroutine-leaks`**, `qa-modes/goroutine-leak.md`, `gomock` — específicos de Go.
- **`systemplane-reviewer`**, `streaming-reviewer`, `tenancy-reviewer` — acoplados a padrões Lerian/Go.
- **Agents Go**: `backend-go.md` (você já tem `backend-engineer-csharp.md`).
- **Toda a pasta `docs/standards/golang/`** — substituída pela `csharp/` adaptada acima.

---

## Ordem de execução proposta

1. **Fase 1a** — shared-patterns de alto valor (cache de standards, cadência de gates, file-size).
2. **Fase 1b** — skills de operação/produção (operational-risk, dependency-security, dockerfile-hardening).
3. **Fase 1c** — agents revisores portáveis.
4. **Fase 2** — pasta `csharp/` de standards (adaptação Go→.NET), módulo a módulo.
5. **Ajuste final** — atualizar `marketplace.json` (versão + contagem), `CLAUDE.md`,
   `standards-coverage-table.md`, `standards-workflow.md` e `using-dev-team`.

## Riscos & cuidados

- **Não sobrescrever** os seus arquivos C#/.NET e times PT-BR que já funcionam.
- O upstream usa nomes de skill em gerúndio (`writing-plans`, `reviewing-code`); seu fork usa
  outro padrão (`dev-cycle`, `dev-implementation`). **Não vou renomear** o que existe — só
  adiciono o que é novo, mantendo seu padrão.
- Cada standard C# adaptado deve ser **idiomático .NET**, não uma tradução literal do Go.
