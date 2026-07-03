# Workflow de Comandos & Ferramenta Impeccable

Detalhamento do loop de refino, o vocabulário de comandos do Impeccable (que você pode
usar como *modos de trabalho* mesmo sem o CLI), e como/quando instalar a ferramenta real.

## Índice
1. [As 5 etapas do loop, em detalhe](#1-as-5-etapas-do-loop-em-detalhe)
2. [Vocabulário de comandos (modos de refino)](#2-vocabulário-de-comandos-modos-de-refino)
3. [DESIGN.md e PRODUCT.md](#3-designmd-e-productmd)
4. [O CLI Impeccable (modo turbo)](#4-o-cli-impeccable-modo-turbo)
5. [Integração com o fluxo do Ring](#5-integração-com-o-fluxo-do-ring)

---

## 1. As 5 etapas do loop, em detalhe

### SHAPE — entender antes de mexer
Antes de refinar, saiba o que a tela precisa ser. Se não estiver claro, **pergunte**
(igual à Análise de Restrições da `ring:frontend-design`):
- Quem é a audiência? O que ela precisa fazer aqui?
- Qual a marca/tom? Existe design system ou tokens?
- Qual a ação principal desta tela (o único CTA que importa)?

### CRITIQUE — rodar os detectores
Passe a tela por [detectores-slop.md](detectores-slop.md). Produza a lista de achados por
severidade (P0/P1/P2) + o que já está bom. Este é o entregável mais valioso da skill.

### POLISH — corrigir com intenção
Do mais grave ao menos grave. Cada mudança vem com o *porquê*. Herde o design system.
Não redesenhe o que já funciona.

### AUDIT — validar as dimensões técnicas
Puxe as skills irmãs para o que o CRITIQUE apontou:
- Contraste/foco/teclado/ARIA → `ring:componentes-acessibilidade`
- Mobile/touch/tipografia fluida/layout shift → `ring:design-responsivo`
- Performance de render, `transition`, imagens → cheque tamanho e `transform/opacity`

### HARDEN — sobreviver ao mundo real
A tela "feliz" não basta. Garanta:
- **Loading** (skeleton/spinner com propósito)
- **Vazio** (estado inicial que orienta, não uma tela morta)
- **Erro** (mensagem clara + ação de recuperação)
- **Primeiro uso** (onboarding leve quando fizer sentido)
- **Conteúdo extremo** (nome muito longo, lista com 0 e com 1000 itens)

---

## 2. Vocabulário de comandos (modos de refino)

O Impeccable tem 23 comandos. Você não precisa do CLI para usá-los — trate cada um como um
**modo de trabalho** que o usuário pode pedir. Os mais úteis:

| Comando/modo | O que fazer quando pedido |
|--------------|---------------------------|
| `shape` | Levantar requisitos de UX antes de construir |
| `craft` | Projetar e implementar a feature junto |
| `critique` | Revisão de design com achados por severidade (usa os detectores) |
| `audit` | Checagem técnica (acessibilidade, responsivo, performance) |
| `polish` | Ajuste fino final antes de publicar |
| `bolder` | Aumentar impacto/contraste/presença visual |
| `quieter` | Reduzir ruído, mais calma e whitespace |
| `typeset` | Trabalhar só a tipografia (escala, peso, ritmo) |
| `layout` | Reorganizar espaço, grid, hierarquia espacial |
| `colorize` | Revisar a paleta (60-30-10, semântica, contraste) |
| `animate` | Adicionar/ajustar motion com propósito |
| `delight` | Micro-interações que encantam sem distrair |
| `distill` | Cortar excesso, simplificar até o essencial |
| `harden` | Tratar estados de borda e produção |

**Exemplo de uso:** o usuário diz *"deixa esse hero mais bold"* → você está no modo
`bolder`: aumente escala do título, contraste da cor, presença do CTA — sempre explicando.

---

## 3. DESIGN.md e PRODUCT.md

O maior ganho de longo prazo do Impeccable é **externalizar as decisões de design** em dois
arquivos versionados no repo. Vale criar mesmo sem o CLI:

| Arquivo | Conteúdo |
|---------|----------|
| `PRODUCT.md` | Quem é a audiência, marca, voz, tom, o que o produto faz |
| `DESIGN.md` | Paleta, tipografia, escala de espaço, componentes, do's & don'ts visuais |

Por que importa: dá aos agentes (e a você) uma **fonte da verdade** de design. Toda tela
nova nasce consistente, e o CRITIQUE passa a medir contra o `DESIGN.md` do projeto, não
contra um gosto genérico. É o mesmo princípio de "contexto perto da fonte" do resto do Ring.

> Se o projeto já tem um design system (tokens, Tailwind config, biblioteca de
> componentes), o `DESIGN.md` **aponta para ele** em vez de duplicar.

---

## 4. O CLI Impeccable (modo turbo)

Quando o projeto quer automação de verdade, instale a ferramenta:

```bash
npx impeccable install   # na raiz do projeto
# recarregue o agente (reabrir o Claude Code)
/impeccable init         # gera PRODUCT.md e DESIGN.md guiado
```

O que o CLI adiciona sobre o modo "raciocínio":
- **Slop detection determinística** — 45 regras rodando via CLI + extensão de navegador,
  pegando anti-padrões automaticamente antes do deploy.
- **Live Mode** — itera no navegador (`localhost:4321`) com HMR, testando variações lado a lado.
- **Comandos `/impeccable <cmd>`** nativos no agente.

Suporta Claude Code, Cursor, Copilot, Gemini CLI, Codex. Stack: JS/Astro/TS/Svelte, Bun.

**Quando vale instalar:** projetos frontend ativos e recorrentes (ex.: um app com deploy
contínuo). Para uma revisão pontual, o modo raciocínio desta skill já resolve.

Links: https://impeccable.style/ · https://impeccable.style/docs/ · https://github.com/pbakaus/impeccable

---

## 5. Integração com o fluxo do Ring

Onde esta skill se encaixa na esteira de frontend:

```
ring:frontend-design          → decide a direção (cor, tipo, hierarquia) do zero
        ↓
ring:impeccable-design         → gera/refina, roda CRITIQUE, aplica POLISH
        ↓
ring:componentes-acessibilidade → aprofunda a11y (contraste, foco, ARIA, teclado)
ring:design-responsivo          → aprofunda mobile/touch/fluidez
        ↓
ring:verification-before-completion → confirma antes de dar por pronto
```

No `dev-team` (ciclo de 6 gates), esta skill entra no gate de **implementação/review** de
qualquer tarefa com UI: depois que o `frontend-engineer` gera a tela, rode o CRITIQUE como
gate de qualidade visual antes de seguir para testing/validation.
