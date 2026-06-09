# Roteiro Template — Preencha Antes de Gravar

> Copie este bloco, preencha com o usuario no PASSO 0 (INTAKE) e use-o para montar `config.json` e `scenes.json`. Nao comece a gravar sem isto completo.

---

## PARAMETROS

### Ambientes (URLs + descricao)

> A lista e flexivel. Adicione quantas areas o sistema tiver ("etc").

| Area (seg) | URL da demo | URL de login (se diferente) | Descricao curta (vira narracao) |
|-----------|-------------|-----------------------------|---------------------------------|
| `hero`    |             | (publica, sem login)        |                                 |
| `client`  |             |  ex: `/entrar`              |                                 |
| `admin`   |             |  ex: `/admin/login`         |                                 |
| `___`     |             |                             |                                 |

### Credenciais por area (conta de TESTE)

| Area (seg) | Usuario | Senha | Tem 2FA? (s/n) |
|-----------|---------|-------|----------------|
| `client`  |         |       |                |
| `admin`   |         |       |                |

> Use SEMPRE contas de teste. Credenciais vivem no `config.json` da pasta de trabalho (fora do repo). Codigo 2FA sera digitado em `admin_code.txt` na hora da captura.

### Idioma / Voz

- Idioma: **PT-BR**
- Voz: **`pt-BR-AntonioNeural`** (masculina, default) — alternativa feminina `pt-BR-FranciscaNeural` so se pedir.
- Rate: `-2%` (default, levemente mais pausado)

### Duracao alvo

- Master YouTube (16:9): **~3-4 min**
- Vertical TikTok/Instagram (9:16): **~1-2 min**

### Dados sensiveis

- Politica: **[ ] mostrar  [ ] desfocar  [ ] evitar**
- Observacoes (nomes/valores/documentos a esconder):

### Pasta de trabalho (FORA do repo)

- Caminho: `__________________________` (ex: `C:\demos\meu-sistema` ou `~/demos/meu-sistema`)

---

## ESQUELETO DE PLANO DE CENAS

> Monte ~20 cenas no master (6-13s cada). Abertura -> fluxo cliente -> fluxo admin -> fechamento de marca. Marque `short:true` no subconjunto que entra no vertical (~1-2min).

| id | seg | Acao na tela | Texto (narracao == legenda) | short |
|----|-----|--------------|------------------------------|-------|
| 01 | hero | Abre a landing | "Conheca o [Produto], a forma mais simples de..." | true |
| 02 | hero | Rola ate features | "Tudo num so lugar: ..." | false |
| 03 | hero | Mostra CTA | "Comecar leva menos de um minuto." | true |
| 04 | client | Tela de login | "Veja a area do cliente." | false |
| 05 | client | Faz login | "Entrando com a conta..." | false |
| 06 | client | Dashboard | "Aqui o cliente acompanha..." | true |
| .. | .. | .. | .. | .. |
| 19 | admin | Relatorios | "O admin tem visao completa de..." | true |
| 20 | hero | Fechamento de marca | "[Produto]. Experimente hoje em [site]." | true |

> Lembrete: o texto da cena E a narracao E a legenda. Pode passar pelo `ring:humanizer-ptbr` para soar mais natural antes de gerar o TTS.
