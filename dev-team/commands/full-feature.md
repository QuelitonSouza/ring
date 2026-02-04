---
name: ring:full-feature
description: Complete feature development workflow - from idea to merge
argument-hint: "[feature-description]"
---

Workflow completo para desenvolvimento de features - da ideia ao merge.

## Usage

```
/ring:full-feature [feature-description]
```

## Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│  1. BRAINSTORM  →  Explorar ideias e validar design        │
├─────────────────────────────────────────────────────────────┤
│  2. WRITE-PLAN  →  Criar plano de execução detalhado       │
├─────────────────────────────────────────────────────────────┤
│  3. NEW-BRANCH  →  Criar nova branch (pergunta antes)     │
├─────────────────────────────────────────────────────────────┤
│  4. DEV-CYCLE  →  Implementar com TDD (6 gates)            │
├─────────────────────────────────────────────────────────────┤
│  5. VERIFICATION  →  Verificar antes de review             │
├─────────────────────────────────────────────────────────────┤
│  6. CODE-REVIEW  →  Review estruturado (3 reviewers)       │
├─────────────────────────────────────────────────────────────┤
│  7. FINISH-BRANCH  →  Merge e limpeza                      │
└─────────────────────────────────────────────────────────────┘
```

## Exemplos de Prompt

### Exemplo 1: Feature Simples

```
/ring:full-feature Implementar cadastro de usuário com email, senha e nome
```

### Exemplo 2: Feature Complexa (com contexto)

```
/ring:full-feature Implementar autenticação JWT com refresh token, 
roles (admin, user, guest) e rate limiting de 100 req/min.
Usar padrão existente do UserRepository.
```

### Exemplo 3: Feature de UI

```
/ring:full-feature Criar dashboard de métricas com gráficos de 
vendas mensais, usuários ativos e taxa de conversão.
Usar ring:frontend-design para decisões de UI.
```

---

## Fase 1: Brainstorm

**Skill:** `ring:brainstorming`

```
Anuncio: "Usando ring:brainstorming para explorar opções de design."

Ações:
1. Autonomous Recon - Analisar repo/docs existentes
2. Understanding - Confirmar objetivo e restrições
3. Exploration - Propor 2-3 abordagens
4. Design Presentation - Validar design em seções
5. Design Documentation - Documentar em docs/plans/
```

**Gate de Saída:** Design aprovado pelo usuário

---

## Fase 2: Write Plan

**Skill:** `ring:writing-plans`

```
Anuncio: "Usando ring:writing-plans para criar plano de execução."

Ações:
1. Criar estrutura de tasks em docs/tasks/
2. Quebrar em subtasks implementáveis
3. Definir critérios de aceitação
4. Mapear dependências
```

**Gate de Saída:** Arquivo de tasks criado

---

## Fase 3: Nova Branch (Perguntar Antes)

**Ação:** Perguntar ao usuário

```yaml
AskUserQuestion:
  questions:
    - question: "Deseja criar uma nova branch para esta feature?"
      header: "Git Branch"
      options:
        - label: "Sim, criar nova branch"
          description: "Cria branch feature/[nome-da-feature]"
        - label: "Não, usar branch atual"
          description: "Continuar na branch atual"
```

```
Se "Sim, criar nova branch":
1. git checkout -b feature/[nome-da-feature]
2. Confirmar: "Branch feature/X criada."

Se "Não, usar branch atual":
1. Informar: "Continuando na branch [branch-atual]."
```

**Gate de Saída:** Usuário confirmou branch de trabalho

---

## Fase 4: Dev Cycle

**Skill:** `ring:dev-cycle`

```
Anuncio: "Iniciando ring:dev-cycle com 6 gates."

Gates:
0. Implementation (TDD: RED → GREEN)
1. DevOps (Docker/compose)
2. SRE (Observability)
3. Testing (85% coverage)
4. Code Review (3 reviewers)
5. Validation (aprovação final)
```

**Gate de Saída:** Todos os 6 gates passando

---

## Fase 5: Verification

**Skill:** `ring:verification-before-completion`

```
Anuncio: "Executando verificação final antes do review."

Checklist:
- [ ] Build passa sem erros
- [ ] Testes passam
- [ ] Lint sem warnings
- [ ] Documentação atualizada
- [ ] Evidências coletadas
```

**Gate de Saída:** Todas verificações OK

---

## Fase 6: Code Review

**Skill:** `ring:requesting-code-review`

```
Anuncio: "Iniciando code review com 3 revisores em paralelo."

Revisores:
1. Foundation - Arquitetura e padrões
2. Correctness - Lógica e edge cases
3. Safety - Segurança e performance

Regra: 3/3 devem aprovar (2/3 = FAIL)
```

**Gate de Saída:** Aprovação de todos os revisores

---

## Fase 7: Finish Branch

**Skill:** `ring:finishing-a-development-branch`

```
Ações:
1. Squash commits se necessário
2. Merge para branch principal
3. Deletar worktree/branch
4. Atualizar documentação
```

**Gate de Saída:** Merge completo

---

## Skills Complementares

Dependendo do contexto, invocar:

| Situação | Skill |
|----------|-------|
| Decisões de UI/UX | `ring:frontend-design` |
| Otimização SEO | `ring:seo-fundamentals` |
| Debug de problemas | `ring:systematic-debugging` |
| Explorar codebase | `ring:exploring-codebase` |

---

## Checkpoints

| Checkpoint | Pergunta |
|------------|----------|
| Após Fase 1 | "Design aprovado. Prosseguir para plano?" |
| Após Fase 2 | "Plano criado. Criar nova branch?" |
| Após Fase 4 | "Dev cycle completo. Iniciar verificação?" |
| Após Fase 6 | "Review aprovado. Fazer merge?" |

---

## Atalhos

```bash
# Skip brainstorm (quando já sabe o que quer)
/ring:full-feature --skip-brainstorm "Implementar X"

# Skip pergunta de branch (usar branch atual)
/ring:full-feature --current-branch "Implementar X"

# Modo rápido (features simples)
/ring:full-feature --quick "Adicionar campo email ao User"
```

---

## ⛔ MANDATORY: Load Skills

Este workflow DEVE carregar as skills em sequência:

```
1. ring:brainstorming
2. ring:writing-plans
3. [Perguntar sobre nova branch]
4. ring:dev-cycle
5. ring:verification-before-completion
6. ring:requesting-code-review
7. ring:finishing-a-development-branch
```

Cada skill contém anti-rationalization tables e pressure resistance.
