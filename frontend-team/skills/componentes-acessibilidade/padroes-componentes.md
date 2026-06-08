# Referência de Padrões de Componentes

> Deep dive em padrões de composição, controle de estado e anatomia acessível dos componentes mais comuns. Cada componente vem com seus requisitos de teclado e ARIA.

---

## 1. Padrões de Composição

### Compound Components (Componentes Compostos)

Vários componentes que trabalham juntos compartilhando estado implícito (via Context). O consumidor monta a estrutura, o componente cuida da lógica.

```tsx
// Uso: estrutura clara, flexível
<Tabs valorInicial="perfil">
  <Tabs.Lista>
    <Tabs.Aba valor="perfil">Perfil</Tabs.Aba>
    <Tabs.Aba valor="conta">Conta</Tabs.Aba>
  </Tabs.Lista>
  <Tabs.Painel valor="perfil">...</Tabs.Painel>
  <Tabs.Painel valor="conta">...</Tabs.Painel>
</Tabs>
```

| Vantagem | Cuidado |
|----------|---------|
| Estrutura legível e flexível | Estado compartilhado via Context |
| Consumidor controla a marcação | Documente a ordem esperada dos filhos |
| Ótimo para Tabs, Accordion, Menu | A11y deve ser embutida, não opcional |

### Controlled vs Uncontrolled

| Padrão | Quem Mantém o Estado | Quando Usar |
|--------|----------------------|-------------|
| **Controlled** | O pai (via `value` + `onChange`) | Validação ao vivo, estado compartilhado, sincronização |
| **Uncontrolled** | O próprio DOM (via `defaultValue` + `ref`) | Forms simples, performance, menos re-render |

```tsx
// Controlled: pai dita o valor
<input value={nome} onChange={e => setNome(e.target.value)} />

// Uncontrolled: DOM guarda, leio sob demanda
<input defaultValue="" ref={inputRef} />
```

> **Regra:** escolha um e seja consistente. Misturar `value` e `defaultValue` no mesmo campo gera bug e warning.

### Render Props / Slots

Permite ao consumidor injetar marcação customizada mantendo a lógica do componente.

```tsx
// Render prop: o componente entrega dados, o consumidor decide a UI
<Lista itens={produtos}>
  {(item) => <CardProduto produto={item} />}
</Lista>

// Slot (children nomeados): áreas de inserção
<Card>
  <Card.Cabecalho>Título</Card.Cabecalho>
  <Card.Corpo>Conteúdo</Card.Corpo>
</Card>
```

| Padrão | Bom Para |
|--------|----------|
| Render prop | Lógica reutilizável + UI variável (listas, virtualização) |
| Slots/children | Layout com regiões fixas (Card, Modal, Layout) |

### Estados de UI (relembrando)

Todo componente com dados trata os 4 estados. Detalhe completo em [SKILL.md](SKILL.md).

| Estado | A11y |
|--------|------|
| loading | `aria-busy="true"` no container |
| empty | Mensagem clara, foco gerenciável |
| error | `role="alert"` ou `aria-live` |
| success | Conteúdo semântico |

---

## 2. Anatomia de Componentes Comuns

Cada componente abaixo lista **requisitos de teclado** e **requisitos de ARIA**. Trate-os como checklist, não como sugestão.

---

### Modal / Dialog

> **OBRIGATÓRIO:** focus trap + Esc + retorno de foco + `aria-modal`.

**Requisitos de Teclado**

| Tecla | Comportamento |
|-------|---------------|
| `Esc` | Fecha o modal |
| `Tab` / `Shift+Tab` | Circula apenas dentro do modal (focus trap) |
| Ao abrir | Foco move para o modal (primeiro elemento focável ou o próprio diálogo) |
| Ao fechar | Foco retorna ao elemento que abriu |

**Requisitos de ARIA**

| Atributo | Valor |
|----------|-------|
| `role` | `dialog` (ou `alertdialog` para confirmações destrutivas) |
| `aria-modal` | `true` |
| `aria-labelledby` | Aponta para o título do modal |
| `aria-describedby` | Aponta para a descrição/corpo (opcional) |
| Conteúdo de fundo | `aria-hidden="true"` ou `inert` enquanto aberto |

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
  <h2 id="titulo-modal">Confirmar exclusão</h2>
  <p>Esta ação não pode ser desfeita.</p>
  <button onClick={fechar}>Cancelar</button>
  <button onClick={excluir}>Excluir</button>
</div>
```

---

### Dropdown / Menu

> **OBRIGATÓRIO:** roving tabindex + navegação por setas + Esc.

**Requisitos de Teclado**

| Tecla | Comportamento |
|-------|---------------|
| `Enter` / `Espaço` / `Seta ↓` | Abre o menu e foca o primeiro item |
| `Seta ↑` / `Seta ↓` | Move entre itens |
| `Home` / `End` | Primeiro / último item |
| `Esc` | Fecha e devolve foco ao gatilho |
| `Tab` | Fecha o menu e segue o fluxo normal |

**Requisitos de ARIA**

| Elemento | ARIA |
|----------|------|
| Botão gatilho | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` |
| Container | `role="menu"` |
| Itens | `role="menuitem"` |
| Foco | Roving tabindex (item ativo `tabindex="0"`, demais `-1`) |

> **Roving tabindex:** só um item é tabbable por vez; as setas movem o `tabindex="0"` entre eles.

---

### Tabs

> **OBRIGATÓRIO:** `aria-selected` + navegação por setas + associação aba↔painel.

**Requisitos de Teclado**

| Tecla | Comportamento |
|-------|---------------|
| `Seta ←` / `Seta →` | Move entre abas (em lista horizontal) |
| `Home` / `End` | Primeira / última aba |
| `Tab` | Sai da lista de abas e entra no painel ativo |

**Requisitos de ARIA**

| Elemento | ARIA |
|----------|------|
| Lista de abas | `role="tablist"` |
| Aba | `role="tab"`, `aria-selected`, `aria-controls` (→ painel) |
| Painel | `role="tabpanel"`, `aria-labelledby` (→ aba) |
| Foco | Roving tabindex entre as abas |

```tsx
<div role="tablist" aria-label="Configurações">
  <button role="tab" aria-selected={ativo === 'perfil'}
          aria-controls="painel-perfil" id="aba-perfil">Perfil</button>
</div>
<div role="tabpanel" id="painel-perfil" aria-labelledby="aba-perfil">...</div>
```

---

### Accordion

**Requisitos de Teclado**

| Tecla | Comportamento |
|-------|---------------|
| `Enter` / `Espaço` | Expande/recolhe a seção focada |
| `Tab` | Move entre cabeçalhos e conteúdos visíveis |
| `Seta ↑` / `↓` (opcional) | Move entre cabeçalhos |

**Requisitos de ARIA**

| Elemento | ARIA |
|----------|------|
| Cabeçalho | `<button>` dentro de `<h3>`, com `aria-expanded` e `aria-controls` |
| Painel | `id` referenciado pelo `aria-controls`; `hidden` quando recolhido |

> **Dica:** use um `<button>` real no cabeçalho — ganha foco e teclado de graça.

---

### Tooltip

**Requisitos de Teclado**

| Gatilho | Comportamento |
|---------|---------------|
| Foco no elemento | Tooltip aparece |
| `Esc` | Esconde o tooltip |
| Hover | Aparece (mas NUNCA só hover — precisa do foco também) |

**Requisitos de ARIA**

| Elemento | ARIA |
|----------|------|
| Gatilho | `aria-describedby` apontando para o tooltip |
| Tooltip | `role="tooltip"` |

> **EVITE** colocar conteúdo interativo (links, botões) dentro de tooltip — use popover. Tooltip é só texto descritivo.

---

### Toast / Live Region

> Mensagens transitórias (sucesso, erro) precisam ser anunciadas sem roubar o foco.

**Requisitos de Teclado**

| Situação | Comportamento |
|----------|---------------|
| Toast com ação (ex: "Desfazer") | A ação deve ser alcançável por teclado |
| Toast informativo | NÃO move o foco do usuário |

**Requisitos de ARIA**

| Tipo | ARIA |
|------|------|
| Informativo / sucesso | Container com `aria-live="polite"` |
| Erro / urgente | `role="alert"` (equivale a `aria-live="assertive"`) |
| Atomicidade | `aria-atomic="true"` para ler a mensagem inteira |

```tsx
// Região fixa no DOM; o conteúdo muda quando surge um toast
<div aria-live="polite" aria-atomic="true" className="toast-region">
  {toast?.mensagem}
</div>
```

---

### Form Field (Campo de Formulário)

> Detalhe de formulários acessíveis está em [SKILL.md](SKILL.md). Aqui, a anatomia completa do campo.

**Requisitos de Teclado**

| Tecla | Comportamento |
|-------|---------------|
| `Tab` | Foca o campo na ordem lógica |
| Digitação | Funciona normalmente |
| `Enter` (em form) | Submete (com `<button type="submit">`) |

**Requisitos de ARIA / Estrutura**

| Elemento | Requisito |
|----------|-----------|
| Label | `<label htmlFor>` associado ao `id` do input |
| Estado de erro | `aria-invalid="true"` |
| Mensagem de erro | `aria-describedby` aponta para o `<p>` do erro |
| Dica/ajuda | `aria-describedby` pode apontar para texto auxiliar |
| Obrigatório | `required` + indicação visual textual (não só asterisco vermelho) |
| Grupo | `<fieldset>` + `<legend>` para radios/checkboxes relacionados |

```tsx
<fieldset>
  <legend>Forma de pagamento</legend>
  <label><input type="radio" name="pgto" value="pix" /> Pix</label>
  <label><input type="radio" name="pgto" value="cartao" /> Cartão</label>
</fieldset>
```

---

## 3. Tabela-Resumo: Componente → Requisitos

| Componente | Teclado-chave | ARIA-chave |
|------------|---------------|------------|
| **Modal/Dialog** | Esc, focus trap, retorno de foco | `role="dialog"`, `aria-modal`, `aria-labelledby` |
| **Dropdown/Menu** | Setas, Home/End, Esc, roving tabindex | `role="menu"`, `menuitem`, `aria-haspopup`, `aria-expanded` |
| **Tabs** | Setas, Home/End, roving tabindex | `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls` |
| **Accordion** | Enter/Espaço, Tab | `aria-expanded`, `aria-controls`, header em `<button>` |
| **Tooltip** | Foco mostra, Esc esconde | `role="tooltip"`, `aria-describedby` |
| **Toast/Live** | Ação alcançável, sem roubar foco | `aria-live` / `role="alert"`, `aria-atomic` |
| **Form Field** | Tab lógico, Enter submete | `<label>`, `aria-invalid`, `aria-describedby` |

---

## 4. Erros Frequentes por Componente

| Componente | Erro Comum | Correção |
|------------|------------|----------|
| Modal | Esc não fecha / foco escapa | Focus trap + handler de Esc |
| Modal | Foco some ao fechar | Devolver foco ao gatilho |
| Menu | Só funciona com mouse | Setas + roving tabindex |
| Tabs | Todas as abas tabbáveis | Roving tabindex (uma por vez) |
| Tabs | Painel sem vínculo | `aria-controls` + `aria-labelledby` |
| Accordion | Cabeçalho é `<div>` | Use `<button>` |
| Tooltip | Só aparece no hover | Mostrar também no `:focus` |
| Toast | Não é anunciado | `aria-live` ou `role="alert"` |
| Form | Erro só em vermelho | Texto + `aria-invalid` + `aria-describedby` |

---

> **Lembre-se:** Cada componente interativo tem um padrão de teclado e ARIA esperado pelos leitores de tela. Seguir o padrão (WAI-ARIA Authoring Practices) é o que torna o componente previsível para quem não usa mouse.
