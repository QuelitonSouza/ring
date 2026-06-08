---
name: ring:componentes-acessibilidade
description: |
  Construção de componentes de UI acessíveis e bem estruturados para web.
  Princípios de composição, WCAG/POUR, ARIA essencial, navegação por teclado e
  formulários acessíveis. Orientado a React, mas com princípios agnósticos de framework.

trigger: |
  - Criando componentes de UI, formulários, modais ou menus
  - Estruturando estados de componente (loading/empty/error/success)
  - Usuário menciona "acessibilidade", "a11y", "ARIA", "teclado" ou "leitor de tela"
  - Implementando navegação por teclado ou foco

skip_when: |
  - Apenas lógica de backend sem UI
  - Scripts ou jobs sem interface
  - Refatoração interna sem impacto em componentes visuais

sequence:
  before: [ring:writing-plans]

related:
  similar: [ring:frontend-design]
---

# Componentes & Acessibilidade

> **Filosofia:** Acessibilidade não é feature, é base. Se funciona só com mouse, está quebrado.
> **Princípio Central:** HTML semântico primeiro. ARIA só quando o HTML não dá conta.

## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [padroes-componentes.md](padroes-componentes.md) | 🔴 **OBRIGATÓRIO** | Anatomia de componentes + requisitos de teclado/ARIA |

---

## ⚠️ CRÍTICO: SEMÂNTICA ANTES DE ARIA

> **PARE!** Antes de adicionar qualquer `role` ou `aria-*`, pergunte: existe uma tag HTML nativa para isso?

| O Que Você Quer | ❌ Não Faça | ✅ Faça |
|-----------------|------------|---------|
| Botão | `<div onClick>` | `<button>` |
| Link | `<span onClick>` | `<a href>` |
| Checkbox | `<div role="checkbox">` | `<input type="checkbox">` |
| Lista | `<div>` repetido | `<ul><li>` |
| Cabeçalho | `<div class="title">` | `<h1>`–`<h6>` |
| Navegação | `<div class="nav">` | `<nav>` |

> **Primeira Regra do ARIA:** o melhor ARIA é nenhum ARIA. Um elemento nativo traz role, foco e teclado de graça.

---

## 1. Princípios de Composição

### Responsabilidade Única

Cada componente faz **uma coisa**. Se o nome tem "e" (ex: `CardEModal`), provavelmente são dois componentes.

| Sinal de Problema | O Que Fazer |
|-------------------|-------------|
| Mais de ~5 props booleanas | Quebre em variantes ou subcomponentes |
| Componente busca dados E renderiza E formata | Separe container de apresentação |
| `if` aninhado decidindo qual UI mostrar | Extraia para componentes por estado |

### Props Claras

```tsx
// ❌ Ruim: props ambíguas, booleanas demais
<Botao primario secundario perigo grande pequeno />

// ✅ Bom: variantes nomeadas, intenção explícita
<Botao variante="perigo" tamanho="grande" />
```

| Anti-padrão | Por Que Evitar | Alternativa |
|-------------|----------------|-------------|
| Booleanas mutuamente exclusivas | Estados impossíveis viram bug | Prop `variante` com enum |
| `data` genérico tipo `any` | Sem contrato, sem autocompletar | Tipos explícitos |
| Prop que muda comportamento E aparência | Acopla demais | Separe `variante` de `aoClicar` |

### Estados Explícitos (SEMPRE)

> **OBRIGATÓRIO:** todo componente que carrega dados trata os 4 estados. "Vai dar certo" não é estado.

| Estado | O Que Mostrar | Erro Comum |
|--------|---------------|------------|
| **loading** | Skeleton ou spinner com `aria-busy` | Tela em branco |
| **empty** | Mensagem clara + ação ("Nenhum item. Adicionar?") | Lista vazia silenciosa |
| **error** | Mensagem útil + retry, anunciada via `aria-live` | Engolir o erro |
| **success** | O conteúdo real | (o único que costumam lembrar) |

---

## 2. Acessibilidade WCAG — Resumo via POUR

WCAG se organiza em 4 princípios. Decore o acrônimo **POUR**.

| Princípio | Significa | Na Prática |
|-----------|-----------|------------|
| **P**erceptível | O usuário consegue perceber a informação | Alt text, contraste, legendas, não depender só de cor |
| **O**perável | O usuário consegue operar a interface | Tudo acessível por teclado, foco visível, sem armadilhas |
| **U**nderstandable (Compreensível) | A interface é previsível e clara | Labels claras, erros explicados, comportamento consistente |
| **R**obusto | Funciona em tecnologias assistivas | HTML válido, ARIA correto, compatível com leitores de tela |

### Níveis de Conformidade

| Nível | Significado | Alvo Recomendado |
|-------|-------------|------------------|
| A | Mínimo | Insuficiente sozinho |
| **AA** | Padrão do mercado | **Mire aqui** (contraste 4.5:1, teclado total) |
| AAA | Ideal estrito | Pontual (ex: contraste 7:1 em texto crítico) |

---

## 3. ARIA Essencial

> **AVISO:** ARIA só quando HTML semântico não basta. ARIA mal usado é pior que nenhum ARIA — quebra o leitor de tela.

| Atributo | Para Que Serve | Exemplo |
|----------|----------------|---------|
| `role` | Define o papel quando não há tag nativa | `role="dialog"`, `role="tablist"` |
| `aria-label` | Nome acessível quando não há texto visível | `<button aria-label="Fechar">×</button>` |
| `aria-labelledby` | Referencia outro elemento como rótulo | `aria-labelledby="titulo-modal"` |
| `aria-describedby` | Texto auxiliar (dica, erro) | `aria-describedby="erro-email"` |
| `aria-live` | Anuncia mudanças dinâmicas | `aria-live="polite"` para feedback |
| `aria-expanded` | Estado aberto/fechado | Botão de menu/accordion |
| `aria-controls` | Aponta o elemento controlado | `aria-controls="painel-1"` |
| `aria-current` | Item atual em um conjunto | `aria-current="page"` na nav |
| `aria-invalid` | Campo com erro de validação | `aria-invalid="true"` |
| `aria-hidden` | Esconde de tecnologia assistiva | Ícone decorativo |

### `aria-live` para Feedback Dinâmico

```tsx
// Região que anuncia mensagens sem mover o foco do usuário
<div aria-live="polite" aria-atomic="true">
  {mensagem}
</div>
```

| Valor | Quando Usar |
|-------|-------------|
| `polite` | Maioria dos casos (espera o usuário pausar) |
| `assertive` | Urgente, interrompe (erros críticos) |
| `off` | Sem anúncio |

### `aria-expanded` + `aria-controls`

```tsx
<button aria-expanded={aberto} aria-controls="menu-conta">
  Minha conta
</button>
<ul id="menu-conta" hidden={!aberto}>...</ul>
```

---

## 4. Navegação por Teclado

> **OBRIGATÓRIO:** se funciona no mouse, funciona no teclado. Sem exceção.

| Tecla | Comportamento Esperado |
|-------|------------------------|
| `Tab` / `Shift+Tab` | Move entre elementos focáveis, em ordem lógica |
| `Enter` | Ativa links e botões |
| `Espaço` | Ativa botões, marca checkbox |
| `Esc` | Fecha modais, menus, popovers |
| `Setas` | Navega dentro de menus, tabs, radios |

### Regras de Ouro do Teclado

| Regra | Detalhe |
|-------|---------|
| **Ordem de tab lógica** | Segue a leitura visual. Evite `tabindex` positivo |
| **Foco visível SEMPRE** | NUNCA remova o outline sem substituir por algo visível |
| **Focus trap em modais** | Tab não escapa do modal enquanto ele está aberto |
| **Retorno de foco** | Ao fechar modal, foco volta ao elemento que o abriu |
| **Skip links** | "Pular para o conteúdo" como primeiro elemento focável |
| **`tabindex="0"`** | Torna focável; **`-1`** foca por código mas tira do tab |

```tsx
// ❌ Crime contra a acessibilidade
button:focus { outline: none; }

// ✅ Foco visível e bonito
button:focus-visible {
  outline: 2px solid var(--cor-foco);
  outline-offset: 2px;
}
```

### Skip Link

```tsx
<a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
<main id="conteudo">...</main>
```

> A `.skip-link` fica escondida até receber foco (`:focus`), aí aparece no topo.

---

## 5. Formulários Acessíveis

> **OBRIGATÓRIO:** todo input tem `label` associado. Placeholder não é label.

| Requisito | Como Fazer |
|-----------|------------|
| Label associado | `<label htmlFor="email">` + `<input id="email">` |
| Erro vinculado | `aria-describedby` aponta para o `<p>` do erro |
| Marcar inválido | `aria-invalid="true"` no campo com erro |
| Campo obrigatório | `required` + indicação visual (não só cor) |
| Agrupar relacionados | `<fieldset>` + `<legend>` |

```tsx
<label htmlFor="email">E-mail</label>
<input
  id="email"
  type="email"
  aria-invalid={temErro}
  aria-describedby={temErro ? "erro-email" : undefined}
/>
{temErro && (
  <p id="erro-email" role="alert">E-mail inválido</p>
)}
```

| Anti-padrão | Por Que Quebra | Correção |
|-------------|----------------|----------|
| Placeholder como label | Some ao digitar; baixo contraste | `<label>` real |
| Erro só em vermelho | Daltônico não percebe | Texto + ícone + `aria-invalid` |
| Erro sem vínculo | Leitor não associa ao campo | `aria-describedby` |
| `<div>` como botão de submit | Não envia com Enter | `<button type="submit">` |

---

## 6. Contraste e Estados de Foco

### Contraste Mínimo (WCAG AA)

| Tipo de Texto | Razão Mínima |
|---------------|--------------|
| Texto normal | 4.5:1 |
| Texto grande (≥18px bold ou ≥24px) | 3:1 |
| Componentes de UI e ícones | 3:1 |

> **EVITE** depender só de cor para transmitir significado. Cor + ícone + texto.

### Estados de Foco

| Estado | Requisito |
|--------|-----------|
| `:hover` | Feedback visual, mas NUNCA é o único (mouse-only) |
| `:focus-visible` | Indicador claro, contraste ≥3:1 contra o fundo |
| `:active` | Confirmação de toque/clique |
| `:disabled` | Visualmente distinto + `aria-disabled` quando aplicável |

---

## 7. Checklist de Acessibilidade

### Antes de Considerar Pronto

```
[ ] Todo elemento interativo é alcançável por Tab
[ ] Foco visível em TODOS os elementos focáveis
[ ] Ordem de tab segue a leitura visual
[ ] Esc fecha modais/menus, e o foco retorna corretamente
[ ] Modais têm focus trap e aria-modal
[ ] Todo input tem label associado (não placeholder)
[ ] Erros de formulário vinculados via aria-describedby + aria-invalid
[ ] Imagens informativas têm alt; decorativas têm alt="" ou aria-hidden
[ ] Contraste de texto ≥ 4.5:1 (AA)
[ ] Informação não depende só de cor
[ ] Feedback dinâmico anunciado via aria-live
[ ] HTML semântico usado antes de ARIA
[ ] Testado navegando só com teclado
[ ] Testado com leitor de tela (NVDA/VoiceOver) ao menos no fluxo principal
```

---

## 8. Anti-Padrões (O Que NÃO Fazer)

| Anti-padrão | Por Que é Ruim | Correção |
|-------------|----------------|----------|
| `<div onClick>` sem role nem teclado | Invisível ao teclado e ao leitor | Use `<button>` |
| `outline: none` no foco | Teclado fica sem orientação | `:focus-visible` com outline próprio |
| Placeholder como label | Some e tem baixo contraste | `<label>` associado |
| ARIA redundante (`<button role="button">`) | Ruído sem ganho | Remova; nativo já traz o role |
| `role="button"` num `<div>` | Reinventa o botão errado | Use `<button>` |
| Cor como único sinal de erro | Daltônico não percebe | Texto + ícone + `aria-invalid` |
| `aria-label` em elemento com texto visível | Conflita com o texto lido | Deixe o texto natural |
| `tabindex` positivo | Quebra a ordem lógica de tab | Use `0` ou reorganize o DOM |
| Modal sem retorno de foco | Usuário se perde ao fechar | Devolva o foco ao gatilho |

---

> **Lembre-se:** Acessibilidade é qualidade de software. Componente que só funciona com mouse é componente quebrado — independente de quão bonito ele seja.
