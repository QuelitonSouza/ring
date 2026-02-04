---
name: ring:frontend-design
description: |
  Design thinking e decisões de UI/UX para frontend web. Princípios de psicologia UX,
  sistemas de cores, tipografia e hierarquia visual. Ensina princípios, não valores fixos.

trigger: |
  - Criando componentes UI ou layouts
  - Definindo esquema de cores ou tipografia
  - Precisando melhorar UX de uma feature
  - Usuário menciona "design", "UI", "UX" ou "frontend"

skip_when: |
  - Apenas lógica de backend sem UI
  - Testes unitários sem componentes visuais
  - Refatoração de código sem impacto visual

sequence:
  before: [ring:writing-plans]

related:
  similar: [ring:brainstorming]
---

# Frontend Design System

> **Filosofia:** Cada pixel tem propósito. Restrição é luxo. Psicologia do usuário guia decisões.
> **Princípio Central:** PENSE, não memorize. PERGUNTE, não assuma.

## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [ux-psychology.md](ux-psychology.md) | 🔴 **OBRIGATÓRIO** | Sempre leia primeiro! |
| [design-systems.md](design-systems.md) | ⚪ Opcional | Cores, tipografia, efeitos |

---

## ⚠️ CRÍTICO: PERGUNTE ANTES DE ASSUMIR

> **PARE!** Se o pedido do usuário for aberto, NÃO use seus padrões favoritos.

### Quando o Prompt for Vago, PERGUNTE:

**Cor não especificada?** Pergunte:
> "Qual paleta de cores você prefere? (azul/verde/laranja/neutro/outro?)"

**Estilo não especificado?** Pergunte:
> "Qual estilo você quer? (minimalista/bold/retro/futurista/orgânico?)"

**Layout não especificado?** Pergunte:
> "Tem preferência de layout? (coluna única/grid/assimétrico/full-width?)"

### ⛔ TENDÊNCIAS PADRÃO A EVITAR (ANTI-SAFE HARBOR):

| Tendência Padrão de IA | Por Que é Ruim | Pense Assim |
|------------------------|----------------|-------------|
| **Bento Grids (Clichê Moderno)** | Usado em todo design de IA | Por que esse conteúdo PRECISA de um grid? |
| **Hero Split (Esquerda/Direita)** | Previsível e Entediante | Que tal Tipografia Massiva ou Narrativa Vertical? |
| **Gradientes Mesh/Aurora** | O background "novo" preguiçoso | Qual combinação de cores radical? |
| **Glassmorphism** | Ideia de IA de "premium" | Que tal sólido, flat de alto contraste? |
| **Cyan Profundo / Azul Fintech** | Safe harbor do ban de roxo | Por que não Vermelho, Preto ou Verde Neon? |
| **"Orquestrar / Capacitar"** | Copywriting gerado por IA | Como um humano diria isso? |
| Dark background + neon glow | Overused, "look de IA" | O que a MARCA realmente precisa? |
| **Tudo arredondado** | Genérico/Seguro | Onde posso usar bordas afiadas, brutalistas? |

---

## 1. Análise de Restrições (SEMPRE PRIMEIRO)

Antes de qualquer trabalho de design, RESPONDA ou PERGUNTE AO USUÁRIO:

| Restrição | Pergunta | Por Que Importa |
|-----------|----------|-----------------|
| **Timeline** | Quanto tempo? | Determina complexidade |
| **Conteúdo** | Pronto ou placeholder? | Afeta flexibilidade de layout |
| **Marca** | Guidelines existentes? | Pode ditar cores/fontes |
| **Tech** | Qual stack? | Afeta capacidades |
| **Audiência** | Quem exatamente? | Dirige todas as decisões visuais |

### Audiência → Abordagem de Design

| Audiência | Pensar Sobre |
|-----------|-------------|
| **Gen Z** | Bold, rápido, mobile-first, autêntico |
| **Millennials** | Limpo, minimal, orientado a valor |
| **Gen X** | Familiar, confiável, claro |
| **Boomers** | Legível, alto contraste, simples |
| **B2B** | Profissional, focado em dados, confiança |
| **Luxo** | Elegância contida, whitespace |

---

## 2. Leis de UX (Internalize)

| Lei | Princípio | Aplicação |
|-----|-----------|-----------|
| **Lei de Hick** | Mais escolhas = decisões mais lentas | Limite opções, use disclosure progressivo |
| **Lei de Fitts** | Maior + mais perto = mais fácil clicar | Dimensione CTAs apropriadamente |
| **Lei de Miller** | ~7 itens na memória de trabalho | Chunk conteúdo em grupos |
| **Von Restorff** | Diferente = memorável | Faça CTAs visualmente distintos |
| **Posição Serial** | Primeiro/último lembrados mais | Info chave no início/fim |

---

## 3. Regra 60-30-10 (Cores)

```
60% → Primário/Background (neutro, calmo)
30% → Secundário (áreas de suporte)
10% → Accent (CTAs, destaques, atenção)
```

### Seleção por Contexto

| Se Você Precisa... | Considere Matizes | Evite |
|--------------------|-------------------|-------|
| Confiança, calma | Família azul | Vermelhos agressivos |
| Crescimento, natureza | Família verde | Cinzas industriais |
| Energia, urgência | Laranja, vermelho | Azuis passivos |
| Luxo, criatividade | Teal profundo, Ouro, Esmeralda | Brilhantes baratos |
| Limpo, minimal | Neutros | Cor overwhelming |

---

## 4. Princípios de Tipografia

### Escala por Contexto

| Tipo de Conteúdo | Ratio de Escala | Sensação |
|------------------|-----------------|----------|
| UI densa | 1.125-1.2 | Compacto, eficiente |
| Web geral | 1.25 | Equilibrado (mais comum) |
| Editorial | 1.333 | Legível, espaçoso |
| Hero/display | 1.5-1.618 | Impacto dramático |

### Regras de Legibilidade

- **Comprimento de linha**: 45-75 caracteres ideal
- **Altura de linha**: 1.4-1.6 para texto body
- **Contraste**: Verifique requisitos WCAG
- **Tamanho**: 16px+ para body na web

---

## 5. Checklist "Wow Factor"

### Indicadores Premium

- [ ] Whitespace generoso (luxo = espaço para respirar)
- [ ] Profundidade e dimensão sutis
- [ ] Animações suaves e com propósito
- [ ] Atenção ao detalhe (alinhamento, consistência)
- [ ] Ritmo visual coeso
- [ ] Elementos customizados (não todos defaults)

### Construtores de Confiança

- [ ] Pistas de segurança onde apropriado
- [ ] Prova social / testimonials
- [ ] Proposta de valor clara
- [ ] Imagens profissionais
- [ ] Linguagem de design consistente

---

## 6. Anti-Padrões (O Que NÃO Fazer)

### ❌ Indicadores de Design Preguiçoso

- Fontes default do sistema sem consideração
- Imagens stock que não combinam
- Espaçamento inconsistente
- Muitas cores competindo
- Muros de texto sem hierarquia
- Contraste inacessível

### ❌ Padrões de Tendência de IA (EVITE!)

- **Mesmas cores todo projeto**
- **Dark + neon como default**
- **Roxo/violeta em tudo (PURPLE BAN ✅)**
- **Bento grids para landing pages simples**
- **Mesh Gradients & Glow Effects**
- **Mesma estrutura de layout / clone Vercel**
- **Não perguntar preferências do usuário**

---

## 7. Resumo do Processo de Decisão

```
Para CADA tarefa de design:

1. RESTRIÇÕES
   └── Qual timeline, marca, tech, audiência?
   └── Se não está claro → PERGUNTE

2. CONTEÚDO
   └── Qual conteúdo existe?
   └── Qual é a hierarquia?

3. DIREÇÃO DE ESTILO
   └── O que é apropriado para o contexto?
   └── Se não está claro → PERGUNTE (não use default!)

4. EXECUÇÃO
   └── Aplique princípios acima
   └── Verifique contra anti-padrões

5. REVISÃO
   └── "Isso serve o usuário?"
   └── "Isso é diferente dos meus defaults?"
   └── "Eu teria orgulho disso?"
```

---

> **Lembre-se:** Design é PENSAR, não copiar. Cada projeto merece consideração fresca baseada em seu contexto único e usuários. **Evite o Modern SaaS Safe Harbor!**
