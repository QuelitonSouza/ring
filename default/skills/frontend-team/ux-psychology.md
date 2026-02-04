# Referência de Psicologia UX

> Deep dive em leis de UX, design emocional, construção de confiança e psicologia comportamental.

---

## 1. Leis Fundamentais de UX

### Lei de Hick

**Princípio:** O tempo para tomar uma decisão aumenta logaritmicamente com o número de escolhas.

**Aplicação:**
- Navegação: Máximo 5-7 itens top-level
- Forms: Quebre em steps (disclosure progressivo)
- Opções: Seleções default quando possível
- Filtros: Priorize mais usados, esconda avançados

**Exemplo:**
```
❌ Ruim: 15 itens de menu em uma nav
✅ Bom: 5 categorias principais + "Mais"

❌ Ruim: 20 campos de form de uma vez
✅ Bom: Wizard de 3 steps com 5-7 campos cada
```

---

### Lei de Fitts

**Princípio:** Tempo para alcançar um alvo = função de distância e tamanho.

**Aplicação:**
- CTAs: Faça botões primários maiores (min 44px height)
- Touch targets: 44×44px mínimo em mobile
- Posicionamento: Ações importantes perto da posição natural do cursor
- Cantos: "Magic corners" (borda infinita = fácil de acertar)

---

### Lei de Miller

**Princípio:** Pessoa média pode manter 7±2 chunks na memória de trabalho.

**Aplicação:**
- Listas: Agrupe em chunks de 5-7 itens
- Navegação: Máximo 7 itens de menu
- Conteúdo: Quebre conteúdo longo com headings
- Telefones: 555-123-4567 (chunked)

---

### Efeito Von Restorff (Efeito de Isolamento)

**Princípio:** Um item que se destaca é mais provável de ser lembrado.

**Aplicação:**
- Botões CTA: Cor distinta de outros elementos
- Pricing: Destaque plano recomendado
- Info importante: Diferenciação visual
- Novos recursos: Badge ou callout

---

### Efeito de Posição Serial

**Princípio:** Itens no início (primazia) e fim (recência) de uma lista são lembrados melhor.

**Aplicação:**
- Navegação: Itens mais importantes primeiro e último
- Listas: Info chave no topo e fundo
- Forms: Campos mais críticos no início
- CTAs: Repita no topo e fundo de páginas longas

---

### Lei de Jakob

**Princípio:** Usuários passam a maior parte do tempo em outros sites. Eles preferem que seu site funcione como todos os outros que já conhecem.

**Aplicação:**
- **Padrões:** Use posicionamento standard para barra de busca e carrinhos
- **Mental Models:** Use ícones familiares (ex: lupa)
- **Vocabulário:** Use "Login" ao invés de "Entrar no Portal"
- **Layout:** Mantenha logo top-left para navegação "Home"

---

### Limiar de Doherty

**Princípio:** Produtividade dispara quando computador e usuários interagem em pace (<400ms) que garante que nenhum espere pelo outro.

**Aplicação:**
- **Feedback:** Use pistas visuais imediatas para clicks
- **Loading:** Use skeleton screens para performance perceptível
- **Otimismo:** Atualize UI antes do servidor responder (Optimistic UI)
- **Movimento:** Use micro-animações para mascarar delays leves

---

## 2. Percepção Visual (Princípios Gestalt)

### Lei da Proximidade
Objetos próximos tendem a ser agrupados juntos.

**Aplicação:**
- Mantenha labels fisicamente perto de input fields
- Margins maiores entre blocos de conteúdo não relacionados
- Agrupe campos de endereço separados de campos de cartão de crédito

### Lei da Similaridade
Elementos semelhantes são percebidos como grupo completo.

**Aplicação:**
- Cores consistentes para todos os links clicáveis
- Todos os ícones de um set devem ter mesmo peso de stroke
- Mesma forma/tamanho para botões de mesma importância

### Lei da Região Comum
Elementos são percebidos como grupos se compartilham área com boundary definido.

**Aplicação:**
- Use cards para agrupar imagens e títulos
- Use linhas para separar sidebar do feed principal
- Use background diferente para footer

---

## 3. Vieses Cognitivos & Comportamento

### Efeito Zeigarnik
Pessoas lembram tarefas incompletas melhor que tarefas completas.

**Aplicação:**
- Gamificação: Use barras "Perfil 60% completo"
- Engajamento: Provoque o próximo módulo em learning path
- Retenção: Mostre "To-Do" de features a explorar

### Efeito Gradiente de Meta
Tendência de se aproximar de uma meta aumenta com proximidade à meta.

**Aplicação:**
- Dê "Avanço Artificial" (ex: 2 selos grátis)
- Quebre form de 10 campos em dois steps de 5
- Celebre milestones na metade da tarefa

### Regra Peak-End
Pessoas julgam experiência baseado em como se sentiram no pico e no fim.

**Aplicação:**
- Faça tela "Pedido Confirmado" memorável
- Adicione confetti ou animação única no ponto de valor
- Garanta que interação final com chat bot seja útil

### Efeito Estético-Usabilidade
Usuários percebem design esteticamente agradável como mais usável.

**Aplicação:**
- Visuais high-fidelity compram "crédito de confiança"
- Imagens de alta qualidade consistentes
- Interfaces bonitas mantêm usuários explorando mais

### Prova Social
Pessoas copiam ações de outros para saber como se comportar.

**Aplicação:**
- Display "Junte-se a 50.000+ outros"
- Star ratings e testimonials verificados
- Seção "Trusted by" mostrando logos de parceiros

### Princípio da Escassez
Humanos dão mais valor a objetos escassos.

**Aplicação:**
- "Apenas 2 itens restantes em estoque"
- Timers de countdown para promoções
- Betas "apenas por convite"

### Aversão à Perda
Pessoas preferem evitar perdas a adquirir ganhos equivalentes.

**Aplicação:**
- "Não perca seu desconto"
- "Seu trial está acabando - mantenha seus dados agora"
- "30-day money-back guarantee"

---

## 4. Design Emocional (Don Norman)

### Três Níveis de Processamento

```
┌─────────────────────────────────────────────────────────────┐
│  VISCERAL (Cérebro Lagarto)                                 │
│  ─────────────────────                                      │
│  • Reação imediata, automática                              │
│  • Primeiras impressões (primeiros 50ms)                    │
│  • Estéticas: cores, formas, imagens                        │
│  • "Uau, isso é lindo!"                                     │
├─────────────────────────────────────────────────────────────┤
│  COMPORTAMENTAL (Cérebro Funcional)                         │
│  ─────────────────────────────                              │
│  • Usabilidade e função                                     │
│  • Prazer do uso efetivo                                    │
│  • Performance, confiabilidade, facilidade                  │
│  • "Isso funciona exatamente como eu esperava!"             │
├─────────────────────────────────────────────────────────────┤
│  REFLEXIVO (Cérebro Consciente)                             │
│  ─────────────────────────────                              │
│  • Pensamento consciente e significado                      │
│  • Identidade pessoal e valores                             │
│  • Memória de longo prazo e lealdade                        │
│  • "Essa marca representa quem eu sou"                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Sistema de Construção de Confiança

### Categorias de Sinais de Confiança

| Categoria | Elementos | Implementação |
|-----------|----------|---------------|
| **Segurança** | SSL, badges, encryption | Cadeado visível, logos de segurança em forms |
| **Prova Social** | Reviews, testimonials, logos | Star ratings, fotos de clientes, logos de marcas |
| **Transparência** | Políticas, pricing, contato | Links claros, sem taxas escondidas, endereço real |
| **Profissional** | Qualidade de design, consistência | Sem elementos quebrados, branding consistente |
| **Autoridade** | Certificações, prêmios, mídia | "Visto em...", certificações da indústria |

### Posicionamento de Sinais de Confiança

```
┌────────────────────────────────────────────────────┐
│  HEADER: Banner de confiança ("Frete grátis |     │
│          30 dias retorno | Checkout seguro")        │
├────────────────────────────────────────────────────┤
│  HERO: Prova social ("Confiado por 10.000+")       │
├────────────────────────────────────────────────────┤
│  PRODUTO: Reviews visíveis, badges de segurança    │
├────────────────────────────────────────────────────┤
│  CHECKOUT: Ícones de pagamento, badge SSL          │
├────────────────────────────────────────────────────┤
│  FOOTER: Info de contato, políticas, certificações │
└────────────────────────────────────────────────────┘
```

---

> **Lembre-se:** UX psychology é sobre entender como humanos pensam e se comportam. Use esses princípios eticamente para criar experiências melhores, não para manipular.
