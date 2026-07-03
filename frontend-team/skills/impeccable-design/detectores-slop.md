# Detectores de Slop

Catálogo de padrões que denunciam uma UI "gerada por IA". Use como checklist na etapa
**CRITIQUE**. Cada detector tem: **sintoma** (o que procurar), **por que é slop** e
**correção** (a direção, não um valor fixo — pense no contexto).

> Como usar: passe a tela por cada categoria. Para cada detector que disparar, registre um
> achado com severidade (P0/P1/P2) no formato da SKILL.md. Nem todo detector se aplica a
> toda tela — julgue.

## Índice
1. [Cor & Contraste](#1-cor--contraste)
2. [Tipografia](#2-tipografia)
3. [Layout & Espaçamento](#3-layout--espaçamento)
4. [Componentes & Superfícies](#4-componentes--superfícies)
5. [Motion & Interação](#5-motion--interação)
6. [Ícones & Imagens](#6-ícones--imagens)
7. [Copy & Conteúdo](#7-copy--conteúdo)
8. [Toque & Estados](#8-toque--estados)

---

## 1. Cor & Contraste

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 1 | **Mesh/aurora gradient** roxo→rosa→azul no fundo | Assinatura nº1 de IA | Fundo sólido de alto contraste; se usar gradiente, sutil e na paleta da marca |
| 2 | **Roxo/violeta como cor primária** sem motivo | "Safe harbor" pós-ban do azul | Escolha a cor pela marca/audiência; ouse vermelho, verde, preto, âmbar |
| 3 | **Texto cinza (`#9CA3AF`) sobre fundo colorido** | Ilegível, contraste < 3:1 | Branco puro ou cor com contraste WCAG AA (4.5:1 texto normal) |
| 4 | **Cinza sobre cinza** (texto `#6B7280` em `#F3F4F6`) | Some, parece placeholder | Escureça o texto ou clareie o fundo até passar em AA |
| 5 | **Muitas cores competindo** (5+ matizes saturados) | Sem hierarquia, cansativo | Regra 60-30-10: neutro domina, 1 accent para ação |
| 6 | **Accent color = mesma do fundo do gradiente** | CTA some no fundo | Accent deve contrastar com tudo ao redor |
| 7 | **Dark mode com neon glow em tudo** | "Look de IA premium" | Glow com propósito (1 elemento), ou flat de alto contraste |
| 8 | **Cor semântica errada** (erro em azul, sucesso em cinza) | Confunde o usuário | Vermelho=erro, verde=sucesso, âmbar=aviso — respeite a convenção |

## 2. Tipografia

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 9 | **Inter/Roboto/Open Sans** como única fonte, sem escolha | Default preguiçoso | Escolha um par com personalidade; use a fonte da marca se houver |
| 10 | **Só um peso** (tudo 400 ou tudo 600) | Sem hierarquia tipográfica | Contraste de peso: title bold, body regular, label medium |
| 11 | **Hierarquia por cor, não por escala** (títulos só mudam de cor) | Fraco em telas B&W | Escala real (1.25–1.5), peso e espaço definem a hierarquia |
| 12 | **Line-height apertado** (< 1.4) no body | Cansa a leitura | 1.4–1.6 para texto corrido |
| 13 | **Linha muito longa** (> 80 caracteres) | Olho perde a linha | 45–75 caracteres (`max-width: 65ch`) |
| 14 | **Body < 16px na web** | Difícil ler em mobile | 16px+ para texto principal |
| 15 | **Título gigante + body minúsculo** sem meio-termo | Salto brusco, sem ritmo | Escala consistente entre os níveis |
| 16 | **Texto em CAIXA ALTA em blocos longos** | Ilegível em volume | Caps só para labels/eyebrow curtos |

## 3. Layout & Espaçamento

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 17 | **Bento grid** para conteúdo simples | Clichê "moderno" de IA | Pergunte: esse conteúdo *precisa* de grid? Talvez lista ou narrativa vertical |
| 18 | **Hero split 50/50** (texto esq / imagem dir) | Previsível | Tipografia massiva, full-bleed, ou assimetria intencional |
| 19 | **Espaçamento uniforme** (tudo com o mesmo gap) | Sem agrupamento visual | Escala de espaço (4/8/16/32); proximidade agrupa itens relacionados |
| 20 | **Tudo centralizado** | Falta de âncora, cansa | Alinhamento à esquerda para leitura; centralize só o que merece |
| 21 | **Sem respiro** (elementos colados nas bordas) | Sufocado, amador | Padding generoso; whitespace = percepção de qualidade |
| 22 | **Largura full em texto longo** | Linhas gigantes | Container com max-width para leitura confortável |
| 23 | **Simetria forçada** (3 cards iguais sempre) | Monótono | Deixe o conteúdo ditar; destaque o item principal |

## 4. Componentes & Superfícies

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 24 | **Cards aninhados** (card dentro de card dentro de card) | Profundidade sem sentido, ruído | Achate a hierarquia; use espaço/divisor em vez de nova superfície |
| 25 | **Glassmorphism** (blur + transparência) em tudo | Ideia de IA de "premium" | Sólido, flat, alto contraste costuma ler melhor |
| 26 | **Tudo com `border-radius` grande** | Genérico, "seguro" | Varie: cantos afiados podem dar personalidade/brutalismo |
| 27 | **Sombra pesada e uniforme** em todo elemento | Poluição visual | Sombra sutil e só onde há elevação real; ou borda de 1px |
| 28 | **Borda + sombra + fundo** no mesmo card | Redundância de separação | Escolha *um* método de separar |
| 29 | **Botões todos iguais** (primário = secundário) | Sem hierarquia de ação | 1 CTA primário claro; secundários mais discretos (ghost/outline) |
| 30 | **Ícone decorativo em cada linha/feature** | Ruído, não informa | Ícone só quando ajuda a escanear ou distinguir |

## 5. Motion & Interação

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 31 | **Bounce/elastic easing** em tudo | Brincalhão fora de contexto, "cara de template" | `ease-out`/`ease-in-out`; bounce só se a marca for lúdica |
| 32 | **Animação longa** (> 400ms) em micro-interação | Lenta, atrapalha | 150–250ms para hover/click; rápido = responsivo |
| 33 | **Fade-in em tudo ao scrollar** | Efeito "template", distrai | Anime com propósito; respeite `prefers-reduced-motion` |
| 34 | **Hover sem feedback** ou sem estado `:focus-visible` | Parece quebrado / inacessível | Estados claros para hover, focus e active (ver componentes-acessibilidade) |
| 35 | **Transição em `all`** | Anima props inesperadas, custa perf | Transicione só o que muda (`transform`, `opacity`) |

## 6. Ícones & Imagens

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 36 | **Emoji como ícone de UI** (🚀 em botão/feature) | Amador, inconsistente entre SOs | Set de ícones coeso (Lucide, Phosphor, etc.) |
| 37 | **Mix de estilos de ícone** (outline + filled + 3D) | Falta de sistema | Um único estilo/peso de ícone |
| 38 | **Stock genérico** (aperto de mão, "equipe diversa sorrindo") | Sem alma, todo mundo usa | Imagem real do produto, ilustração própria, ou nada |
| 39 | **Placeholder cinza** deixado no final | Inacabado | Conteúdo real ou vazio bem tratado |

## 7. Copy & Conteúdo

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 40 | **"Orquestrar", "Capacitar", "Elevar", "Desbloquear"** | Copy genérica de IA | Como um humano diria isso? Concreto e específico |
| 41 | **"Lorem ipsum" ou texto placeholder** visível | Inacabado | Copy real, mesmo que rascunho |
| 42 | **Headline vaga** ("A melhor solução para você") | Não diz o que é | Diga o benefício concreto e específico |
| 43 | **Excesso de "—" (travessão) e listas simétricas** | Padrão de escrita de IA | Varie o ritmo; frases de tamanhos diferentes |

## 8. Toque & Estados

| # | Sintoma | Por que é slop | Correção |
|---|---------|----------------|----------|
| 44 | **Touch target < 44px** em mobile | Difícil de tocar (Lei de Fitts) | Mínimo 44×44px para alvos tocáveis |
| 45 | **Só o estado "sucesso"** (sem loading/vazio/erro) | Quebra no mundo real | Trate loading, vazio, erro e texto longo (etapa HARDEN) |

---

## Anti-anti-slop (não caia nisto)

Fugir do slop **não** é empilhar o extremo oposto. Estes também são slop, só que "tentando":

- **Brutalismo sem motivo** — cantos afiados e cores gritantes num app que pede calma.
- **Cor exótica só para ser diferente** — verde-neon num produto financeiro sério.
- **Tipografia experimental** que sacrifica legibilidade.
- **Motion excessivo** para "impressionar".

> O teste final de cada correção: *"consigo justificar isso pela marca ou pela audiência?"*
> Se a resposta for "porque parece legal", volte e pense de novo.
