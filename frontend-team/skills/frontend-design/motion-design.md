# Motion Design para Web UI

> Deep dive em animação de interface: timing, easing, micro-interações, orquestração, acessibilidade e performance.
> **Princípio Central:** Movimento tem PROPÓSITO. Se não comunica nada, é distração.

---

## 1. Princípios de Timing

A duração certa é invisível: o usuário sente que a interface "responde", não que ela "anima". Duração errada irrita (lenta demais) ou confunde (rápida demais).

### Duração por Contexto

| Contexto | Range | Sensação |
|----------|-------|----------|
| **Micro-interação** (hover, toggle, ripple) | 100-200ms | Instantâneo, responsivo |
| **Transição de elemento** (card, dropdown, tooltip) | 200-300ms | Suave, perceptível |
| **Transição de view** (modal, drawer, página) | 300-500ms | Deliberado, com contexto |
| **Ambiente / loop** (loading, background) | 1000ms+ | Contínuo, calmo |

### O Que Modula a Duração

```
Duração depende de:
├── DISTÂNCIA  → percurso maior na tela = duração maior
├── TAMANHO    → elemento maior = movimento mais lento (mais "massa")
├── IMPORTÂNCIA → ação crítica = movimento mais claro e legível
└── CONTEXTO   → urgente = rápido | luxo = lento e suave
```

### Regra prática

> **EVITE** durações acima de 500ms para interações diretas. O usuário esperando o fim da animação para clicar de novo é fricção, não polimento.

| Situação | RUIM | BOM |
|----------|------|-----|
| Botão muda de cor no hover | 600ms (parece travado) | 120ms (instantâneo) |
| Modal abrindo | 100ms (aparece "de susto") | 300ms (com contexto) |
| Item entrando numa lista | 1200ms (entediante) | 250ms (ágil) |

---

## 2. Curvas de Easing

Easing define a "personalidade" do movimento. Movimento linear (velocidade constante) é raro no mundo real e parece robótico — quase nunca use `linear` exceto em loops contínuos.

### Tabela de Easing

| Curva | Comportamento | Quando Usar |
|-------|---------------|-------------|
| **Ease-out** | Começa rápido, desacelera no fim | **Entrada** de elementos (aparecer, expandir) |
| **Ease-in** | Começa devagar, acelera no fim | **Saída** de elementos (sumir, colapsar) |
| **Ease-in-out** | Suave nas duas pontas | **Ênfase** e movimento entre dois pontos visíveis |
| **Spring / Bounce** | Ultrapassa o alvo e volta | Toques **playful**, feedback positivo, energia |
| **Linear** | Velocidade constante | Apenas loops contínuos (spinner, progress indeterminado) |

### A Regra de Ouro do Easing

```
Entrada  → EASE-OUT  (o elemento "chega e assenta")
Saída    → EASE-IN   (o elemento "ganha velocidade e parte")
Ida-volta → EASE-IN-OUT (movimento equilibrado e legível)
```

**Por quê ease-out na entrada?** O olho percebe o elemento chegando rapidamente e descansando suavemente — sensação de resposta imediata. Ease-in na entrada faz o elemento parecer "preguiçoso".

### Spring vs. Curvas Fixas

| Abordagem | Vantagem | Cuidado |
|-----------|----------|---------|
| **Cubic-bezier fixa** | Previsível, fácil de afinar | Pode parecer mecânica |
| **Spring (física)** | Natural, responde à velocidade | Excesso de bounce vira "brinquedo" |

> **EVITE** bounce em ações sérias (deletar, salvar formulário financeiro). Reserve spring/bounce para momentos de deleite, não para tudo.

---

## 3. Micro-interações

Micro-interação é o feedback imediato de uma ação pequena. Cada uma deve responder uma pergunta do usuário: "funcionou?", "está carregando?", "deu certo?".

### Catálogo de Micro-interações

| Interação | Propósito | Movimento Recomendado |
|-----------|-----------|------------------------|
| **Hover** | "Isto é clicável" | Mudança sutil (cor, leve elevação) em 100-150ms |
| **Press / active** | "Recebi seu toque" | Pequeno scale-down (0.97) imediato |
| **Toggle / switch** | "Estado mudou" | Deslize do thumb + mudança de cor, 150-200ms |
| **Loading** | "Estou trabalhando" | Spinner ou skeleton, loop suave |
| **Sucesso** | "Deu certo" | Check com leve spring, ou pulse verde |
| **Erro** | "Algo falhou" | Shake horizontal curto (2-3 ciclos), borda vermelha |

### Feedback de Sucesso vs. Erro

| | Sucesso | Erro |
|--|---------|------|
| **Movimento** | Spring suave, "pop" | Shake horizontal seco |
| **Direção** | Para cima / para fora | Lateral (chamar atenção) |
| **Duração** | 300-400ms (pode comemorar) | 200-300ms (não prolongar a dor) |
| **Cor** | Verde / accent positivo | Vermelho / accent de alerta |

### ANTES / DEPOIS: feedback de formulário

```
ANTES (sem micro-interação):
└── Usuário clica "Enviar" → nada acontece por 2s → tela troca
    Resultado: usuário clica de novo, duplica o envio

DEPOIS (com micro-interação):
└── Clica "Enviar" → botão vira spinner (Doherty <400ms) →
    check verde com leve spring → mensagem de sucesso
    Resultado: usuário sabe que funcionou, espera tranquilo
```

---

## 4. Orquestração e Stagger

Quando vários elementos entram ao mesmo tempo, o resultado é caótico. **Stagger** (atraso escalonado) cria ritmo e guia o olhar.

### Stagger em Listas

```
Sem stagger:               Com stagger:
[item] ┐                   [item] (0ms)
[item] ├ todos juntos      [item] (+40ms)
[item] ┘ = "flash"         [item] (+80ms)
                           = cascata elegante
```

| Parâmetro | Recomendação |
|-----------|--------------|
| **Delay entre itens** | 30-60ms (mais que isso fica lento) |
| **Itens animados** | Limite ~8-12 visíveis; resto entra sem stagger |
| **Direção** | De cima para baixo, ou na ordem de leitura |

### Orquestração de Composições

Para componentes compostos (ex: card com imagem + título + botão), sequencie do "pai" para o "filho":

```
1. Container aparece (fade + scale leve)      → 0ms
2. Imagem/mídia entra                          → +80ms
3. Título e texto sobem                         → +120ms
4. CTA aparece por último                       → +180ms
```

> **EVITE** stagger em listas longas com scroll. Anime apenas o que entra no viewport (intersection observer), nunca 200 itens de uma vez.

---

## 5. Transições de Estado e de Página

### Transições de Estado

Quando um componente muda de estado, anime a **diferença**, não troque abruptamente.

| Mudança | RUIM | BOM |
|---------|------|-----|
| Acordeão abre | Conteúdo "salta" | Altura anima de 0 → auto com ease-out |
| Tab ativa muda | Troca seca | Underline desliza para a nova tab |
| Item removido | Some e o resto "pula" | Item faz fade-out, vizinhos deslizam para a vaga |

### Transições de Página / View

| Padrão | Quando Usar |
|--------|-------------|
| **Fade cross-dissolve** | Troca neutra entre views sem relação espacial |
| **Slide** | Hierarquia/navegação (avançar = entra da direita, voltar = sai pela direita) |
| **Shared element** | Mesmo objeto persiste entre telas (thumbnail → detalhe) |

> Mantenha transições de página **rápidas e consistentes** (300-400ms). Uma transição lenta em CADA navegação acumula em frustração diária.

---

## 6. Princípios da Animação Clássica Aplicados à UI

A animação tradicional (Disney) tem 12 princípios. Três se traduzem diretamente para interface:

| Princípio Clássico | Em Animação | Em UI |
|--------------------|-------------|-------|
| **Anticipation** | Pequeno recuo antes do movimento principal | Botão "afunda" no press antes de disparar a ação |
| **Follow-through** | Partes continuam após o corpo parar | Lista que desacelera com leve "settle", drawer que assenta |
| **Slow in / slow out** | Movimento acelera e desacelera | Easing — nunca movimento linear em interações |
| **Squash & stretch** | Deformação que dá peso/vida | Leve scale no press, "pulse" em notificação |
| **Staging** | Direcionar a atenção para o que importa | Stagger e contraste de movimento guiam o olhar |

### ANTES / DEPOIS: aplicando os princípios

| Elemento | Sem princípios (mecânico) | Com princípios (vivo) |
|----------|---------------------------|------------------------|
| Botão de like | Coração aparece instantâneo | Coração faz squash → stretch → assenta (spring) |
| Toast de notificação | Aparece e some linear | Desliza com follow-through, pausa, sai com ease-in |
| Menu sanfona | Altura muda linear | Ease-out na abertura, conteúdo com leve fade-in atrasado |

---

## 7. Acessibilidade — `prefers-reduced-motion`

> **OBRIGATÓRIO** respeitar `prefers-reduced-motion`. Movimento pode causar náusea, tontura e desconforto real em pessoas com distúrbios vestibulares.

### Como Degradar Corretamente

| Tipo de Animação | Com motion (padrão) | Reduced motion |
|------------------|---------------------|----------------|
| **Entrada de elemento** | Slide + fade | Apenas fade (ou aparição imediata) |
| **Parallax / scroll-driven** | Movimento parallax | Desligar completamente |
| **Auto-play / loop** | Carrossel automático | Pausar; exigir interação |
| **Transição de página** | Slide animado | Cross-fade curto ou instantâneo |
| **Feedback essencial** (spinner) | Mantém | Mantém (é informação, não decoração) |

```
BOM (degradação consciente):
@media (prefers-reduced-motion: reduce) {
  /* trocar movimento por opacidade, encurtar drasticamente */
}

RUIM:
- Ignorar a preferência → "look bonito" para uns, mal-estar para outros
- Remover TUDO, inclusive feedback de loading → usuário fica sem pistas
```

### Princípio de degradação

> Movimento **decorativo** desliga. Movimento que **comunica estado** (loading, progresso) permanece — mas pode ser mais discreto. Reduzir movimento não é remover informação.

---

## 8. Performance

Animação que trava (jank) é pior que nenhuma animação. O alvo é 60fps — cada frame tem ~16ms para ser desenhado.

### Anime Apenas Propriedades Baratas

| Propriedade | Custo | Use? |
|-------------|-------|------|
| `transform` (translate, scale, rotate) | Composição (GPU) | **SEMPRE preferir** |
| `opacity` | Composição (GPU) | **SEMPRE preferir** |
| `width` / `height` / `top` / `left` | Layout (reflow) | **EVITE** — recalcula a página |
| `box-shadow` / `background-color` | Paint | Use com moderação |

### ANTES / DEPOIS: mover um card

| | RUIM (layout) | BOM (composição) |
|--|---------------|------------------|
| Mover | animar `left: 0 → 200px` | animar `transform: translateX(200px)` |
| Custo | reflow a cada frame, jank | só composição, 60fps |
| Redimensionar | animar `width`/`height` | animar `transform: scale()` |

### `will-change` — uso consciente

| Boa prática | Anti-padrão |
|-------------|-------------|
| Aplicar pouco antes da animação | Deixar `will-change` em dezenas de elementos sempre |
| Remover após terminar | "Otimizar" tudo preventivamente |
| Usar em poucos elementos por vez | Tratar como mágica de performance |

> `will-change` cria uma camada na GPU — útil pontualmente, mas em excesso **consome memória** e pode piorar a performance. Não é botão de "ficar rápido".

---

## 9. Anti-Padrões de Motion

### ❌ O Que NÃO Fazer

| Anti-padrão | Por Que é Ruim | Faça Assim |
|-------------|----------------|-----------|
| **Animação sem propósito** | Distrai, não comunica nada | Cada animação responde "o quê mudou?" |
| **Duração longa demais** | Faz o usuário esperar a UI | 100-300ms para interações diretas |
| **Tudo animado** | Ruído visual, nada se destaca | Anime o que importa; o resto é estático |
| **Bloquear a interação** | Usuário preso esperando o fim | Permita interromper / encadear ações |
| **Bounce em tudo** | Vira "brinquedo", perde seriedade | Bounce só em momentos de deleite |
| **Ignorar reduced-motion** | Causa mal-estar real | Degradar sempre |
| **Animar `width`/`top`** | Jank, reflow | Usar `transform`/`opacity` |
| **Auto-play infinito** | Cansa, compete pela atenção | Permitir pausar; respeitar preferências |

### Teste de Sanidade

```
Para CADA animação, pergunte:
├── Ela comunica uma mudança de estado?   → se não, remova
├── Está abaixo de ~400ms (se direta)?    → se não, encurte
├── Usa só transform/opacity?              → se não, refatore
├── Respeita prefers-reduced-motion?       → se não, é bug de acessibilidade
└── Eu notaria a falta dela?               → se não, era decoração
```

---

> **Lembre-se:** O melhor motion design é sentido, não notado. Ele orienta, dá feedback e cria continuidade — sem nunca fazer o usuário esperar ou enjoar. Movimento é linguagem, não enfeite.
