# Exemplos de Workflow Ring

> Guia prático de como usar os workflows do Ring para desenvolvimento de features.

---

## 🔄 Workflow Completo (Com Worktree)

Recomendado para **features novas** onde você precisa explorar opções.

### Passo 1: Brainstorm

```
/ring:brainstorm Quero implementar um cadastro de usuário com validação 
de email, senha forte e confirmação por email. Preciso de ideias de 
abordagens e trade-offs.
```

### Passo 2: Criar Plano (após aprovar design)

```
/ring:write-plan Criar plano de execução para o cadastro de usuário 
aprovado no brainstorm anterior.
```

### Passo 3: Criar Branch Isolada

```
/ring:using-git-worktrees Criar worktree para feature user-registration
```

### Passo 4: Implementar

```
/ring:dev-cycle docs/tasks/user-registration.md
```

### Passo 5: Code Review

```
/ring:codereview Revisar implementação do cadastro de usuário
```

### Passo 6: Finalizar

```
/ring:finishing-a-development-branch Merge da feature user-registration
```

---

## ⚡ Workflow Rápido (Sem Brainstorm)

Para features onde você **já sabe o que quer**.

### Passo 1: Criar Plano

```
/ring:write-plan Implementar endpoint POST /api/users que recebe 
{email, password, name}, valida dados, cria usuário no banco e 
retorna 201 com o ID.
```

### Passo 2: Implementar

```
/ring:dev-cycle docs/tasks/create-user-endpoint.md
```

### Passo 3: Code Review

```
/ring:codereview Revisar endpoint de criação de usuário
```

---

## 🎯 Workflow com Prompt-Only (Mais Rápido)

Quando **não quer criar arquivo de tasks**:

### Implementar Direto

```
/ring:dev-cycle --prompt "Adicionar campo 'phone' opcional ao modelo User 
com máscara brasileira (XX) XXXXX-XXXX. Incluir validação e migration."
```

### Code Review

```
/ring:codereview Revisar adição do campo phone
```

---

## 🚀 Workflow Único (full-feature)

Combina todos os passos em **um único comando**:

```
/ring:full-feature Implementar cadastro de usuário com email, senha e nome
```

---

## 📋 Resumo por Cenário

| Cenário | Comandos |
|---------|----------|
| **Feature nova (incerta)** | brainstorm → plan → worktree → dev-cycle → review → finish |
| **Feature planejada** | plan → worktree → dev-cycle → review → finish |
| **Ajuste rápido** | dev-cycle --prompt → review |
| **Hotfix urgente** | dev-cycle --prompt (skip review se necessário) |
| **Tudo em um** | full-feature |

---

## 💡 Dicas

1. **Use brainstorm** quando não tem certeza da melhor abordagem
2. **Use worktree** para features que demoram mais que 1 dia
3. **Use --prompt** para mudanças pequenas e bem definidas
4. **Use full-feature** quando quer o fluxo completo automatizado
