# Sistemas de Design

> Princípios de cores, tipografia, efeitos visuais e animações para design de interface.

---

## 1. Sistema de Cores

### Fundamentos da Teoria das Cores

```
                    AMARELO
                       │
            Amarelo-   │    Amarelo-
            Verde      │    Laranja
               ╲       │       ╱
                ╲      │      ╱
    VERDE ─────────── ● ─────────── LARANJA
                ╱      │      ╲
               ╱       │       ╲
            Azul-      │    Vermelho-
            Verde      │    Laranja
                       │
                    VERMELHO
                       │
                    ROXO ← ⚠️ BANIDO (tendência de IA)
                   ╱       ╲
              Azul-         Vermelho-
              Roxo          Roxo
                   ╲       ╱
                     AZUL
```

### Relações de Cores

| Esquema | Como Criar | Quando Usar |
|---------|------------|-------------|
| **Monocromático** | UM matiz, varie só lightness/saturação | Minimal, profissional, coeso |
| **Análogo** | 2-3 matizes ADJACENTES na roda | Harmonioso, calmo, natureza |
| **Complementar** | Matizes OPOSTOS na roda | Alto contraste, vibrante |
| **Split-Complementar** | Base + 2 cores adjacentes ao complemento | Dinâmico mas equilibrado |
| **Triádico** | 3 matizes EQUIDISTANTES na roda | Vibrante, playful, criativo |

### Distribuição 60-30-10

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     60% PRIMÁRIO (Background, áreas grandes)    │
│     → Deve ser neutro ou calmante               │
│     → Carrega o tom geral                       │
│                                                 │
├────────────────────────────────────┬────────────┤
│                                    │            │
│   30% SECUNDÁRIO                   │ 10% ACCENT │
│   (Cards, seções, headers)         │ (CTAs,     │
│   → Suporta sem dominar            │ destaques) │
│                                    │ → Atrai    │
│                                    │   atenção  │
└────────────────────────────────────┴────────────┘
```

### Psicologia das Cores (Para Tomada de Decisão)

| Se Projeto É... | Considere Estes Matizes | Por Quê |
|-----------------|------------------------|---------|
| **Finança, Tech, Saúde** | Azuis, Teals | Confiança, estabilidade |
| **Eco, Wellness, Natureza** | Verdes, tons terrosos | Crescimento, saúde |
| **Food, Energia, Youth** | Laranja, Amarelo, Quentes | Apetite, excitação |
| **Luxo, Beleza, Criativo** | Teal profundo, Ouro, Preto | Sofisticação |
| **Urgência, Sales, Alertas** | Vermelho, Laranja | Ação, atenção |

---

## 2. Sistema de Tipografia

### Escalas Modulares

| Ratio | Valor | Sensação | Melhor Para |
|-------|-------|----------|-------------|
| Minor Second | 1.067 | Muito sutil | UI densa, telas pequenas |
| Major Second | 1.125 | Sutil | Interfaces compactas |
| Minor Third | 1.2 | Confortável | Apps mobile, cards |
| Major Third | 1.25 | Equilibrado | Web geral (mais comum) |
| Perfect Fourth | 1.333 | Notável | Editorial, blogs |
| Perfect Fifth | 1.5 | Dramático | Headlines, marketing |
| Golden Ratio | 1.618 | Impacto máximo | Hero sections, display |

### Gerando Sua Escala

```
Dado: base = SEU_TAMANHO_BASE, ratio = SEU_RATIO

Escala:
├── xs:  base ÷ ratio²
├── sm:  base ÷ ratio
├── base: SEU_TAMANHO_BASE
├── lg:  base × ratio
├── xl:  base × ratio²
├── 2xl: base × ratio³
├── 3xl: base × ratio⁴
└── ... continue conforme necessário
```

### Altura de Linha por Contexto

| Tipo de Conteúdo | Range de Line Height | Por Quê |
|------------------|---------------------|---------|
| **Headings** | 1.1 - 1.3 | Linhas curtas, quer compacto |
| **Body text** | 1.4 - 1.6 | Leitura confortável |
| **Long-form** | 1.6 - 1.8 | Legibilidade máxima |
| **UI elements** | 1.2 - 1.4 | Eficiência de espaço |

### Comprimento de Linha Ideal

```
O sweet spot: 45-75 caracteres por linha
├── < 45: Muito picotado, quebra fluxo
├── 45-75: Leitura confortável
├── > 75: Strain de eye tracking
```

---

## 3. Efeitos Visuais

### Glassmorphism (Quando Apropriado)

```
Propriedades chave:
├── Background semi-transparente
├── Backdrop blur
├── Border sutil para definição
└── ⚠️ **AVISO:** Glassmorphism azul/branco standard é clichê moderno.
    Use radicalmente ou não use.
```

### Hierarquia de Sombras

```
Conceito de elevação:
├── Elementos mais altos = sombras maiores
├── Y-offset > X-offset (luz de cima)
├── Múltiplas camadas = mais realista
└── Dark mode: pode precisar de glow ao invés
```

### Uso de Gradientes

```
Gradientes harmoniosos:
├── Cores adjacentes na roda (análogos)
├── OU mesmo matiz, lightness diferente
├── Evite pares complementares harsh
├── 🚫 **SEM Gradientes Mesh/Aurora** (blobs flutuantes)
└── VARIE radicalmente de projeto para projeto
```

---

## 4. Princípios de Animação

### Conceito de Timing

```
Duração baseada em:
├── Distância (mais longe = maior)
├── Tamanho (maior = mais lento)
├── Importância (crítico = claro)
└── Contexto (urgente = rápido, luxo = lento)
```

### Seleção de Easing

| Ação | Easing | Por Quê |
|------|--------|---------|
| Entrando | Ease-out | Desacelera, assenta |
| Saindo | Ease-in | Acelera, sai |
| Ênfase | Ease-in-out | Suave, deliberado |
| Playful | Bounce | Divertido, energético |

### Performance de Animação

- Anime apenas `transform` e `opacity`
- Respeite preferência `reduced-motion`
- Teste em devices low-end

---

## 5. Dark Mode

### Regras Chave

1. **Nunca preto puro** → Use cinza muito escuro com leve matiz
2. **Nunca texto branco puro** → Use 87-92% lightness
3. **Reduza saturação** → Cores vibrantes cansam olhos em dark mode
4. **Elevação = brilho** → Elementos mais altos ligeiramente mais claros

### Camadas de Background

```
Camadas (mais escuro → mais claro conforme elevação aumenta):
Layer 0 (base)    → Mais escuro
Layer 1 (cards)   → Ligeiramente mais claro
Layer 2 (modals)  → Ainda mais claro
Layer 3 (popups)  → Dark mais claro
```

---

## 6. Acessibilidade

### Requisitos de Contraste (WCAG)

| Nível | Texto Normal | Texto Grande |
|-------|--------------|--------------|
| AA (mínimo) | 4.5:1 | 3:1 |
| AAA (aprimorado) | 7:1 | 4.5:1 |

### Padrões Seguros

| Caso de Uso | Diretriz |
|-------------|----------|
| **Texto em bg claro** | Use lightness 35% ou menos |
| **Texto em bg escuro** | Use lightness 85% ou mais |
| **Primário em branco** | Garanta variante escura suficiente |
| **Botões** | Alto contraste entre bg e texto |

---

> **Lembre-se:** Design systems são ferramentas para consistência e eficiência. Não os siga cegamente - adapte para cada contexto e necessidade de usuário.
