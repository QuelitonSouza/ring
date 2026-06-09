# Legendas e Composicao — Deep Dive

> Formato .ass, filtros ffmpeg da composicao e o reenquadramento 16:9 -> 9:16 do vertical. Opcional, mas util quando algo nao casa.

---

## 1. Formato .ass (caixa translucida + LEAD)

Geramos um `.ass` por segmento (`subs/<seg>.ass`). O `.ass` permite estilo rico (caixa de fundo translucida, contorno, posicao) — melhor que `.srt` para legenda queimada.

**Cabecalho de estilo (master 1920x1080):**

```
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
; BorderStyle=3 => caixa de fundo opaca/translucida atras do texto (BackColour com alpha)
; Alignment=2 => centralizado embaixo. BackColour &H80000000 => preto a ~50% de alpha.
Style: Demo,Arial,52,&H00FFFFFF,&H00000000,&H80000000,1,3,0,0,2,120,120,90,1

[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,0:00:00.00,0:00:08.20,Demo,,0,0,0,,Narracao desta cena aqui
```

- **`start`/`end`** de cada `Dialogue` vem de `scene-marks.json` (offsets relativos ao `.webm` do segmento).
- **LEAD:** opcionalmente adiante a legenda em ~150-250ms (`start - 0.2s`) para ela "entrar" um tiquinho antes da fala — soa mais natural. Nunca a atrase.
- **Texto** = o mesmo `text` da cena no `scenes.json` (narracao == legenda).

---

## 2. Composicao por segmento (compose.mjs)

Para cada segmento: queima a legenda no `.webm` e mixa os audios das cenas daquele segmento, cada um atrasado para seu `start`.

```bash
# Roda DENTRO da pasta de trabalho para o subtitles= usar caminho RELATIVO (gotcha #7).
ffmpeg -y -i video/hero.webm \
  -i audio/01.mp3 -i audio/02.mp3 \
  -filter_complex "\
    [1:a]adelay=0|0[a1]; \
    [2:a]adelay=8200|8200[a2]; \
    [a1][a2]amix=inputs=2:normalize=0[aout]" \
  -map 0:v -map "[aout]" \
  -vf "subtitles=subs/hero.ass" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac \
  out/hero_final.mp4
```

| Filtro | Por que |
|--------|---------|
| `adelay=<ms>|<ms>` | Atrasa o audio de cada cena ate seu `start` (em ms, por canal). Sincroniza fala com a acao |
| `amix=inputs=N:normalize=0` | Junta os audios das cenas sem auto-baixar volume (`normalize=0` evita o ducking do amix) |
| `subtitles=subs/hero.ass` | Queima a legenda. Caminho RELATIVO + `cwd` na pasta = sem inferno de escaping no Windows |

---

## 3. Master final (compose_final.mjs)

Concatena os `<seg>_final.mp4` (concat demuxer), aplica ritmo via `--speed` e normaliza o audio.

```bash
# lista.txt -> file 'out/hero_final.mp4' / file 'out/client_final.mp4' / ...
ffmpeg -y -f concat -safe 0 -i lista.txt \
  -vf "setpts=PTS/1.18,fade=t=in:st=0:d=0.6,fade=t=out:st=END:d=0.8" \
  -af "atempo=1.18,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.4" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -movflags +faststart \
  out/Video-Demo-YT.mp4
```

| Filtro | Por que |
|--------|---------|
| `concat` (demuxer) | Junta os segmentos ja prontos sem re-encode desnecessario na entrada |
| `setpts=PTS/SPEED` + `atempo=SPEED` | Ritmo: aceleram video E audio JUNTOS, mantendo sincronia (gotcha #10). `atempo` aceita 0.5-2.0; para >2 encadeie |
| `loudnorm=I=-16:TP=-1.5:LRA=11` | Loudness padrao de streaming. Resolve o audio mono/desigual do TTS (gotcha #8) |
| `fade in/out` | Abertura e fechamento suaves, look profissional |

---

## 4. Vertical 16:9 -> 9:16 com fundo boxblur (make_vertical.mjs)

O vertical NAO e regravado: para cada cena de `scenes-short.json`, corta o trecho de `video/<seg>.webm` (via `scene-marks.json`), reenquadra para 9:16, queima legenda grande do proprio `scene.text` e muxa o audio condensado de `audio-short/<id>.mp3`.

**Corte por cena:** `-ss <start> -t <clipDur>`, onde `start` vem de `scene-marks.json[seg][id].start` e `clipDur = max(end - start, durations-short[id])`. A narracao short manda no tempo: se o audio for mais longo que a janela marcada, o corte do `.webm` estica para nao truncar a fala.

**Reenquadramento:** o frame 16:9 escala para 1080 de LARGURA e fica centralizado sobre um canvas 1080x1920; o fundo e o PROPRIO frame escalado para COBRIR (boxblur), evitando barras pretas.

**Legenda:** queimada com o filtro `drawtext` (`textfile=`), com o texto vindo de `scenes-short.json` (`scene.text`) e quebrado em linhas de ~24 caracteres (fonte grande, vertical-friendly). NAO usa `.ass` nem pasta `subs-short/`.

```bash
# Por cena: corta o trecho do .webm por start/clipDur, reenquadra e queima legenda.
# clipDur = max(end - start, durations-short[id]); audio = audio-short/<id>.mp3.
ffmpeg -y -ss <start> -t <clipDur> -i video/hero.webm -i audio-short/01.mp3 \
  -filter_complex "\
    [0:v]split=2[fg][bg]; \
    [bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2,setsar=1[bgb]; \
    [fg]scale=1080:-2:force_original_aspect_ratio=decrease,setsar=1[fgs]; \
    [bgb][fgs]overlay=(W-w)/2:(H-h)/2[ov]; \
    [ov]drawtext=textfile='cap-01.txt':fontcolor=white:fontsize=60:line_spacing=10:box=1:boxcolor=black@0.55:boxborderw=24:x=(w-text_w)/2:y=h-text_h-h*0.18,fps=30[vout]; \
    [1:a]loudnorm=I=-16:TP=-1.5:LRA=11[aout]" \
  -map "[vout]" -map "[aout]" -shortest \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac \
  out/_short-tmp/clip-00.mp4
```

| Etapa | Por que |
|-------|---------|
| `-ss <start> -t <clipDur>` | Corta a janela da cena do `.webm`; `clipDur = max(end-start, durations-short[id])` para a fala caber |
| `split=2[fg][bg]` | Mesma fonte vira frente e fundo |
| `[bg]...crop=1080:1920,boxblur` | Fundo: preenche (cover) o canvas vertical e borra. Sem barras pretas, look de Reels |
| `[fg]scale=1080:-2` | Frente: o conteudo real ocupa a largura cheia (1080), centralizado |
| `overlay=(W-w)/2:(H-h)/2` | Centraliza a frente sobre o fundo borrado |
| `drawtext=textfile=` | Legenda grande (fonte 60, caixa `black@0.55`) lida de um `.txt` por cena (texto de `scenes-short.json`, ~24 chars/linha) |
| `[1:a]loudnorm` | Normaliza a narracao short antes de muxar |

Os clipes por cena saem em `out/_short-tmp/` (`clip-NN.mp4`); depois todos sao concatenados (concat demuxer) em `out/Video-Demo-Short.mp4` e a pasta temporaria e removida.

---

> **Regra de ouro do Windows:** sempre que usar `subtitles=`, rode o ffmpeg com `cwd` na pasta de trabalho e passe caminho RELATIVO. Caminho absoluto com `C:\` quebra o parser de filtros.
