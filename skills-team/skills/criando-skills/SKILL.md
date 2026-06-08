---
name: ring:criando-skills
description: |
  Como criar, encontrar e instalar skills do Claude Code. Explica progressive disclosure
  (skills que se ativam sozinhas pelo contexto), quando criar uma skill, onde procurar
  skills existentes antes de construir, e onde instalar no Windows.

trigger: |
  - Usuário quer criar uma skill nova
  - Usuário quer automatizar um fluxo repetitivo
  - Usuário pergunta "onde acho skills" ou "como instalo uma skill"
  - Transformar um processo manual recorrente em skill
  - Usuário menciona "skill", "automatizar", "progressive disclosure"

skip_when: |
  - Tarefa única que não se repete (faça direto, não vire skill)
  - Convenção específica do projeto que pertence ao CLAUDE.md
  - Regra global de comportamento (vai em settings/hooks, não em skill)

related:
  similar: [ring:writing-skills]
---

# Criando Skills

> **Filosofia:** Use IA como SISTEMA, não como chatbot. Um chatbot espera você lembrar de pedir.
> Um sistema tem skills que se ATIVAM sozinhas pelo contexto — você nem precisa lembrar que existem.
> **Princípio Central:** A `description` é o ativo mais importante. É o gatilho que faz a skill aparecer.

## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [anatomia-skill.md](anatomia-skill.md) | 🔴 **OBRIGATÓRIO** | Estrutura da pasta, frontmatter, skeleton e instalação manual |

---

## Como Skills Economizam Contexto (Progressive Disclosure)

> **PARE!** Antes de escrever a skill, entenda como o Claude a "enxerga".

O Claude **não carrega todas as skills inteiras** na memória. Isso estouraria o contexto. Em vez disso:

```
1. No início da sessão → Claude lê APENAS a `description` de TODAS as skills
2. Você conversa normalmente → Claude compara seu contexto com cada description
3. O contexto bate com uma description → Claude carrega a skill INTEIRA
4. A skill aponta para arquivos de apoio → Claude lê só os que precisa
```

Isso é **progressive disclosure** (revelação progressiva): o detalhe só entra no contexto quando é relevante.

| Camada | O que entra no contexto | Custo |
|--------|-------------------------|-------|
| **Sempre** | A `description` de cada skill (1-3 linhas) | Baixíssimo |
| **Quando o contexto bate** | O corpo do `SKILL.md` inteiro | Médio |
| **Sob demanda** | Arquivos de apoio referenciados (`anatomia-skill.md`, etc.) | Só quando lido |

**Consequência prática:** se a `description` for vaga, a skill **nunca ativa** — fica invisível mesmo existindo. Por isso a `description` é o ativo mais importante. Detalhes em [anatomia-skill.md](anatomia-skill.md).

| Description ruim (não dispara) | Description boa (dispara) |
|--------------------------------|---------------------------|
| "Ajuda com SQL" | "Otimiza queries SQL lentas, lê EXPLAIN, sugere índices. Use quando query demora >1s ou tem full table scan." |
| "Skill de deploy" | "Faz deploy no Vercel via CLI. Use quando usuário diz 'deploy', 'subir pra produção' ou 'publicar'." |
| "Boas práticas de React" | "Revisa componentes TSX: hooks, acessibilidade, performance. Use após editar 2+ componentes React." |

---

## Skill vs CLAUDE.md vs Comando

> **OBRIGATÓRIO:** Escolha o mecanismo certo. Cada um existe por um motivo.

| Você quer... | Use | Por quê |
|--------------|-----|---------|
| Conhecimento que ativa **só em certo contexto** | **Skill** | Progressive disclosure — não polui o contexto sempre |
| Regra que vale para **todo o projeto, sempre** | **CLAUDE.md** | Carregado em toda sessão, não é condicional |
| Ação disparada por um **comando explícito** (`/deploy`) | **Comando** | Você invoca quando quiser, não depende de gatilho |
| Comportamento automático em **evento** (ao salvar, ao commitar) | **Hook** (settings) | O harness executa, não o Claude |

**Regra de bolso:**

- Se a resposta é "isso vale sempre" → **CLAUDE.md**.
- Se a resposta é "isso vale quando eu estiver fazendo X" → **Skill**.
- Se a resposta é "isso roda quando EU mandar" → **Comando**.
- Se a resposta é "isso roda sozinho em todo X" → **Hook**.

---

## PROCURE ANTES DE CRIAR

> **EVITE reinventar.** O princípio anti-duplicação do Ring vale aqui: antes de escrever uma skill, procure se já existe. Reusar > recriar.

| Onde procurar | O que é | Quando usar |
|---------------|---------|-------------|
| **skills.sh** | Diretório da comunidade ("Find Skills") | Primeira parada — busca skills por palavra-chave |
| **github.com/anthropics/skills** | Repositório oficial da Anthropic | Skills mantidas pela própria Anthropic (docx, pdf, pptx, xlsx...) |
| **Ring marketplace** | Este repositório (`ring:*`) | Já tem TDD, code review, debugging, design, SEO, etc. |

**Fluxo de busca:**

```
1. Procure em skills.sh por palavra-chave (ex: "changelog", "migration")
2. Não achou? Veja o repo oficial anthropics/skills
3. Não achou? Veja se o Ring já cobre (ring:writing-skills, ring:test-driven-development...)
4. SÓ ENTÃO crie uma nova — e considere contribuir de volta
```

---

## Ferramentas

| Ferramenta | O que faz | Como acessar |
|------------|-----------|--------------|
| **Skill Creator** | Faz o scaffolding (esqueleto) de uma skill nova, ajuda a escrever a description e roda evals | `anthropic-skills:skill-creator` |
| **Find Skills** | Descobre skills da comunidade por busca | skills.sh |
| **ring:writing-skills** | Autoria rigorosa estilo TDD (testar a skill contra cenários de pressão antes de confiar) | Skill do Ring |

---

## Onde Instalar (Windows)

> **OBRIGATÓRIO:** O lugar onde a pasta da skill vive define o ESCOPO dela.

| Escopo | Caminho | Vale para |
|--------|---------|-----------|
| **Pessoal** | `C:\Users\<user>\.claude\skills\<nome>\SKILL.md` | Todos os seus projetos, só você |
| **Projeto** | `<projeto>\.claude\skills\<nome>\SKILL.md` | Quem clonar o projeto (versionado no git) |
| **Plugin** | Instalado via marketplace | Distribuído como pacote (`ring:*` vive assim) |

**Decisão rápida:**

- "Quero isso em todo projeto meu" → **Pessoal**.
- "Quero que o time também tenha" → **Projeto** (commit no repo).
- "Quero distribuir publicamente" → **Plugin** (marketplace).

Comandos PowerShell de instalação manual estão em [anatomia-skill.md](anatomia-skill.md).

---

## Processo

> **SEMPRE comece se entrevistando.** Uma skill é definida por DUAS coisas: o que ela faz e QUANDO ativa.

```
1. ENTREVISTE-SE
   └── O que essa skill faz, em uma frase?
   └── QUANDO ela deve ativar? (gatilhos, sintomas, palavras que o usuário usa)
   └── Quando ela NÃO deve ativar? (skip_when)

2. ESCREVA A DESCRIPTION QUE DISPARA
   └── Terceira pessoa, concreta, com gatilhos e sintomas
   └── Esse é o passo mais importante (ver anatomia-skill.md)

3. CRIE A PASTA
   └── skills/<nome-kebab-case>/SKILL.md
   └── Use o Skill Creator (anthropic-skills:skill-creator) para o esqueleto

4. ESCREVA O CORPO
   └── Tabelas de decisão, exemplos antes/depois, checklists
   └── Referencie arquivos de apoio em vez de inflar o SKILL.md

5. TESTE
   └── Reabra o Claude Code
   └── Simule o contexto e veja se a skill ATIVA sozinha
   └── Não ativou? A description está vaga — reescreva
```

**Para autoria rigorosa** (testar a skill contra cenários de pressão, watch-baseline-fail, iterar até ficar à prova de racionalização), use a skill `ring:writing-skills`. Esta skill aqui é sobre o **sistema** de skills; `ring:writing-skills` é sobre o **rigor** de escrever uma.

---

## Anti-Padrões

| ❌ Anti-padrão | Por que é ruim | ✅ Faça |
|----------------|----------------|---------|
| Description genérica ("ajuda com X") | A skill nunca ativa | Description com gatilhos e sintomas concretos |
| Virar skill uma tarefa que só fez 1 vez | Inflam o catálogo sem ganho | Skill só para o que se REPETE |
| Copiar conteúdo entre skills | Vira fonte de drift | Referenciar arquivo de apoio único |
| Skill que deveria ser CLAUDE.md | Regra que vale sempre não é condicional | Mover para CLAUDE.md |
| Não procurar antes de criar | Reinventa o que já existe | Procurar em skills.sh / anthropics/skills / Ring |
| SKILL.md gigante com tudo dentro | Estoura contexto ao carregar | Corpo enxuto + arquivos de apoio |

---

## Checklist

```
[ ] Procurei em skills.sh, anthropics/skills e no Ring antes de criar?
[ ] Isso é realmente uma skill (e não CLAUDE.md / comando / hook)?
[ ] A description está em terceira pessoa, com gatilhos e sintomas?
[ ] A description é específica o bastante para DISPARAR no contexto certo?
[ ] Defini skip_when (quando NÃO ativar)?
[ ] Nome em kebab-case, pasta skills/<nome>/SKILL.md?
[ ] Corpo enxuto, detalhe pesado em arquivos de apoio?
[ ] Escolhi o escopo certo (pessoal / projeto / plugin)?
[ ] Reabri o Claude Code e testei se a skill ATIVA sozinha?
```

---

> **Lembre-se:** O objetivo é parar de usar IA como chatbot. Você não deveria precisar LEMBRAR de uma skill — ela deveria ATIVAR sozinha quando o contexto bate. Se você precisa pedir "use a skill X", a description falhou. Capriche nela.
