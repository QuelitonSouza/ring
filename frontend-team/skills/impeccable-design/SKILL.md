---
name: ring:impeccable-design
description: |
  Revisão, refino e "des-slopificação" de interfaces geradas por IA. Detecta os padrões
  que fazem uma UI parecer feita por IA (gradiente roxo, cards aninhados, texto cinza em
  fundo colorido, bounce, espaçamento uniforme) e aplica um fluxo de comandos
  (shape → craft → critique → polish → audit → harden) até a tela ter qualidade de produção.
  Baseado na metodologia Impeccable (impeccable.style). Complementa ring:frontend-design.

trigger: |
  - Depois de gerar uma tela/componente com IA e quero revisar antes de publicar
  - Usuário diz que a UI está "com cara de IA", "genérica", "sem graça" ou "slop"
  - Pedidos de "polir", "refinar", "dar um tapa", "auditar o design" ou "deixar production-ready"
  - Iterar sobre uma interface existente (mais bold, mais quieto, ajustar cor/tipo/motion)
  - Usuário menciona "Impeccable", "anti-slop", "DESIGN.md" ou "detector de design"

skip_when: |
  - Design do zero sem nada pronto para revisar → use ring:frontend-design primeiro
  - Apenas lógica de backend sem UI
  - Ajuste puramente funcional sem impacto visual

sequence:
  after: [ring:frontend-design]
  before: [ring:verification-before-completion]

related:
  similar: [ring:frontend-design, ring:componentes-acessibilidade, ring:design-responsivo]
---

# Impeccable Design — Anti-Slop & Refino

> **Filosofia:** IA sabe gerar "OK". A diferença entre OK e impecável está na **revisão**.
> **Princípio Central:** DETECTE o slop, ENTENDA por que é slop, CORRIJA com intenção.

Esta skill é o **par de revisão** do `ring:frontend-design`. Enquanto a `frontend-design`
te ajuda a *decidir* o design do zero, esta aqui pega uma tela **já gerada** e a leva de
"parece IA" para "parece produto". É a adaptação nativa da metodologia
[Impeccable](https://impeccable.style/) para o plugin `frontend-team`.

## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [detectores-slop.md](detectores-slop.md) | 🔴 **OBRIGATÓRIO** | Sempre que for revisar/auditar uma UI |
| [workflow-comandos.md](workflow-comandos.md) | ⚪ Conforme necessário | Para o fluxo shape→polish, DESIGN.md e o CLI real |

---

## Por que "slop" acontece

Modelos de IA convergem para a **média** do que viram: o visual "SaaS moderno seguro".
O resultado é competente, mas indistinguível — todo mundo entrega a mesma landing com
gradiente roxo, cards de vidro e ícones arredondados. O trabalho aqui é **quebrar a média
com intenção**, não trocar um clichê por outro.

> Regra de ouro: cada desvio do default precisa de um **motivo ligado à marca ou ao
> usuário**. "Diferente por ser diferente" também é slop.

---

## O Loop de Refino (o coração da skill)

Ao receber uma tela pronta para melhorar, siga este ciclo. Ele espelha os comandos do
Impeccable, mas você executa como raciocínio — não precisa do CLI instalado.

```
1. SHAPE    → Entenda contexto: marca, audiência, o que a tela precisa comunicar
2. CRITIQUE → Rode os detectores de slop (detectores-slop.md). Liste achados por severidade
3. POLISH   → Corrija do mais grave ao menos grave, explicando cada mudança
4. AUDIT    → Verifique acessibilidade/responsivo/performance (as skills irmãs)
5. HARDEN   → Estados de borda: loading, vazio, erro, primeiro uso, texto longo
```

Não precisa ser linear — se a tela já tem contexto claro, pule direto para CRITIQUE.
O detalhamento de cada etapa e dos comandos (`bolder`, `quieter`, `colorize`, etc.)
está em [workflow-comandos.md](workflow-comandos.md).

---

## CRITIQUE: como reportar os achados

Ao auditar, **não** despeje uma lista genérica. Use severidade para o usuário saber o que
importa. Este é o formato esperado:

```markdown
## Revisão de design — [nome da tela]

### 🔴 P0 — Quebra a percepção de qualidade (corrigir sempre)
- [detector] Sintoma concreto → correção proposta

### 🟠 P1 — Slop visível (recomendo corrigir)
- ...

### 🟡 P2 — Refino (opcional, eleva o nível)
- ...

### ✅ O que já está bom
- ... (reconheça os acertos — orienta o que preservar)
```

**Exemplo:**
> 🔴 **P0 — [contraste]** Texto `#9CA3AF` sobre fundo `#6366F1` fica ilegível (contraste
> 1.9:1). → Usar texto branco puro ou escurecer o fundo para passar em WCAG AA (4.5:1).
>
> 🟠 **P1 — [gradiente-clichê]** Hero com mesh gradient roxo→rosa. É a assinatura visual
> de "gerado por IA". → Fundo sólido de alto contraste na cor da marca, ou uma cor
> inesperada justificada pela audiência.

---

## POLISH: princípios ao corrigir

1. **Uma decisão, um motivo.** Ao trocar algo, diga *por quê* ("aumentei o line-height
   para 1.5 porque o texto body estava apertado e cansativo"). Isso ensina o usuário e
   evita que a correção vire outro default cego.
2. **Preserve o que funciona.** Refino não é redesign. Se a hierarquia está boa, mexa só
   no que o detector apontou.
3. **Herde o design system.** Se o projeto tem tokens/componentes, **use-os** em vez de
   inventar valores novos. Consistência > originalidade pontual.
4. **Contraste como ferramenta, não decoração.** Tamanho, peso, cor e espaço existem para
   criar hierarquia — se tudo grita, nada é ouvido.

---

## Como isto conversa com as skills irmãs

Esta skill é a **camada de revisão**; as outras trazem a profundidade de cada dimensão.
Combine sempre que o achado cair no domínio delas:

| Skill | Puxe quando o detector apontar |
|-------|--------------------------------|
| `ring:frontend-design` | Decisão de cor/tipo/hierarquia do zero, ou repensar a direção |
| `ring:componentes-acessibilidade` | Contraste, foco, teclado, ARIA, estados de componente |
| `ring:design-responsivo` | Quebra em mobile, touch targets, tipografia fluida, layout shift |

> Fluxo típico: `frontend-design` (decide) → **`impeccable-design`** (revisa e refina) →
> `componentes-acessibilidade` + `design-responsivo` (aprofundam) → entrega.

---

## Modo turbo: o CLI Impeccable (opcional)

Tudo acima funciona **sem instalar nada** — você aplica os detectores e o loop como
raciocínio. Se o projeto quiser automação (detecção determinística via CLI, Live Mode no
navegador, `DESIGN.md`/`PRODUCT.md` versionados), dá para instalar a ferramenta real:

```bash
npx impeccable install   # na raiz do projeto; depois recarregue o agente
```

Os detalhes de instalação, dos arquivos gerados e de quando vale a pena estão em
[workflow-comandos.md](workflow-comandos.md).

---

> **Lembre-se:** o objetivo não é "não parecer IA" — é **parecer intencional**. Toda
> escolha visual defensável com um motivo ligado à marca ou ao usuário já venceu o slop.
