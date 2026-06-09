# Sincronia e Captura — Deep Dive

> O nucleo tecnico da skill. Sincronia errada = legenda/audio fora do tempo. Leia ANTES de rodar `capture.mjs`.

---

## 1. O protocolo de sincronia (t0 / offset)

A gravacao do Playwright produz um `.webm` cujo tempo 0 e o instante em que a gravacao comeca. Para que legenda e audio de cada cena casem com a acao na tela, precisamos saber, EM SEGUNDOS relativos ao inicio do `.webm`, quando cada cena comeca e termina.

**t0 = instante real do inicio da gravacao.** Definido UMA vez, no bootstrap do contexto, ANTES de qualquer navegacao:

```js
// Bootstrap do contexto: cria a pagina com gravacao de video ligada.
// t0 e capturado AQUI e NUNCA mais e reatribuido.
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
const t0 = Date.now(); // SAGRADO: nao resetar depois de page.goto()
```

> **PORQUE nao resetar:** se voce reatribuir `t0` depois do load, o `start` de cada cena fica MENOR que o tempo real ja decorrido no `.webm`. Resultado: legenda e audio ADIANTADOS. Esse e o bug classico (gotcha #1).

**Para cada cena**, o ciclo e sempre o mesmo:

```js
async function scene(id, setup, during) {
  await setup();                       // navega/rola ate a posicao (NAO conta no tempo da fala)
  const start = (Date.now() - t0) / 1000; // offset relativo ao inicio do .webm
  await during(durations[id]);         // executa a interacao por durations[id] segundos
  const end = (Date.now() - t0) / 1000;
  marks[id] = { start, end };          // grava em scene-marks.json
}
```

- `setup()` — posiciona a tela (navegacao, scroll) ANTES de a fala comecar. Nao entra no tempo da narracao.
- `start` — marcado DEPOIS do setup. E aqui que a legenda e o audio daquela cena comecam.
- `during(segundos)` — roda as interacoes (digitar, rolar, destacar) pelo tempo da narracao daquela cena (`durations[id]`, medido por ffprobe do `audio/<id>.mp3`).
- `end` — fim da cena.

Tudo e gravado em `scene-marks.json`, agrupado por segmento:

```json
{
  "hero":  { "01": { "start": 0.0,  "end": 8.2 }, "02": { "start": 8.2, "end": 15.9 } },
  "client":{ "03": { "start": 0.0,  "end": 7.1 } }
}
```

> Os offsets sao RELATIVOS ao inicio do `.webm` DAQUELE segmento (um contexto por segmento). O `compose.mjs` usa `start` para atrasar (`adelay`) o audio de cada cena; o `make_vertical.mjs` usa `start`/`end` para CORTAR a cena do `.webm`.

---

## 2. Um contexto por segmento

Cada segmento (`hero`, `client`, `admin`) e gravado num contexto Playwright PROPRIO, gerando `video/<seg>.webm` independente. Isso isola login/2FA de cada area e mantem os offsets simples (sempre relativos ao inicio daquele `.webm`).

---

## 3. Cursor falso + ripple

O Playwright NAO grava o cursor do SO (gotcha #5). Injete um cursor falso que segue as coordenadas e um efeito de clique:

```js
// Cursor falso: um ponto que seguimos manualmente, porque o video
// nao captura o ponteiro real do sistema operacional.
await page.addStyleTag({ content: `
  #fakecursor{position:fixed;z-index:2147483647;width:22px;height:22px;
    margin:-11px 0 0 -11px;border-radius:50%;background:rgba(0,0,0,.55);
    border:2px solid #fff;pointer-events:none;transition:left .25s,top .25s}
  .ripple{position:fixed;z-index:2147483646;border:2px solid #fff;border-radius:50%;
    pointer-events:none;animation:rip .5s ease-out forwards}
  @keyframes rip{from{width:0;height:0;opacity:.8}to{width:60px;height:60px;
    margin:-30px 0 0 -30px;opacity:0}}
`});
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'fakecursor'; document.body.appendChild(c);
});

// Mover o cursor falso para (x,y) e disparar ripple ao "clicar".
async function moveCursor(x, y) {
  await page.evaluate(([x, y]) => {
    const c = document.getElementById('fakecursor');
    if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
  }, [x, y]);
}
async function clickAt(x, y) {
  await moveCursor(x, y);
  await page.waitForTimeout(280); // deixa a transicao do cursor terminar
  await page.evaluate(([x, y]) => {
    const r = document.createElement('div'); r.className = 'ripple';
    r.style.left = x + 'px'; r.style.top = y + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 500);
  }, [x, y]);
  await page.mouse.click(x, y);
}
```

---

## 4. Scroll suave (e nao quebrar ancoras)

Demonstre rolagem programaticamente, com easing, em vez de clicar em ancoras `#` (gotcha #6):

```js
// Scroll suave controlado: previsivel para a sincronia, e nao dispara
// a navegacao nativa que uma ancora href="#..." causaria.
async function smoothScroll(toY, ms = 1200) {
  await page.evaluate(([toY, ms]) => new Promise(res => {
    const startY = window.scrollY, dist = toY - startY, t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
      window.scrollTo(0, startY + dist * e);
      if (p < 1) requestAnimationFrame(step); else res();
    })(performance.now());
  }), [toY, ms]);
}
```

---

## 5. Login com Enter na senha (nao no botao do header)

Muitos sites tem um botao "Entrar" no HEADER que abre a tela de login — clicar nele NAO submete o form. Para autenticar de verdade, preencha usuario e senha e pressione **Enter no campo de senha**:

```js
// Login: preenche devagar (parece humano e da tempo da legenda) e
// submete com Enter na senha. NAO clica no "Entrar" do header (esse so abre o login).
await page.fill('input[type=email], input[name=user]', cfg.user);
await page.fill('input[type=password]', cfg.pass, { timeout: 5000 });
await page.press('input[type=password]', 'Enter'); // submete o form de fato
```

> Digite com pequenos delays (`type` com `delay`) durante o `during()` da cena de login, para a acao durar o tempo da narracao e parecer humana.

---

## 6. Fluxo de 2FA por poll de admin_code.txt

A area logada quase sempre pede um codigo de 6 digitos que chega em tempo real (gotcha #3). A captura:

1. **Detecta** o campo 2FA (`input[autocomplete=one-time-code]` ou `input[maxlength=6]`).
2. **Avisa** no console: "Digite o codigo de 6 digitos em `<work>/admin_code.txt` e salve".
3. **Faz POLL** do arquivo (~1s) ate aparecer 6 digitos.
4. **Preenche** e submete.
5. **Re-tentativa:** se a tela acusar codigo invalido/expirado, o script NAO limpa o arquivo — ele continua o poll IGNORANDO o ultimo codigo ja usado. O operador deve digitar um NOVO codigo de 6 digitos no MESMO arquivo; o poll so retorna quando ler um codigo diferente do anterior.

```js
import { readFile } from 'node:fs/promises';

// Poll do arquivo onde o usuario digita o 2FA em tempo real. O script apenas LE
// admin_code.txt; nunca escreve/limpa o arquivo. Ignora o ultimo codigo ja usado
// (`exclude`) para que uma re-tentativa so siga quando o operador digitar um codigo
// NOVO de 6 digitos. O codigo vive ~30-60s, por isso nao da para hardcodar.
async function pollForCode(codePath, { pollMs = 1000, exclude = null } = {}) {
  while (true) {
    const raw = (await readFile(codePath, 'utf8').catch(() => '')).trim();
    const m = raw.match(/\b(\d{6})\b/);
    const code = m ? m[1] : null;
    if (code && code !== exclude) return code; // so aceita um codigo NOVO
    await new Promise(r => setTimeout(r, pollMs));
  }
}

async function submit2FA(page, codePath, maxAttempts = 5) {
  let usedCode = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Poll ignorando o codigo ja usado: aguarda o operador digitar um NOVO.
    const code = await pollForCode(codePath, { exclude: usedCode });
    usedCode = code;
    await page.fill('input[autocomplete=one-time-code], input[maxlength="6"]', code);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    const invalid = await page.locator('text=/inv[aá]lido|expirad|incorret/i').count();
    if (invalid === 0) return; // passou
    // Codigo recusado: NAO limpamos o arquivo. Pedimos um NOVO codigo e seguimos
    // o poll ignorando este (`usedCode`), ate o operador digitar um diferente.
    console.log(`>> Codigo recusado (tentativa ${attempt}). Digite um NOVO codigo em ${codePath}...`);
  }
  throw new Error(`2FA falhou apos ${maxAttempts} tentativas`);
}
```

> **Tratamento de erro real:** nada de catch vazio. Esgotar as tentativas lanca erro com mensagem clara, para o operador saber o que aconteceu.

---

> **Checklist antes de capturar:** t0 fixo no bootstrap? cursor falso injetado? login submete com Enter? `wait2FA` apontando para `<work>/admin_code.txt`? `scene-marks.json` recebendo `start`/`end` relativos ao `.webm`?
