# Gotchas — 10 Licoes Que Custam Horas

> Cada item aqui ja queimou horas de alguem. Leia ANTES de comecar. O PORQUE importa mais que o O QUE.

---

## 1. t0 e SAGRADO — nunca resete depois do load

**Sintoma:** legenda e audio aparecem ADIANTADOS, antes da acao acontecer na tela.

**Causa:** `t0` (instante inicial da gravacao) e redefinido depois de cada `page.goto()` / load. Aí o `start = now - t0` de cada cena fica menor do que o tempo real decorrido no `.webm`.

**Regra:** `t0` e definido UMA vez no bootstrap do contexto (antes de qualquer navegacao) e NUNCA mais muda. Todos os offsets de `scene-marks.json` sao `now - t0` relativos a esse unico ponto. Detalhe completo em [sincronia-e-captura.md](sincronia-e-captura.md).

---

## 2. A raiz do app pode ser o catalogo, nao o login

**Sintoma:** voce navega para a URL base esperando a tela de login do cliente e cai num catalogo publico.

**Causa:** muitos sistemas servem a vitrine/catalogo na raiz (`/`) e poem o login do cliente em `/entrar`, `/login` ou `/conta`.

**Regra:** sempre pergunte (e confirme no `explore`) a `loginUrl` real de cada area logada. Nao assuma que `url` == tela de login. No `config.json`, `url` e onde a demo daquela area comeca; `loginUrl` e onde se autentica.

---

## 3. 2FA quase sempre existe — trate com arquivo + poll + retentativa

**Sintoma:** a captura trava na tela de codigo de 6 digitos, ou usa um codigo que ja expirou.

**Causa:** o codigo 2FA chega em tempo real (SMS/app/email) e expira em ~30-60s. Nao da para hardcodar.

**Regra:** a captura faz POLL (~1s) do arquivo `admin_code.txt` — apenas LE, nunca escreve/limpa o arquivo. O usuario digita os 6 digitos nesse arquivo quando o codigo chega. Se o codigo expirar (erro na tela), a captura NAO limpa o arquivo: ela segue o poll IGNORANDO o ultimo codigo ja usado, entao o operador deve digitar um NOVO codigo de 6 digitos no MESMO arquivo (o poll so retorna quando ler um codigo diferente). O `explore` detecta 2FA por `autocomplete="one-time-code"` ou `input[maxlength=6]`. Fluxo em [sincronia-e-captura.md](sincronia-e-captura.md).

---

## 4. edge-tts cai noutro Python — use `py -m edge_tts` no Windows

**Sintoma:** `edge-tts: command not found` ou roda um Python que nao tem o pacote.

**Causa:** no Windows, o `edge-tts` instalado via `pip` frequentemente fica num Python diferente do que esta no PATH, e o launcher `py` resolve a versao certa.

**Regra:** no Windows, invoque `py -m edge_tts ...`. Em Linux/Mac, `edge-tts ...`. O `gen_tts.mjs` detecta a plataforma e escolhe o comando — se um falhar, tenta o outro com mensagem clara (sem catch vazio).

---

## 5. O cursor do SO NAO e gravado — desenhe um cursor falso

**Sintoma:** o video mostra cliques "magicos" sem nenhum ponteiro visivel.

**Causa:** a gravacao de video do Playwright captura o conteudo da pagina, NAO o cursor do sistema operacional.

**Regra:** injete um cursor FALSO (um `<div>` que segue as coordenadas) e um efeito de "ripple" no clique. Assim o espectador acompanha onde a acao acontece. Implementacao em [sincronia-e-captura.md](sincronia-e-captura.md).

---

## 6. Ancoras `#` navegam de verdade — use preventDefault

**Sintoma:** ao "clicar" num link `href="#secao"` para fazer scroll, a pagina pula/recarrega ou o offset de gravacao se quebra.

**Causa:** links com `#` mudam a URL e podem disparar comportamento de navegacao/scroll nativo fora do seu controle.

**Regra:** para demonstrar scroll, role programaticamente (`window.scrollTo` suave) em vez de clicar na ancora; se precisar clicar, faca `preventDefault` no evento. Scroll suave controlado mantem a sincronia previsivel.

---

## 7. `subtitles=` no Windows — use caminho RELATIVO rodando dentro da pasta

**Sintoma:** o filtro `subtitles=` do ffmpeg falha com erro de escaping (os `:` e `\` do path do Windows quebram o parser de filtros).

**Causa:** o filtro `subtitles` interpreta `:` e `\` como separadores/escapes. Caminhos absolutos do Windows (`C:\...`) sao um campo minado de escaping.

**Regra:** rode o ffmpeg COM o `cwd` apontando para a pasta da subtitle e passe so o nome RELATIVO: `subtitles=hero.ass`. Some o escaping ao zero. Detalhe em [legendas-e-composicao.md](legendas-e-composicao.md).

---

## 8. Audio mono do TTS e normal — normalize com loudnorm

**Sintoma:** o audio sai mono e com volume desigual entre cenas; soa "amador".

**Causa:** o edge-tts entrega MP3 mono. Volume varia entre frases. Sem normalizacao, o video oscila de volume.

**Regra:** isso e ESPERADO. No master, aplique `loudnorm=I=-16:TP=-1.5:LRA=11` na mixagem final para padronizar loudness no patamar de streaming. Mono e aceitavel para narracao.

---

## 9. A pasta de trabalho fica FORA do repo

**Sintoma:** binarios pesados, credenciais e codigos 2FA acabam versionados no git.

**Causa:** scripts gravando relativo ao repo por default.

**Regra:** todo script recebe `--work <dir>` (default = diretorio atual, mas o usuario informa uma pasta FORA do repo). `.webm`, `.mp3`, `.mp4`, `config.json` real e `admin_code.txt` vivem la, nunca no repositorio. So templates/exemplos ficam versionados.

---

## 10. Ritmo se ajusta por fator de velocidade, NAO regravando

**Sintoma:** o video ficou lento/arrastado e a tentacao e regravar tudo mais rapido.

**Causa:** regravar e caro e desincroniza tudo de novo.

**Regra:** o ritmo final do master se ajusta com `--speed` no `compose_final.mjs` (ex.: `1.18`), que aplica `setpts` no video e `atempo` no audio juntos, mantendo a sincronia. Grave em ritmo natural e acelere na composicao. Nunca regrave so por causa de ritmo.

---

> **Resumo mental:** t0 fixo, login em `/entrar`, 2FA via arquivo, `py -m edge_tts`, cursor falso, scroll programatico, `subtitles=` relativo, loudnorm, pasta fora do repo, ritmo por speed.
