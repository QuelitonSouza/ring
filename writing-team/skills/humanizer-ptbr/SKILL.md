---
name: ring:humanizer-ptbr
description: |
  Detecta e remove "cara de IA" (AI tells) de textos em português e reescreve para
  soar naturalmente humano, SEM mudar o sentido nem inventar fatos. Use para humanizar
  roteiros, copy de vendas, posts e qualquer texto que pareça gerado por IA.

trigger: |
  - Usuário pede para "humanizar" ou "tirar a cara de IA" de um texto
  - Revisar roteiro de YouTube, narração ou script
  - Revisar copy de vendas, post de rede social ou newsletter
  - Texto que "parece gerado por IA" precisa soar humano
  - Usuário menciona "humanizar", "naturalizar" ou "soar humano"

skip_when: |
  - Texto técnico que deve permanecer formal e literal (contrato, laudo, norma)
  - Código-fonte ou comentários de código
  - Dados estruturados (JSON, tabelas, planilhas, logs)
  - Documentação de API que exige precisão literal

related:
  similar: [ring:voice-and-tone]
---

# Humanizer PT-BR

> **Filosofia:** Humanizar é APAGAR a digital da IA, não reescrever o texto. Preserve o sentido, mate o clichê.
> **Princípio Central:** Soar humano NUNCA justifica inventar fato, número ou nome. Fidelidade primeiro.

## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [ai-tells.md](ai-tells.md) | 🔴 **OBRIGATÓRIO** | Sempre leia primeiro! Catálogo completo de tells |
| [rewrite-patterns.md](rewrite-patterns.md) | ⚪ Opcional | Técnicas de reescrita com ANTES → DEPOIS |

---

## ⚠️ PERGUNTE ANTES DE HUMANIZAR

> **PARE!** Humanizar sem contexto produz texto fora de tom. Se algo estiver aberto, PERGUNTE.

| O Que Perguntar | Por Que Importa |
|-----------------|-----------------|
| **Registro:** formal ou informal? | Define se pode usar contração ("tá", "pra") e gíria |
| **Público-alvo:** quem vai ler/ouvir? | Diretor jurídico ≠ inscrito de canal gamer |
| **Jargão técnico:** manter ou simplificar? | Termo correto não é "cara de IA" — não traduza errado |
| **Tamanho-alvo:** manter, encurtar ou expandir? | Humanizar costuma encurtar; confirme o limite |
| **Voz/marca:** existe um tom de referência? | Reescrita deve respeitar a voz já existente |

> Se o usuário já deu essas respostas no pedido, NÃO pergunte de novo. Use o que ele disse.

---

## Princípios Invioláveis

| Princípio | Regra |
|-----------|-------|
| **Preservar o sentido** | A ideia, o argumento e a ordem lógica permanecem idênticos |
| **NUNCA inventar fatos** | Não adicione dados, estatísticas, citações ou exemplos que não estavam no original |
| **Manter números e nomes** | Valores, datas, percentuais e nomes próprios passam intactos |
| **Respeitar o registro pedido** | Formal pedido ≠ jogar gíria; informal pedido ≠ engessar |
| **Não inflar nem cortar conteúdo** | Humanizar muda a forma, não acrescenta nem remove informação |

> **EVITE** "melhorar" o argumento. Seu trabalho é o COMO, não o O QUÊ.

---

## Categorias de AI Tells (Resumo)

> Catálogo completo, com exemplos por linha, está em [ai-tells.md](ai-tells.md). Aqui está o mapa.

| Categoria | Sintoma Típico | Exemplo de "Cara de IA" |
|-----------|----------------|--------------------------|
| **Léxico clichê** | Palavras que IA superusa | "Vale ressaltar", "mergulhe", "desbloqueie o potencial" |
| **Pontuação** | Travessão (—) e reticências em excesso | "A solução — e isso é importante — resolve tudo..." |
| **Estrutura** | Listas de três, paralelismo robótico | "Rápido, fácil e eficiente" em toda frase |
| **Tom** | Entusiasmo artificial e hedging | "É importante notar que isso é incrível!" |
| **Formatação** | Negrito e emoji decorativos | "**Atenção:** 🚀 dica **essencial** aqui ✨" |
| **Tradução literal** | Calque do inglês | "No final do dia", "fazer sentido" para "ter lógica" |

---

## Processo de Humanização

```
Para CADA texto:

1. CONTEXTO
   └── Registro, público, jargão, tamanho definidos?
   └── Se não → PERGUNTE antes de tocar no texto

2. DETECÇÃO
   └── Leia ai-tells.md e marque cada tell encontrado
   └── Liste mentalmente: léxico, pontuação, estrutura, tom, formatação, tradução

3. REESCRITA
   └── Aplique técnicas de reescrita (consulte rewrite-patterns.md se precisar)
   └── Varie o comprimento das frases; prefira voz ativa
   └── Troque clichê por linguagem concreta — sem inventar

4. VERIFICAÇÃO DE FIDELIDADE
   └── O sentido continua igual? Números e nomes intactos?
   └── Algum fato novo apareceu? → REMOVA

5. AJUSTE DE REGISTRO
   └── Bateu com o tom pedido?
   └── Não introduziu gíria em texto formal, nem engessou texto casual?

6. LEITURA EM VOZ ALTA (mental)
   └── "Um humano falaria assim?"
   └── "Soa natural ou ainda tem ritmo de IA?"
```

---

## Checklist Final

```
[ ] Sentido original 100% preservado
[ ] Nenhum fato, número, data ou nome inventado ou alterado
[ ] Clichês de IA removidos (ver ai-tells.md)
[ ] Comprimento de frases variado (não tudo no mesmo tamanho)
[ ] Voz ativa predominante
[ ] Advérbios em -mente desnecessários cortados
[ ] Meta-comentário removido ("neste artigo vamos...")
[ ] Travessões e reticências em nível humano
[ ] Negrito/emoji decorativos removidos (a menos que pedido)
[ ] Registro bate com o pedido do usuário
[ ] Jargão técnico mantido correto
[ ] Texto passa no teste "um humano falaria assim?"
```

---

## Anti-Padrões (O Que NÃO Fazer)

| Anti-Padrão | Por Que é Ruim | Faça Assim |
|-------------|----------------|------------|
| **Over-humanizar** | Encher de gíria e emoji vira outra "cara" artificial | Naturalidade ≠ exagero; doseie |
| **Mudar o sentido** | Reescrita "bonita" que diz outra coisa quebra o texto | Forma muda, ideia não |
| **Inventar para "enriquecer"** | Adicionar dado/exemplo falso é desinformação | Trabalhe só com o que está no original |
| **Engessar ao formalizar** | Tentar soar sério produz frase robótica | Formal pode ser claro e direto, não rígido |
| **Trocar termo técnico por aproximação** | "Simplificar" jargão pode estar errado | Mantenha o termo correto; explique se pedido |
| **Uniformizar tudo de novo** | Trocar um padrão de IA por outro só muda o disfarce | Varie ritmo, estrutura e vocabulário de verdade |

---

> **Regras de ouro:**
> 1. Humanizar é remover a digital da IA, não reescrever a mensagem.
> 2. Se você precisou inventar um fato para "soar melhor", você falhou.
> 3. Frase boa de humano tem ritmo irregular — abrace a variação.
> 4. Na dúvida sobre registro, PERGUNTE. Nunca assuma o tom.
