---
name: ring:design-responsivo
description: |
  Layouts responsivos e mobile-first que funcionam de telas pequenas a desktop.
  Estratégia de breakpoints por conteúdo, tipografia fluida, touch targets,
  imagens responsivas e prevenção de layout shift. Ensina princípios, não valores fixos.

trigger: |
  - Criando layouts que precisam funcionar em mobile e desktop
  - Definindo breakpoints, grids ou containers adaptativos
  - Ajustando tipografia, imagens ou espaçamento por tamanho de tela
  - Usuário menciona "responsivo", "mobile", "breakpoint" ou "adaptativo"

skip_when: |
  - Ferramentas internas exclusivamente desktop (largura fixa controlada)
  - Emails HTML (têm regras próprias de tabela e inline CSS)
  - Apps nativos (iOS/Android usam constraints/auto-layout próprios)

sequence:
  before: [ring:writing-plans]

related:
  similar: [ring:frontend-design, ring:impeccable-design]
---

# Design Responsivo & Mobile-First

> **Filosofia:** O layout serve o conteúdo, não o dispositivo. Comece pelo menor e progrida.
> **Princípio Central:** Quebre onde o conteúdo PEDE, não onde o iPhone tem largura.

---

## ⚠️ CRÍTICO: CONTEÚDO MANDA, DISPOSITIVO NÃO

> **PARE!** Antes de copiar breakpoints de um framework, pergunte: "Em que largura ESTE layout começa a ficar feio?"

Dispositivos mudam toda semana. O ponto onde sua linha de texto fica longa demais, ou onde dois cards não cabem mais lado a lado, é estável. Ancore os breakpoints aí.

| Tendência Padrão de IA | Por Que é Ruim | Pense Assim |
|------------------------|----------------|-------------|
| Copiar `sm/md/lg/xl` sem pensar | São defaults do framework, não do SEU layout | Onde o conteúdo realmente quebra? |
| Começar pelo desktop e "espremer" | Vira gambiarra de `display: none` no mobile | Comece pelo mobile e adicione |
| Esconder conteúdo no mobile | Mobile = usuário completo, não usuário de 2ª classe | Reorganize, não ampute |
| `font-size: 12px` pra "caber" | Ilegível e fere acessibilidade | 16px+ no body, sempre |
| Largura fixa em `px` | Estoura em telas estreitas | `%`, `rem`, `clamp()`, `minmax()` |

---

## 1. Filosofia Mobile-First (Comece pelo Menor)

Mobile-first significa escrever o estilo base para a tela pequena e **adicionar** complexidade conforme há espaço, usando `min-width`.

### Por que começar pelo menor?

| Razão | Explicação |
|-------|------------|
| **Foco no essencial** | Tela pequena força priorizar o que importa de verdade |
| **Progressão aditiva** | `min-width` adiciona; é mais limpo que remover com `max-width` |
| **Performance** | Mobile carrega só o necessário; desktop é progressivo |
| **Sem amputação** | Você nunca precisa esconder coisa pra "caber" |

### BOM vs RUIM

```css
/* ✅ BOM: mobile-first, aditivo com min-width */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;        /* base: coluna única */
  gap: 1rem;
}
@media (min-width: 48rem) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }  /* adiciona colunas */
}

/* ❌ RUIM: desktop-first, espremendo com max-width */
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);  /* assume desktop */
}
@media (max-width: 48rem) {
  .card-grid { grid-template-columns: 1fr; }  /* "conserta" o mobile depois */
}
```

> **Regra:** Estilo base = mobile. `@media (min-width: ...)` = enriquecimento progressivo.

---

## 2. Estratégia de Breakpoints (Baseada em Conteúdo)

Não existe "breakpoint certo" universal. Existe o ponto onde **seu** layout quebra. Redimensione a janela devagar e marque onde dói.

### Faixas comuns (REFERÊNCIA, não regra)

| Faixa | Largura aprox. | Contexto típico | Não decore — VERIFIQUE |
|-------|----------------|-----------------|------------------------|
| Mobile pequeno | ~320–480px | Celular em pé | O texto cabe? Botão alcançável? |
| Mobile grande / Tablet pequeno | ~480–768px | Celular grande, tablet retrato | Dá pra 2 colunas? |
| Tablet / Laptop pequeno | ~768–1024px | Tablet paisagem, netbook | Sidebar faz sentido? |
| Desktop | ~1024–1440px | Monitor comum | Linha de texto ficou longa? |
| Desktop largo | ~1440px+ | Monitor grande, ultrawide | Limitar `max-width` do conteúdo |

> **Use `rem` nos breakpoints, não `px`.** Respeita o zoom de fonte do usuário. `48rem` ≈ `768px` com base 16.

### Como achar SEU breakpoint

```
1. Abra no mobile (320px). Estilo base funciona?
2. Arraste a janela aumentando devagar.
3. Quando algo ficar feio (texto longo demais, espaço vazio,
   cards apertados) → ESSE é seu breakpoint.
4. Adicione a media query ali. Repita até desktop largo.
```

| Sinal de que precisa de breakpoint | Ação |
|------------------------------------|------|
| Linha de texto > ~75 caracteres | Limite largura ou aumente colunas |
| Cards espremidos lado a lado | Reduza número de colunas |
| Espaço vazio gigante nas laterais | Aumente colunas ou `max-width` central |
| Navegação não cabe na horizontal | Vire menu hambúrguer ou empilhe |

---

## 3. Tipografia Fluida

Em vez de pular tamanhos em cada breakpoint, deixe o texto escalar suavemente com `clamp()`.

### Anatomia do clamp()

```css
/* clamp(MÍNIMO, IDEAL-fluido, MÁXIMO) */
h1   { font-size: clamp(1.75rem, 1.2rem + 2.5vw, 3rem); }
body { font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem); }
```

| Parte | Papel |
|-------|-------|
| **Mínimo** | Nunca menor que isso (mobile legível) |
| **Ideal (com vw)** | Cresce com a viewport |
| **Máximo** | Nunca maior que isso (desktop não exagera) |

### BOM vs RUIM

```css
/* ✅ BOM: escala suave, sem saltos, legível em qualquer largura */
h1 { font-size: clamp(2rem, 1.5rem + 2vw, 3.5rem); }

/* ❌ RUIM: saltos bruscos a cada breakpoint, dá manutenção infinita */
h1 { font-size: 2rem; }
@media (min-width: 768px)  { h1 { font-size: 2.5rem; } }
@media (min-width: 1024px) { h1 { font-size: 3rem; } }
@media (min-width: 1440px) { h1 { font-size: 3.5rem; } }
```

### Regras de legibilidade que NÃO mudam com a tela

| Regra | Valor | Por quê |
|-------|-------|---------|
| Tamanho mínimo do body | 16px (`1rem`) | Abaixo disso é ilegível e iOS dá zoom |
| Comprimento de linha | 45–75 caracteres (`max-width: 65ch`) | Conforto de leitura |
| Altura de linha (body) | 1.4–1.6 | Respiro entre linhas |
| Contraste | WCAG AA (4.5:1 texto normal) | Acessibilidade |

> **Cuidado com `vw` puro:** `font-size: 5vw` fica minúsculo em 320px. Sempre prenda com `clamp()`.

---

## 4. Touch Targets (Alvos de Toque)

Dedo não é cursor. Alvos pequenos demais geram erro e frustração no mobile.

| Diretriz | Valor mínimo | Fonte |
|----------|--------------|-------|
| Tamanho do alvo | **44×44px** (área tocável) | WCAG / Apple HIG |
| Recomendado confortável | 48×48px | Material Design |
| Espaçamento entre alvos | ≥ 8px | Evita toque acidental no vizinho |

### BOM vs RUIM

```css
/* ✅ BOM: área tocável garantida mesmo com ícone pequeno */
.icon-button {
  min-width: 2.75rem;   /* 44px */
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ❌ RUIM: ícone de 16px sem área de toque, link colado no outro */
.icon-button { padding: 2px; }
```

| Anti-padrão de toque | Problema | Correção |
|----------------------|----------|----------|
| Links de texto colados em lista | Toca no errado | `padding` vertical generoso na linha inteira |
| Ícone "X" minúsculo de fechar | Difícil acertar | `min-height/width: 44px` + padding |
| Botões grudados lado a lado | Toque acidental | `gap` de 8px+ entre eles |
| Hover como única forma de revelar ação | Não existe hover no toque | Ação sempre visível ou via tap |

---

## 5. Layout Responsivo (Grid, Flex, Containers)

### Grid e Flex que se adaptam sozinhos

Prefira layouts que se reorganizam **sem** media query, usando `auto-fit` + `minmax`.

```css
/* ✅ Grid que cria colunas conforme cabe, sem nenhuma media query */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1.5rem;
}

/* ✅ Flex que quebra linha sozinho */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
```

| Técnica | O que faz | Quando usar |
|---------|-----------|-------------|
| `auto-fit` + `minmax` | Colunas se ajustam à largura disponível | Galerias, listas de cards |
| `flex-wrap: wrap` | Itens quebram linha quando faltam espaço | Toolbars, tags, botões |
| `minmax(16rem, 1fr)` | Coluna nunca menor que 16rem, mas estica | Evita coluna espremida |
| `gap` | Espaço uniforme sem `margin` hack | Sempre que separar itens |

### Container Queries vs Media Queries

| Critério | Media Query | Container Query |
|----------|-------------|-----------------|
| Reage a | Tamanho da **viewport** | Tamanho do **container pai** |
| Bom para | Layout global da página | Componente reutilizável (card, widget) |
| Exemplo | Trocar layout da página inteira | Card que muda em sidebar vs main |
| Sintaxe | `@media (min-width: ...)` | `@container (min-width: ...)` |

```css
/* ✅ Container query: o card decide o layout pelo ESPAÇO QUE TEM,
   não pelo tamanho da tela. Mesmo card funciona em sidebar e main. */
.card-wrapper { container-type: inline-size; }

.card { display: flex; flex-direction: column; }
@container (min-width: 24rem) {
  .card { flex-direction: row; }   /* vira horizontal quando o container é largo */
}
```

> **Regra prática:** layout da PÁGINA → media query. Componente que vive em vários contextos → container query.

---

## 6. Imagens Responsivas

Imagem é o maior vilão de peso e de layout shift. Trate com cuidado.

### srcset / sizes (entregar o tamanho certo)

```html
<!-- ✅ Navegador escolhe a imagem certa pro tamanho real exibido -->
<img
  src="foto-800.jpg"
  srcset="foto-400.jpg 400w, foto-800.jpg 800w, foto-1600.jpg 1600w"
  sizes="(min-width: 48rem) 50vw, 100vw"
  alt="Descrição real da imagem"
  width="800" height="600"
  loading="lazy"
  decoding="async"
/>
```

| Atributo | Papel |
|----------|-------|
| `srcset` | Lista de versões em larguras diferentes |
| `sizes` | Quanto da tela a imagem ocupa em cada faixa |
| `width`/`height` | Reserva o espaço → evita CLS |
| `loading="lazy"` | Não carrega imagem fora da tela ainda |
| `decoding="async"` | Não trava render para decodificar |

### aspect-ratio para reservar espaço

```css
/* ✅ Reserva a proporção antes da imagem chegar → zero layout shift */
.thumb {
  aspect-ratio: 16 / 9;
  width: 100%;
  object-fit: cover;
}
```

| ✅ Faça | ❌ Não Faça |
|---------|------------|
| `width`+`height` ou `aspect-ratio` sempre | Imagem sem dimensão (causa CLS) |
| `loading="lazy"` em imagens abaixo da dobra | `lazy` no LCP/hero (atrasa pintura) |
| Formatos modernos (WebP/AVIF) | PNG/JPG gigantes sem otimizar |
| `object-fit: cover` para enquadrar | Distorcer com width/height fixos errados |

---

## 7. Evitar Layout Shift (CLS)

Conteúdo que "pula" enquanto carrega frustra e prejudica Core Web Vitals (CLS < 0.1).

| Causa de shift | Correção |
|----------------|----------|
| Imagem sem dimensão | `width`/`height` ou `aspect-ratio` |
| Fonte que troca (FOUT) | `font-display: optional`/`swap` + reservar métrica |
| Banner/ad injetado no topo | Reserve o espaço com altura mínima |
| Conteúdo assíncrono empurrando | Skeleton com a mesma altura final |
| `@font-face` sem fallback dimensionado | `size-adjust` para casar com fallback |

```css
/* ✅ Skeleton ocupa o espaço final → conteúdo entra sem empurrar */
.skeleton {
  min-height: 8rem;
  aspect-ratio: 16 / 9;
}
```

> **Regra:** Tudo que carrega depois (imagem, fonte, dado) deve ter seu espaço **reservado antes**.

---

## 8. Espaçamento e Densidade Responsivos

Espaçamento de desktop sufoca o mobile; espaçamento de mobile deixa o desktop vazio.

```css
/* ✅ Espaçamento fluido com clamp — respira em qualquer tela */
.section {
  padding-block: clamp(2rem, 5vw, 6rem);
  padding-inline: clamp(1rem, 4vw, 4rem);
}
```

| Contexto | Densidade | Pensar sobre |
|----------|-----------|--------------|
| Mobile | Mais compacta na horizontal, generosa no toque | Margens laterais menores, alvos grandes |
| Desktop | Mais respiro, `max-width` central | Não esticar texto pela tela toda |
| Dashboard/dados | Densidade alta proposital | Toque ainda confortável |
| Landing/marketing | Whitespace generoso | Impacto e respiro |

| ✅ BOM | ❌ RUIM |
|--------|---------|
| `padding: clamp(...)` escala suave | `padding: 64px` fixo (sufoca mobile) |
| `max-width: 65ch` no texto longo | Texto de borda a borda no desktop |
| Margens laterais menores no mobile | Margem de 48px comendo a tela de 320px |

---

## 9. Como Testar

Emulador ajuda, mas não substitui a mão no aparelho.

| Método | Pega o quê | Limitação |
|--------|-----------|-----------|
| **DevTools (device mode)** | Layout em larguras variadas, rápido | Não simula toque/performance reais |
| **Redimensionar a janela** | Onde o layout quebra de verdade | Só no seu desktop |
| **Aparelho real** | Toque, performance, teclado virtual, notch | Precisa do device |
| **Orientação (retrato/paisagem)** | Layout girado, altura curta | Fácil de esquecer |
| **Zoom do navegador (200%)** | Acessibilidade, `rem` correto | — |

### Checklist de teste

```
[ ] Funciona a 320px sem scroll horizontal?
[ ] Texto legível (≥16px) em todas as larguras?
[ ] Botões/links têm ≥44×44px de área tocável?
[ ] Imagens reservam espaço (sem pulo ao carregar)?
[ ] Paisagem em mobile não quebra?
[ ] Zoom 200% mantém usável?
[ ] Teclado virtual não cobre o campo ativo?
[ ] Nada some que devia aparecer no mobile?
```

---

## 10. Anti-Padrões (O Que NÃO Fazer)

| Anti-Padrão | Por Que é Ruim | Faça Em Vez Disso |
|-------------|----------------|-------------------|
| **Esconder conteúdo só no mobile** | Usuário mobile é usuário pleno | Reorganize/colapse, não remova |
| **Breakpoints mágicos do framework** | Não combinam com SEU conteúdo | Quebre onde o conteúdo pede |
| **Texto pequeno demais pra "caber"** | Ilegível + iOS força zoom | 16px+ no body, sempre |
| **Largura fixa em px** | Estoura telas estreitas | `%`, `rem`, `clamp`, `minmax` |
| **Scroll horizontal acidental** | Sinal de overflow não tratado | Investigue elemento mais largo que a viewport |
| **Desktop-first espremido** | Vira `display:none` por todo lado | Mobile-first aditivo |
| **Hover como única interação** | Não existe no toque | Ação sempre acessível por tap |
| **Imagem sem dimensão** | Causa layout shift (CLS) | `width`/`height` ou `aspect-ratio` |

### Caçando scroll horizontal acidental

```css
/* Diagnóstico rápido: revela quem estoura a largura */
* { outline: 1px solid red; }
/* Culpados comuns: imagem sem max-width, largura 100vw + padding,
   tabela larga, texto sem quebra (overflow-wrap), margin negativa */
img, video { max-width: 100%; height: auto; }
```

---

## 11. Resumo do Processo de Decisão

```
Para CADA layout responsivo:

1. MOBILE PRIMEIRO
   └── Escreva o estilo base pra tela pequena
   └── Tudo essencial cabe e é legível?

2. PROGRIDA COM min-width
   └── Arraste a janela, ache onde quebra
   └── Adicione media/container query NESSE ponto

3. FLUIDEZ ANTES DE BREAKPOINT
   └── clamp() pra fonte e espaçamento
   └── auto-fit/minmax pra grid
   └── Menos breakpoints = menos manutenção

4. RESERVE ESPAÇO
   └── Dimensões em imagens, aspect-ratio, skeletons
   └── Nada deve "pular" ao carregar

5. TOQUE E ACESSO
   └── Alvos ≥44px, espaçados
   └── Zoom 200% e paisagem funcionam?

6. TESTE DE VERDADE
   └── Aparelho real, não só emulador
   └── "Some algo que não devia sumir?"
```

---

> **Lembre-se:** Responsivo não é o desktop encolhido nem o mobile escondido. É o MESMO conteúdo se adaptando com dignidade a cada tela. Comece pelo menor, deixe fluir, reserve o espaço, e teste no aparelho de verdade.
