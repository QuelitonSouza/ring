---
name: ring:video-demo-narrado
description: |
  Grava um VIDEO-DEMO NARRADO de um sistema web em gravacao de tela REAL (Playwright),
  com narracao TTS em PT-BR (voz masculina) e legendas queimadas sincronizadas. Entrega
  DOIS videos: master YouTube 16:9 (~3-4min) e vertical TikTok/Instagram 9:16 (~1-2min).
  Use quando o usuario pedir "grava um video do meu sistema", "video demo de sistema web",
  "video narrado", "screencast narrado", "demo para YouTube/TikTok/Instagram" ou similar.

trigger: |
  - Usuario quer um video demonstrando um sistema/site web funcionando
  - Usuario diz "grava um video do meu sistema" ou "faz uma demo narrada"
  - Precisa de screencast narrado para YouTube, TikTok ou Instagram
  - Precisa de video vertical (Short/Reels) derivado de uma demo
  - Usuario menciona "video demo", "demo narrada", "screencast", "tour do produto"

skip_when: |
  - Nao e gravacao de pagina web (app desktop nativo, mobile sem browser, CLI)
  - Usuario so quer um print estatico ou um GIF curto sem narracao
  - Edicao de um video JA gravado (corte/legendagem de material existente)
  - Usuario quer apenas o roteiro/script em texto, sem gerar video

related:
  similar: [ring:humanizer-ptbr]
---

# Video Demo Narrado

> **Filosofia:** Gravacao REAL, narracao humana, sincronia perfeita. O video tem que parecer que um humano gravou e narrou, nao um robo.
> **Principio Central:** PERGUNTE antes de gravar. Sem URLs, credenciais e politica de dados, nao comece. t0 e SAGRADO: nunca resete depois do load.

## Leitura Seletiva

| Arquivo | Status | Quando Ler |
|---------|--------|------------|
| [references/gotchas.md](references/gotchas.md) | 🔴 **OBRIGATORIO** | Leia ANTES de tudo. 10 licoes que custam horas |
| [references/sincronia-e-captura.md](references/sincronia-e-captura.md) | 🔴 **OBRIGATORIO** | Leia ANTES de capturar. Protocolo de t0, 2FA e cursor |
| [references/legendas-e-composicao.md](references/legendas-e-composicao.md) | ⚪ Opcional | .ass, filtros ffmpeg e reenquadramento 9:16 |

---

## PASSO 0 - INTAKE (PERGUNTE ANTES DE COMECAR)

> **PARE!** MUST coletar TODOS os dados abaixo antes de qualquer comando. Sem isso, a captura falha ou grava dado sensivel/credencial errada.

MUST perguntar e registrar, ANTES de explorar ou capturar:

1. **Areas e URLs** — A lista de areas e flexivel ("etc"). Pergunte por cada uma:
   - HeroSite / Landing (URL publica)
   - Area do Cliente (URL + URL de login se diferente)
   - Area do Admin (URL + URL de login)
   - **Qualquer outra area** (catalogo, checkout, dashboard, blog...) — pergunte "tem mais alguma area que voce quer mostrar?"
   - Para cada area: uma **descricao curta** do que ela faz (vira base da narracao).
2. **Credenciais de teste por area** — usuario e senha de uma conta de TESTE para cada area logada.
3. **2FA por area** — cada area logada tem autenticacao de dois fatores (codigo de 6 digitos)? **Quase sempre tem** — veja [references/gotchas.md](references/gotchas.md).
4. **Politica de dados sensiveis** — `mostrar`, `desfocar` ou `evitar` (nomes reais de clientes, valores, documentos)?
5. **Pasta de trabalho FORA do repo** — onde gravar binarios, audio e credenciais. NUNCA dentro do repositorio.
6. **Voz e duracoes** — confirmar voz (default masculina `pt-BR-AntonioNeural`) e alvos (YouTube ~3-4min, vertical ~1-2min).

MUST apresentar ao usuario o **bloco PARAMETROS** para preencher antes de comecar. Use o template pronto: [assets/roteiro-template.md](assets/roteiro-template.md).

Exemplos de `config.json` e `scenes.json` prontos: [assets/config.example.json](assets/config.example.json) e [assets/scenes.example.json](assets/scenes.example.json).

---

## FERRAMENTAS

Verifique ANTES de comecar (todas externas ao repo):

| Ferramenta | Verificar | Instalar |
|-----------|-----------|----------|
| **Node 18+** | `node -v` | nodejs.org |
| **Playwright** | dentro de `scripts/`: `npm i` | `npm i playwright && npx playwright install chromium` |
| **edge-tts** | `py -m edge_tts --version` (Windows) ou `edge-tts --version` | `pip install edge-tts` |
| **ffmpeg / ffprobe** | `ffmpeg -version` e `ffprobe -version` | ffmpeg.org (deve estar no PATH) |

> **Windows:** o edge-tts costuma viver em outro Python. MUST usar `py -m edge_tts`. Detalhes em [references/gotchas.md](references/gotchas.md).

---

## PIPELINE

Ordem fixa. TTS roda ANTES da captura — a captura LE `durations.json` para cronometrar cada cena (quanto tempo deixar a interacao rolando). Comandos exatos (`--work <dir>` = a pasta de trabalho fora do repo):

```bash
# 1. EXPLORAR cada area (gera exploration/<seg>.json + .png, detecta 2FA)
node scripts/explore.mjs --work <dir> --seg hero
node scripts/explore.mjs --work <dir> --seg client
node scripts/explore.mjs --work <dir> --seg admin

# 2. ESCREVER scenes.json a partir do exploration (ver secao ROTEIRO abaixo)

# 3. GATE: APRESENTAR o roteiro ao usuario para APROVACAO (nao avance sem "ok")

# 4. GERAR a narracao TTS do master (gera audio/<id>.mp3 + durations.json)
#    voz/rate podem vir do config.json (campos "voz"/"rate"); as flags --voice/--rate sobrescrevem o config.
node scripts/gen_tts.mjs --work <dir> --scenes scenes.json --out audio --voice pt-BR-AntonioNeural --rate=-2%

# 5. CAPTURAR cada segmento (gera video/<seg>.webm + atualiza scene-marks.json)
#    Faz login (Enter na senha) e pede o codigo 2FA na hora via admin_code.txt
node scripts/capture.mjs --work <dir> --seg hero
node scripts/capture.mjs --work <dir> --seg client
node scripts/capture.mjs --work <dir> --seg admin

# 6. COMPOR por segmento (gera subs/<seg>.ass + out/<seg>_final.mp4)
node scripts/compose.mjs --work <dir> --seg hero
node scripts/compose.mjs --work <dir> --seg client
node scripts/compose.mjs --work <dir> --seg admin

# 7. MASTER YouTube (concatena os _final.mp4, aplica ritmo e normaliza audio)
node scripts/compose_final.mjs --work <dir> --speed 1.18

# 8. ESCREVER scenes-short.json (subset short:true, texto condensado) e gerar TTS curto
node scripts/gen_tts.mjs --work <dir> --scenes scenes-short.json --out audio-short --voice pt-BR-AntonioNeural --rate=-2%

# 9. VERTICAL (corta as cenas short de video/<seg>.webm via scene-marks.json, reenquadra 9:16)
node scripts/make_vertical.mjs --work <dir>
```

**Saidas finais:** `out/Video-Demo-YT.mp4` (master) e `out/Video-Demo-Short.mp4` (vertical).

> **GATE de aprovacao (passo 3):** MUST apresentar o roteiro completo (todas as cenas, na ordem) e ESPERAR aprovacao explicita antes de gastar TTS e captura. Mudar texto depois de gravar custa caro.

---

## ROTEIRO

O `scenes.json` e um array ORDENADO. **O texto da cena E a narracao E a legenda** (mesmo texto vira audio TTS e legenda queimada).

**Schema de cada cena:**
```json
{ "id": "01", "seg": "hero", "text": "Narracao desta cena...", "short": true }
```
- `id` — string sequencial `"01"`, `"02"`... (casa com `audio/<id>.mp3` e `durations.json`).
- `seg` — casa com `config.segmentos[].seg` e com `video/<seg>.webm`.
- `text` — frase natural de 6-13s faladas. Curta e clara. Pode ser humanizada com `ring:humanizer-ptbr`.
- `short` — `true` para incluir no vertical.

**Como montar:**
- ~20 cenas no master, cada uma 6-13s. Abertura (hero) → fluxo do cliente → fluxo do admin → **fechamento de marca** (CTA/assinatura).
- O `scenes-short.json` e o **subconjunto com `short:true`**, com texto CONDENSADO para caber em 1-2min. Mantenha so o essencial: abertura curta, 1-2 highlights, fechamento.
- Cada cena deve corresponder a uma acao concreta na tela (navegar, rolar, digitar) — a captura roda o setup, marca `start`, executa a interacao por `durations[id]` segundos, marca `end`.

Esqueleto de plano de cenas: [assets/roteiro-template.md](assets/roteiro-template.md).

---

## 2 ENTREGAVEIS

| Entregavel | Arquivo | Formato | Duracao | Origem |
|-----------|---------|---------|---------|--------|
| **Master YouTube** | `out/Video-Demo-YT.mp4` | 16:9 1920x1080 | ~3-4min | concat dos `<seg>_final.mp4` |
| **Vertical Short/Reels** | `out/Video-Demo-Short.mp4` | 9:16 1080x1920 | ~1-2min | DERIVADO: corta cenas `short` do `.webm`, reenquadra |

O vertical NAO e regravado: ele REAPROVEITA os `.webm` brutos, cortando as cenas `short:true` via `scene-marks.json` e reenquadrando 16:9 para 9:16 com fundo borrado. Detalhes em [references/legendas-e-composicao.md](references/legendas-e-composicao.md).

---

## SEGURANCA

- **Pasta de trabalho FORA do repo.** Binarios (`.webm`, `.mp3`, `.mp4`), `config.json` real e `admin_code.txt` NUNCA entram no repositorio. So templates/exemplos ficam versionados.
- **Credenciais** vivem so no `config.json` da pasta de trabalho. Use sempre contas de TESTE, nunca producao real.
- **`admin_code.txt`** contem o codigo 2FA digitado na hora — efemero, NUNCA commitar.
- **Dados sensiveis** seguem a politica do INTAKE (`mostrar`/`desfocar`/`evitar`). Na duvida, `evitar`.
- **Sem segredos hardcoded** nos scripts. Tudo vem de `config.json` ou flags de CLI.

---

> **Lembre-se:** o erro #1 e resetar `t0` depois do load — isso ADIANTA legenda e audio. Leia [references/sincronia-e-captura.md](references/sincronia-e-captura.md) ANTES de capturar.
