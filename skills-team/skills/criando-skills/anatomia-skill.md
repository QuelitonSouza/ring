# Anatomia de uma SKILL.md

> Deep dive na estrutura de uma skill: pasta, frontmatter, a description que dispara,
> convenções de nome, leitura seletiva, eficiência de tokens, skeleton comentado e
> instalação manual no Windows.

---

## 1. Estrutura da Pasta

Uma skill é **uma pasta** com um arquivo `SKILL.md` dentro. Arquivos de apoio são opcionais.

```
skills/
└── minha-skill/                 ← nome em kebab-case (vira o "ring:minha-skill")
    ├── SKILL.md                 ← OBRIGATÓRIO: frontmatter + corpo
    ├── referencia-tecnica.md    ← opcional: detalhe pesado, lido sob demanda
    ├── exemplos.md              ← opcional: antes/depois, casos reais
    └── checklist.md             ← opcional: listas de verificação
```

| Item | Obrigatório? | Função |
|------|--------------|--------|
| Pasta `skills/<nome>/` | Sim | O nome da pasta define o nome da skill |
| `SKILL.md` | Sim | Frontmatter (gatilho) + corpo (conteúdo) |
| Arquivos de apoio (`*.md`) | Não | Detalhe que só entra no contexto quando referenciado |

> **OBRIGATÓRIO:** O arquivo principal chama-se `SKILL.md` (maiúsculas). É o que o Claude procura.

---

## 2. Frontmatter (YAML)

O frontmatter fica no topo, entre `---`. É o que o Claude lê SEMPRE (custo baixo).

| Campo | Obrigatório? | Ordem | Função |
|-------|--------------|-------|--------|
| `name` | Sim | 1º | Identificador. **Deve começar com `ring:`** |
| `description` | Sim | 2º | O GATILHO. O ativo mais importante |
| `trigger` | Recomendado | 3º | Lista de quando ativar (legível para humanos) |
| `skip_when` | Recomendado | 4º | Lista de quando NÃO ativar |
| `sequence` | Opcional | 5º | Relação de ordem com outras skills (`before`/`after`) |
| `related` | Opcional | 6º | Skills relacionadas (`similar`, etc.) |

**Estilo:** use bloco-escalar com pipe (`|`) para `description`, `trigger` e `skip_when` — texto multilinha:

```yaml
description: |
  Primeira linha resume o que faz.
  Segunda linha dá os gatilhos concretos.
```

---

## 3. A Description Que Dispara

> **PARE!** Se você só caprichar em UMA coisa, capriche aqui. Description ruim = skill invisível.

Uma boa `description` é a diferença entre uma skill que ativa sozinha e uma que nunca aparece.

### Os 4 ingredientes

| Ingrediente | O que é | Exemplo |
|-------------|---------|---------|
| **O que faz** | Ação concreta, verbo claro | "Otimiza queries SQL lentas" |
| **Gatilhos** | Palavras/situações que o usuário traz | "Use quando usuário diz 'tá lento'" |
| **Sintomas** | Sinais observáveis no contexto | "query >1s, full table scan, timeout" |
| **Terceira pessoa** | Descreve a skill, não fala com você | "Revisa..." e não "Você deve revisar..." |

### Antes / Depois

| ❌ Description fraca | ✅ Description que dispara |
|--------------------|---------------------------|
| "Ajuda com migrations" | "Cria e revisa migrations de banco. Use quando o usuário altera schema, adiciona coluna ou menciona 'migration', 'ALTER TABLE' ou 'mudança no banco'." |
| "Skill de testes" | "Aplica TDD em código novo: escreve o teste que falha antes da implementação. Use ao criar função, corrigir bug ou quando não há teste cobrindo a mudança." |
| "Documentação de API" | "Escreve referência de endpoint REST: parâmetros, exemplos, códigos de erro. Use ao criar/alterar endpoint ou quando o usuário pede 'documenta essa API'." |

### Erros comuns na description

| Erro | Por que falha | Correção |
|------|---------------|----------|
| Vaga demais ("ajuda com X") | Nada no contexto bate | Adicione gatilhos e sintomas |
| Fala com o usuário ("você deve...") | Não descreve a skill | Terceira pessoa |
| Longa demais (parágrafos) | Dilui o sinal, custa tokens | 1-3 linhas densas |
| Sem QUANDO usar | Claude não sabe quando ativar | Inclua "Use quando..." |

---

## 4. Convenções de Nome

| Regra | Exemplo | Por quê |
|-------|---------|---------|
| **kebab-case** | `criando-skills`, `code-review` | Padrão do sistema, casa com a pasta |
| **Verbo/gerúndio para processos** | `writing-skills`, `debugging-dotnet` | Sinaliza "isto é um fluxo" |
| **Substantivo para domínios** | `seo-fundamentals`, `frontend-design` | Sinaliza "isto é conhecimento" |
| **Prefixo `ring:` no `name`** | `name: ring:criando-skills` | Namespace unificado obrigatório |
| **Nome da pasta = nome da skill** | pasta `criando-skills/` → `ring:criando-skills` | Evita confusão |

> **EVITE** nomes genéricos (`helper`, `utils`, `geral`). O nome deve dizer o domínio ou o processo.

---

## 5. Padrão Leitura Seletiva

Quando a skill tem arquivos de apoio, coloque uma tabela **Leitura Seletiva** logo no topo do `SKILL.md`, marcando o que é obrigatório e o que é opcional:

```markdown
## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [anatomia-skill.md](anatomia-skill.md) | 🔴 **OBRIGATÓRIO** | Sempre leia primeiro! |
| [exemplos.md](exemplos.md)             | ⚪ Opcional        | Casos reais, antes/depois |
```

| Marcador | Significado |
|----------|-------------|
| 🔴 **OBRIGATÓRIO** | Leia sempre que a skill ativar |
| ⚪ Opcional | Leia só se o contexto pedir |

> **OBRIGATÓRIO:** Referencie arquivos irmãos pelo nome RELATIVO (`anatomia-skill.md`). Nunca use caminho absoluto, nunca use `@`-links.

---

## 6. Eficiência de Tokens

> **SEMPRE** trate o contexto como recurso escasso. Progressive disclosure só funciona se você cooperar.

| Faça | Não faça |
|------|----------|
| Description curta e densa (1-3 linhas) | Description de parágrafos |
| Corpo do `SKILL.md` enxuto | Despejar tudo no `SKILL.md` |
| Referenciar arquivo de apoio | Repetir conteúdo entre skills |
| Tabelas e listas | Muros de texto |
| Mover detalhe pesado para `*.md` separado | Inflar o arquivo principal |

**Regra:** o `SKILL.md` carrega quando o contexto bate — mantenha-o no essencial. O detalhe que só às vezes importa vai em arquivo de apoio, lido **sob demanda**.

---

## 7. Skeleton Comentado

Esqueleto mínimo de um `SKILL.md`. Copie, adapte, remova os comentários.

```markdown
---
name: ring:minha-skill            # OBRIGATÓRIO começar com ring:
description: |                     # O GATILHO — capriche aqui
  O que a skill faz em uma frase concreta.
  Use quando <gatilhos> ou quando aparecem <sintomas>.
trigger: |                        # Legível para humanos: quando ativar
  - Situação 1 em que a skill deve aparecer
  - Palavra-chave que o usuário costuma usar
skip_when: |                      # Quando NÃO ativar
  - Caso fora de escopo
  - Tarefa que pertence a outra skill / ao CLAUDE.md
related:                          # Opcional
  similar: [ring:outra-skill]
---

# Minha Skill

> **Filosofia:** uma frase que define o espírito da skill.

## Leitura Seletiva
| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [referencia.md](referencia.md) | 🔴 **OBRIGATÓRIO** | Detalhe técnico |

## 1. Conceito Principal
Tabela de decisão ou explicação enxuta.

## 2. Anti-Padrões
| ❌ Errado | Por quê | ✅ Certo |
|-----------|---------|----------|
| ...       | ...     | ...      |

## 3. Checklist
[ ] Item verificável 1
[ ] Item verificável 2

> **Lembre-se:** frase de fechamento (Regra de ouro).
```

---

## 8. Instalação Manual (Windows / PowerShell)

> **OBRIGATÓRIO:** Reabra o Claude Code depois de copiar a skill — ela é descoberta no início da sessão.

### A) Skill pessoal (vale em todos os seus projetos)

```powershell
# 1. Clone um repositório de skills (exemplo: o oficial da Anthropic)
git clone https://github.com/anthropics/skills.git C:\temp\skills

# 2. Copie a pasta da skill desejada para o seu diretório pessoal
Copy-Item -Recurse C:\temp\skills\<nome-da-skill> `
  "$env:USERPROFILE\.claude\skills\<nome-da-skill>"

# 3. Confirme que o SKILL.md chegou
Test-Path "$env:USERPROFILE\.claude\skills\<nome-da-skill>\SKILL.md"

# 4. Reabra o Claude Code para a skill ser descoberta
```

### B) Skill do projeto (vale para quem clonar o repo)

```powershell
# Copie para a pasta .claude\skills do projeto (versionada no git)
New-Item -ItemType Directory -Force "<projeto>\.claude\skills"
Copy-Item -Recurse C:\temp\skills\<nome-da-skill> `
  "<projeto>\.claude\skills\<nome-da-skill>"

# Reabra o Claude Code
```

### Caminhos de referência

| Escopo | Caminho |
|--------|---------|
| Pessoal | `$env:USERPROFILE\.claude\skills\<nome>\SKILL.md` (= `C:\Users\<user>\.claude\skills\...`) |
| Projeto | `<projeto>\.claude\skills\<nome>\SKILL.md` |
| Plugin | Instalado via marketplace (não copiado à mão) |

### Verificação pós-instalação

```
[ ] A pasta tem um SKILL.md (maiúsculas) dentro?
[ ] O name no frontmatter começa com ring:?
[ ] Reabri o Claude Code?
[ ] Simulei o contexto e a skill ATIVOU sozinha?
[ ] Não ativou? A description está vaga — reescreva com gatilhos.
```

---

> **Lembre-se:** A pasta é o corpo, mas a `description` é o sistema nervoso. Sem ela, a skill existe no disco mas é invisível para o Claude. Anatomia perfeita + description vaga = skill morta.
