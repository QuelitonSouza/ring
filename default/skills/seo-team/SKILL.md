---
name: ring:seo-team
description: |
  Fundamentos de SEO, E-E-A-T, Core Web Vitals e princípios de algoritmos Google.
  Otimização técnica e de conteúdo para mecanismos de busca.

trigger: |
  - Criando páginas web que precisam ranquear
  - Otimizando meta tags, títulos ou descrições
  - Implementando Schema.org ou structured data
  - Usuário menciona "SEO", "ranqueamento", "Google" ou "busca"

skip_when: |
  - Apps internas sem necessidade de indexação
  - APIs ou backends sem interface pública
  - Protótipos ou MVPs sem foco em descoberta

sequence:
  before: [ring:writing-plans]

related:
  similar: [ring:frontend-team]
---

# SEO Fundamentals

> Princípios para visibilidade em mecanismos de busca.

---

## 1. Framework E-E-A-T

| Princípio | Sinais |
|-----------|--------|
| **Experience** (Experiência) | Conhecimento de primeira mão, exemplos reais |
| **Expertise** (Expertise) | Credenciais, profundidade de conhecimento |
| **Authoritativeness** (Autoridade) | Backlinks, menções, reconhecimento da indústria |
| **Trustworthiness** (Confiabilidade) | HTTPS, transparência, informação precisa |

**Aplicação:**
- Mostre credenciais do autor
- Use exemplos reais e cases
- Cite fontes autoritativas
- Garanta HTTPS e políticas claras

---

## 2. Core Web Vitals

| Métrica | Target | Mede |
|---------|--------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Performance de carregamento |
| **INP** (Interaction to Next Paint) | < 200ms | Interatividade |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Estabilidade visual |

### Como Otimizar

**LCP:**
- Otimize imagens (next-gen formats, lazy loading)
- Preload recursos críticos
- Use CDN para assets

**INP:**
- Minimize JavaScript de terceiros
- Use Web Workers para tarefas pesadas
- Evite long tasks (>50ms)

**CLS:**
- Defina dimensões de imagens/videos
- Reserve espaço para ads
- Evite injetar conteúdo acima do viewport

---

## 3. SEO Técnico

### Estrutura do Site

| Elemento | Propósito |
|----------|-----------|
| **XML sitemap** | Ajuda crawling |
| **robots.txt** | Controla acesso |
| **Canonical tags** | Previne duplicatas |
| **HTTPS** | Sinal de segurança |
| **URLs limpas** | Crawlability |

### Checklist Técnico

```
[ ] Sitemap.xml presente e atualizado
[ ] robots.txt configurado corretamente
[ ] Canonical tags em todas as páginas
[ ] HTTPS habilitado
[ ] URLs descritivas (sem IDs ou hashes)
[ ] Mobile-friendly (responsive)
[ ] Sem erros 404 ou broken links
```

---

## 4. SEO de Conteúdo

### Elementos de Página

| Elemento | Best Practice |
|----------|---------------|
| **Title tag** | 50-60 chars, keyword no início |
| **Meta description** | 150-160 chars, compelling |
| **H1** | Um por página, keyword principal |
| **H2-H6** | Hierarquia lógica |
| **Alt text** | Descritivo, não stuffed |
| **URLs** | Curtas, descritivas, com keyword |

### Qualidade de Conteúdo

| Fator | Importância |
|-------|------------|
| **Profundidade** | Cobertura abrangente do tópico |
| **Freshness** | Atualizações regulares |
| **Uniqueness** | Valor original, não copiado |
| **Readability** | Escrita clara e acessível |
| **Intent match** | Responde à intenção de busca |

---

## 5. Schema Markup

### Tipos Comuns

| Tipo | Uso |
|------|-----|
| `Article` | Blog posts, notícias |
| `Organization` | Info da empresa |
| `Person` | Perfis de autor |
| `FAQPage` | Conteúdo Q&A |
| `Product` | E-commerce |
| `Review` | Avaliações |
| `BreadcrumbList` | Navegação |
| `LocalBusiness` | Negócios locais |
| `Service` | Descrição de serviços |

### Implementação

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Nome da Empresa",
  "url": "https://exemplo.com",
  "logo": "https://exemplo.com/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+55-11-1234-5678",
    "contactType": "customer service"
  }
}
```

---

## 6. Diretrizes para Conteúdo AI

### O Que Google Procura

| ✅ Faça | ❌ Não Faça |
|---------|------------|
| AI draft + edição humana | Publicar conteúdo AI cru |
| Adicionar insights originais | Copiar sem agregar valor |
| Review por especialista | Pular fact-checking |
| Seguir E-E-A-T | Keyword stuffing |
| Demonstrar experiência real | Claims sem evidência |

### Humanizando Conteúdo AI

- Adicione perspectiva pessoal ou da marca
- Inclua exemplos específicos e reais
- Cite fontes e estatísticas verificáveis
- Revise tom e voz para consistência da marca
- Remova frases genéricas de IA

---

## 7. Fatores de Ranqueamento (Priorizados)

| Prioridade | Fator |
|------------|-------|
| 1 | Conteúdo de qualidade e relevante |
| 2 | Backlinks de sites autoritativos |
| 3 | Experiência de página (Core Web Vitals) |
| 4 | Otimização mobile |
| 5 | Fundamentos de SEO técnico |
| 6 | Schema markup e rich snippets |
| 7 | Sinais de engajamento do usuário |

---

## 8. Medição e Ferramentas

| Métrica | Ferramenta |
|---------|------------|
| Rankings | Search Console, Ahrefs, SEMrush |
| Tráfego | Google Analytics |
| Core Web Vitals | PageSpeed Insights, Lighthouse |
| Indexação | Search Console |
| Backlinks | Ahrefs, SEMrush, Moz |
| Schema | Schema Markup Validator |

### KPIs Essenciais

```
[ ] Impressões e clicks (Search Console)
[ ] Posição média por keyword
[ ] CTR por página
[ ] Core Web Vitals scores
[ ] Páginas indexadas vs submitted
[ ] Organic traffic trend
```

---

## 9. Checklist SEO por Página

### Antes de Publicar

```
[ ] Title tag otimizada (50-60 chars, keyword)
[ ] Meta description compelling (150-160 chars)
[ ] H1 único com keyword principal
[ ] Hierarquia H2-H6 lógica
[ ] Alt text em todas as imagens
[ ] URL limpa e descritiva
[ ] Links internos relevantes
[ ] Schema markup apropriado
[ ] Conteúdo responde à search intent
[ ] Mobile-friendly verificado
```

### Após Publicar

```
[ ] Submeter URL na Search Console
[ ] Verificar indexação após 24-48h
[ ] Monitorar rankings iniciais
[ ] Verificar comportamento de usuário (bounce, time on page)
```

---

## 10. Erros Comuns a Evitar

| Erro | Impacto | Solução |
|------|---------|---------|
| Thin content | Baixo ranking | Expanda com valor real |
| Duplicate content | Confunde crawlers | Use canonical tags |
| Keyword stuffing | Penalização | Escreva naturalmente |
| Missing alt text | Perde image SEO | Descreva todas as imagens |
| Slow page speed | Perde rankings e users | Otimize Core Web Vitals |
| No mobile optimization | Perde mobile-first indexing | Responsive design |
| Ignoring search intent | Baixo CTR, high bounce | Match content ao intent |

---

> **Lembre-se:** SEO é um jogo de longo prazo. Conteúdo de qualidade + excelência técnica + paciência = resultados.
