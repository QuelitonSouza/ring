// lib.mjs
// Biblioteca compartilhada da skill ring:video-demo-narrado (lado de CAPTURA).
// Importada por explore.mjs e capture.mjs.
//
// Responsabilidades:
//   - Subir um contexto do Playwright (chromium) com gravacao de video opcional.
//   - Injetar um CURSOR FALSO + ripple de clique (o cursor do SO NAO e capturado
//     no recordVideo, entao desenhamos o nosso para a demo ficar legivel).
//   - Scroll suave por requestAnimationFrame (nada de "pulo" instantaneo).
//   - Login digitando no ritmo humano e dando Enter NO CAMPO DE SENHA
//     (nunca clicar no "Entrar" do header, que pode ser outro fluxo/link).
//   - 2FA: detectar o campo OTP e fazer POLL de admin_code.txt, com re-tentativa.
//   - scene(): implementa o PROTOCOLO DE SINCRONIA (t0 fixo, start/end relativos
//     ao inicio do .webm) e persiste scene-marks.json incrementalmente.
//   - Utilitarios: parser de args, leitura/escrita de JSON.
//
// Regra de ouro da sincronia (NAO QUEBRAR):
//   t0 = instante REAL em que a gravacao comeca. Definido UMA vez no bootstrap do
//   contexto e NUNCA resetado depois do load. Para cada cena marcamos
//   start = now - t0 e end = now - t0. Resetar t0 apos o load ADIANTA legenda/audio.

import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Utilitarios de tempo
// ---------------------------------------------------------------------------

/** Pausa assincrona simples. Usada para ritmo humano e poll. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Parser de argumentos de linha de comando
// ---------------------------------------------------------------------------

/**
 * Parser minimalista de --flag valor e --flag=valor.
 * Flags sem valor explicito viram boolean true (ex.: --headed).
 * O contrato exige default de --work = diretorio atual (process.cwd()).
 *
 * @param {string[]} argv normalmente process.argv.slice(2)
 * @returns {Record<string, string|boolean>}
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    // Suporta a forma --flag=valor (necessaria p/ valores que comecam com "-",
    // ex.: --rate=-2%, senao o "-2%" seria interpretado como outra flag).
    const eq = token.indexOf('=');
    if (eq !== -1) {
      const key = token.slice(2, eq);
      args[key] = token.slice(eq + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    // Se o proximo token existe e nao e outra flag, ele e o valor.
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/**
 * Resolve a pasta de trabalho a partir dos args.
 * Contrato: --work <dir>, default = diretorio atual.
 * A pasta de trabalho fica FORA do repositorio; nunca gravamos binarios no repo.
 */
export function resolveWork(args) {
  const work = typeof args.work === 'string' && args.work.length > 0
    ? args.work
    : process.cwd();
  return path.resolve(work);
}

// ---------------------------------------------------------------------------
// Helpers de JSON (leitura/escrita)
// ---------------------------------------------------------------------------

/** Le e parseia um JSON. Lanca erro com contexto se o arquivo for invalido. */
export async function readJson(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Nao foi possivel ler JSON em ${filePath}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON invalido em ${filePath}: ${err.message}`);
  }
}

/** Le um JSON; se o arquivo nao existir, retorna o fallback (sem estourar). */
export async function readJsonIfExists(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // ENOENT = arquivo ainda nao criado; e legitimo (ex.: scene-marks.json
    // na primeira cena). Qualquer outro erro de IO/parse deve propagar.
    if (err.code === 'ENOENT') return fallback;
    throw new Error(`Falha ao ler ${filePath}: ${err.message}`);
  }
}

/** Escreve JSON formatado, criando a pasta pai se necessario. */
export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Garante que uma pasta exista (recursivo). */
export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Snippet injetado: cursor falso + ripple de clique
// ---------------------------------------------------------------------------

// IMPORTANTE: addInitScript roda ANTES de cada navegacao/documento. Por isso o
// codigo precisa ser idempotente (checar se ja existe) e tolerante a paginas
// onde document.body ainda nao montou. Expomos funcoes em window.__ringCursor
// para que o lado Node (page.evaluate) possa mover o cursor e disparar ripple.
const CURSOR_INIT_SCRIPT = `
(() => {
  if (window.__ringCursorInstalled) return;
  window.__ringCursorInstalled = true;

  const install = () => {
    if (!document.body) return;
    if (document.getElementById('__ring_cursor')) return;

    // Cursor falso (o cursor real do SO nao aparece no recordVideo).
    // Desenhado 100% em CSS (triangulo via bordas) para evitar SVG data-uri e
    // o inferno de escaping de aspas/'//' dentro de string injetada via
    // addInitScript. O elemento e so o ponto de ancora; a "seta" e o ::before
    // injetado por uma classe de estilo abaixo.
    const cur = document.createElement('div');
    cur.id = '__ring_cursor';
    cur.style.cssText = [
      'position:fixed', 'left:-100px', 'top:-100px',
      'width:0', 'height:0',
      'z-index:2147483647', 'pointer-events:none',
      'transition:left .04s linear, top .04s linear',
      // Triangulo apontando para cima-esquerda usando bordas (preto c/ contorno).
      'border-style:solid',
      'border-width:0 9px 16px 0',
      'border-color:transparent black transparent transparent',
      'filter:drop-shadow(1px 1px 0 white) drop-shadow(-1px -1px 0 white)',
      'transform:rotate(-45deg)',
      'transform-origin:0 0',
    ].join(';');
    document.body.appendChild(cur);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    window.__ringCursor = {
      // Posiciona instantaneamente (a transicao CSS suaviza pequenos passos).
      set(nx, ny) {
        x = nx; y = ny;
        cur.style.left = nx + 'px';
        cur.style.top = ny + 'px';
      },
      get() { return { x, y }; },
      // Ripple visual no clique para a demo deixar claro "onde clicou".
      ripple(rx, ry) {
        const r = document.createElement('div');
        r.style.cssText = [
          'position:fixed', 'left:' + rx + 'px', 'top:' + ry + 'px',
          'width:8px', 'height:8px', 'margin:-4px 0 0 -4px',
          'border-radius:50%', 'background:rgba(33,150,243,.55)',
          'z-index:2147483646', 'pointer-events:none',
          'transform:scale(1)', 'opacity:1',
          'transition:transform .45s ease-out, opacity .45s ease-out',
        ].join(';');
        document.body.appendChild(r);
        // Forca reflow antes de animar para a transicao disparar de fato.
        void r.offsetWidth;
        r.style.transform = 'scale(6)';
        r.style.opacity = '0';
        setTimeout(() => r.remove(), 500);
      },
    };
  };

  // O body pode nao existir ainda quando o init script roda.
  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
})();
`;

// ---------------------------------------------------------------------------
// Bootstrap do contexto Playwright
// ---------------------------------------------------------------------------

/**
 * Sobe um contexto chromium. Quando record=true, grava video no tamanho dims
 * dentro de <work>/video. t0 e fixado no instante em que abrimos a primeira
 * pagina (= inicio efetivo da gravacao) e NUNCA mais e alterado.
 *
 * Retorna { browser, context, page, t0, dims, work, viewport }.
 *   - now(): helper que devolve segundos decorridos desde t0.
 *
 * @param {object} opts
 * @param {string} opts.work pasta de trabalho (fora do repo)
 * @param {[number, number]} opts.dims [largura, altura] do video/viewport
 * @param {boolean} opts.record liga a gravacao de video
 * @param {boolean} [opts.headed] roda com janela visivel (debug)
 */
export async function launchContext({ work, dims, record = false, headed = false }) {
  const [width, height] = dims;
  const videoDir = path.join(work, 'video');

  if (record) {
    // O Playwright nomeia o .webm com um hash; renomeamos depois em
    // finalizeRecording(). Garantimos a pasta antes para o flush funcionar.
    await ensureDir(videoDir);
  }

  // headless por padrao para gravacao limpa e reproduzivel em CI/maquina do dev.
  const browser = await chromium.launch({ headless: !headed });

  const contextOptions = {
    viewport: { width, height },
    // deviceScaleFactor 1 mantem pixel-perfect com o tamanho do video.
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  };
  if (record) {
    contextOptions.recordVideo = { dir: videoDir, size: { width, height } };
  }

  const context = await browser.newContext(contextOptions);

  // Cursor falso disponivel em TODAS as paginas/navegacoes deste contexto.
  await context.addInitScript(CURSOR_INIT_SCRIPT);

  // Abrir a pagina e o instante em que a gravacao efetivamente comeca.
  // t0 e capturado AQUI e nunca mais resetado (regra de sincronia).
  const page = await context.newPage();
  const t0 = Date.now();

  const handle = {
    browser,
    context,
    page,
    t0,
    dims: { width, height },
    viewport: { width, height },
    work,
    record,
    /** Segundos (float) decorridos desde t0. Base de start/end das cenas. */
    now() {
      return (Date.now() - t0) / 1000;
    },
  };

  return handle;
}

/**
 * Fecha o contexto (necessario para o Playwright FLUSHAR o .webm em disco) e
 * renomeia o arquivo gerado para video/<seg>.webm conforme o contrato.
 *
 * @param {object} handle retorno de launchContext
 * @param {string} seg identificador do segmento (nome final do .webm)
 * @returns {Promise<string|null>} caminho final do .webm ou null se sem gravacao
 */
export async function finalizeRecording(handle, seg) {
  const { context, browser, page, work, record } = handle;

  let producedPath = null;
  if (record) {
    // video() so resolve o caminho depois do close; pegamos a referencia antes.
    const video = page.video();
    // Fechar o contexto for o flush do video para o disco.
    await context.close();
    await browser.close();

    if (video) {
      const tmpPath = await video.path();
      const finalPath = path.join(work, 'video', `${seg}.webm`);
      // Remove um arquivo final antigo (re-captura do mesmo segmento).
      try {
        await fs.rm(finalPath, { force: true });
      } catch (err) {
        throw new Error(`Falha ao remover .webm antigo ${finalPath}: ${err.message}`);
      }
      await fs.rename(tmpPath, finalPath);
      producedPath = finalPath;
    }
  } else {
    await context.close();
    await browser.close();
  }

  return producedPath;
}

// ---------------------------------------------------------------------------
// Cursor: mover suave ate um elemento + clicar com ripple
// ---------------------------------------------------------------------------

/**
 * Move o cursor FALSO suavemente ate o centro do elemento (varios passos),
 * sincronizando tambem o mouse REAL do Playwright (para hover/estados :hover).
 * Faz o cursor parecer humano em vez de teleportar.
 */
export async function moveCursorTo(page, locator) {
  let box;
  try {
    box = await locator.boundingBox();
  } catch {
    box = null;
  }
  if (!box) {
    // Sem caixa visivel: nada para mover. Quem chama decide se isso e fatal.
    return false;
  }

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  // Ponto de partida = posicao atual do cursor falso (ou centro da viewport).
  const start = await page.evaluate(() => {
    const c = window.__ringCursor;
    return c ? c.get() : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  });

  const steps = 18; // passos suficientes para suavidade sem demorar.
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    // Ease-in-out simples para acelerar/desacelerar o movimento.
    const ease = f < 0.5 ? 2 * f * f : -1 + (4 - 2 * f) * f;
    const nx = start.x + (targetX - start.x) * ease;
    const ny = start.y + (targetY - start.y) * ease;
    await page.evaluate(([x, y]) => window.__ringCursor?.set(x, y), [nx, ny]);
    await page.mouse.move(nx, ny);
    await sleep(16); // ~60fps de atualizacao.
  }
  return true;
}

/**
 * Move o cursor ate o elemento, dispara o ripple e clica de fato.
 * Robusto: se o elemento nao tiver caixa, faz click direto via locator.
 */
export async function clickWithCursor(page, locator) {
  const moved = await moveCursorTo(page, locator);
  if (moved) {
    const pos = await page.evaluate(() =>
      window.__ringCursor ? window.__ringCursor.get() : null
    );
    if (pos) {
      await page.evaluate(([x, y]) => window.__ringCursor?.ripple(x, y), [pos.x, pos.y]);
    }
  }
  await locator.click({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Scroll suave (requestAnimationFrame)
// ---------------------------------------------------------------------------

/**
 * Faz scroll SUAVE ate um seletor (rola o elemento para o centro) ou ate uma
 * coordenada Y absoluta. Usa requestAnimationFrame no lado da pagina para uma
 * animacao continua (nada de scrollIntoView instantaneo, que "pula" a tela).
 *
 * Para ancoras "#..." prevenimos o comportamento padrao do browser que faria
 * um jump abrupto antes da nossa animacao.
 *
 * @param {import('playwright').Page} page
 * @param {string|number} selectorOrY seletor CSS, ancora "#id" ou numero (Y)
 * @param {object} [opts]
 * @param {number} [opts.duration=900] duracao da animacao em ms
 */
export async function smoothScrollTo(page, selectorOrY, opts = {}) {
  const duration = opts.duration ?? 900;

  await page.evaluate(
    async ({ target, duration }) => {
      const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

      // Descobre o Y de destino.
      let destY;
      if (typeof target === 'number') {
        destY = target;
      } else {
        // Ancoras "#..." podem disparar jump nativo; neutralizamos buscando
        // o elemento por id e calculando o offset manualmente.
        const sel = String(target);
        let el = null;
        if (sel.startsWith('#')) {
          el = document.getElementById(sel.slice(1)) || document.querySelector(sel);
        } else {
          el = document.querySelector(sel);
        }
        if (!el) {
          // Sem elemento: nao rola (quem chamou trata como aviso, nao erro).
          return false;
        }
        const rect = el.getBoundingClientRect();
        const current = window.pageYOffset || document.documentElement.scrollTop;
        // Centraliza o elemento na viewport quando possivel.
        destY = current + rect.top - (window.innerHeight - rect.height) / 2;
      }

      const startY = window.pageYOffset || document.documentElement.scrollTop;
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      destY = Math.max(0, Math.min(destY, maxY));

      const distance = destY - startY;
      if (Math.abs(distance) < 2) return true; // ja esta la.

      await new Promise((resolve) => {
        const startTime = performance.now();
        const tick = (nowTs) => {
          const elapsed = nowTs - startTime;
          const t = Math.min(1, elapsed / duration);
          window.scrollTo(0, startY + distance * ease(t));
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return true;
    },
    { target: selectorOrY, duration }
  );

  // Pequena pausa apos a animacao para a tela "assentar" antes da proxima acao.
  await sleep(120);
}

// ---------------------------------------------------------------------------
// Digitacao em ritmo humano
// ---------------------------------------------------------------------------

/**
 * Digita texto caractere a caractere com pequena variacao de tempo, para a
 * gravacao parecer humana (e nao um paste instantaneo).
 */
export async function typeHuman(locator, text, opts = {}) {
  const base = opts.delay ?? 70;
  await locator.click();
  for (const ch of text) {
    // Variacao leve (+-20ms) evita cadencia robotica.
    const jitter = Math.round((Math.random() - 0.5) * 40);
    await locator.type(ch, { delay: 0 });
    await sleep(Math.max(20, base + jitter));
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Faz login digitando usuario e senha no ritmo humano e dando Enter NO CAMPO
 * DE SENHA. NUNCA clicamos no "Entrar" do header: em muitos sistemas esse
 * botao do topo e um link para outra rota e quebraria o fluxo. Enter na senha
 * submete o form de forma confiavel.
 *
 * Localiza os campos por heuristica robusta (type/name/autocomplete/placeholder)
 * lendo o DOM vivo, em vez de chutar seletores fixos.
 *
 * @returns {Promise<boolean>} true se conseguiu submeter o login
 */
export async function login(page, { loginUrl, user, pass }) {
  if (loginUrl) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  }

  // Campo de usuario: aceita email, text, name/autocomplete tipicos.
  const userField = page
    .locator(
      [
        'input[type="email"]',
        'input[autocomplete="username"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[name="user"]',
        'input[id="email"]',
        'input[id="username"]',
        'input[type="text"]',
      ].join(', ')
    )
    .first();

  // Campo de senha: type=password e o sinal mais confiavel.
  const passField = page
    .locator('input[type="password"], input[autocomplete="current-password"]')
    .first();

  try {
    await userField.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    throw new Error(
      'Login: campo de usuario nao encontrado. Verifique loginUrl/seletores no exploration/<seg>.json.'
    );
  }

  await typeHuman(userField, user);

  try {
    await passField.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    throw new Error('Login: campo de senha (input[type=password]) nao encontrado.');
  }

  await typeHuman(passField, pass);

  // Enter NO CAMPO DE SENHA submete o form (e nao o "Entrar" do header).
  await passField.press('Enter');

  // Aguarda navegacao OU sumico do campo de senha (SPA que troca a tela).
  try {
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: 15_000 }),
      passField.waitFor({ state: 'detached', timeout: 15_000 }),
    ]);
  } catch {
    // Nao e necessariamente falha: pode haver 2FA na mesma tela. Seguimos.
  }

  return true;
}

// ---------------------------------------------------------------------------
// 2FA (OTP) via poll de admin_code.txt
// ---------------------------------------------------------------------------

/**
 * Detecta o campo OTP (one-time-code) na pagina atual.
 * Sinais aceitos (mesma heuristica do explore.has2FA):
 *   - autocomplete="one-time-code"
 *   - input com maxlength=6 (codigo de 6 digitos)
 *   - inputmode numerico + nome/placeholder sugestivo
 *
 * @returns {Promise<import('playwright').Locator|null>}
 */
export async function detectOtpField(page) {
  const candidates = page.locator(
    [
      'input[autocomplete="one-time-code"]',
      'input[name*="otp" i]',
      'input[name*="code" i]',
      'input[name*="token" i]',
      'input[placeholder*="codigo" i]',
      'input[placeholder*="code" i]',
      'input[maxlength="6"]',
    ].join(', ')
  );

  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    if (await el.isVisible().catch(() => false)) {
      return el;
    }
  }
  return null;
}

/**
 * Aguarda o 2FA: detecta o campo OTP, faz POLL de <work>/admin_code.txt a cada
 * ~1s ate aparecer um codigo de 6 digitos, digita e submete. Se o codigo for
 * REJEITADO/EXPIRAR (campo OTP continua visivel), LIMPA o campo, instrui o
 * usuario a digitar um novo codigo no arquivo e RE-TENTA.
 *
 * Fluxo do usuario: durante a captura, o usuario digita o codigo recebido no
 * arquivo <work>/admin_code.txt; este metodo le esse arquivo.
 *
 * @param {object} opts
 * @param {string} opts.work pasta de trabalho (onde fica admin_code.txt)
 * @param {number} [opts.pollMs=1000] intervalo de poll
 * @param {number} [opts.maxAttempts=5] tentativas de codigo distintas
 * @returns {Promise<boolean>} true se passou no 2FA, false se nao havia 2FA
 */
export async function await2FA(page, { work, pollMs = 1000, maxAttempts = 5 }) {
  let otpField = await detectOtpField(page);
  if (!otpField) {
    // Sem campo OTP visivel = segmento sem 2FA real nesta tela. Nada a fazer.
    return false;
  }

  const codePath = path.join(work, 'admin_code.txt');
  console.log(
    `[2FA] Aguardando codigo de 6 digitos em: ${codePath}\n` +
      '      Digite o codigo recebido nesse arquivo e salve.'
  );

  let usedCode = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 1) Poll do arquivo ate obter um codigo NOVO de 6 digitos.
    const code = await pollForCode(codePath, { pollMs, exclude: usedCode });
    usedCode = code;
    console.log(`[2FA] Tentativa ${attempt}/${maxAttempts} com codigo lido do arquivo.`);

    // 2) Re-detecta o campo (a tela pode ter re-renderizado entre tentativas).
    otpField = (await detectOtpField(page)) ?? otpField;

    // 3) Limpa e digita o codigo. Alguns campos exigem fill antes de type.
    try {
      await otpField.click();
      await otpField.fill('');
      await typeHuman(otpField, code, { delay: 90 });
    } catch (err) {
      console.warn(`[2FA] Falha ao preencher campo OTP: ${err.message}. Re-tentando.`);
      continue;
    }

    // 4) Submete: muitos formularios auto-submetem no 6o digito; reforcamos com
    //    Enter no proprio campo (mesma logica do login: nunca botao de header).
    await otpField.press('Enter').catch(() => {});

    // 5) Verifica se o 2FA passou: o campo OTP deve sumir / virar invisivel.
    const passed = await waitOtpResolved(page, otpField, 10_000);
    if (passed) {
      console.log('[2FA] Codigo aceito.');
      return true;
    }

    console.warn(
      `[2FA] Codigo parece rejeitado/expirado (campo ainda visivel). ` +
        `Digite um NOVO codigo em ${codePath} (tentativa ${attempt + 1}).`
    );
  }

  throw new Error(
    `2FA: esgotadas ${maxAttempts} tentativas. ` +
      'Verifique se o codigo digitado em admin_code.txt esta correto/valido.'
  );
}

/**
 * Le admin_code.txt em loop ate encontrar 6 digitos. Ignora codigo igual ao
 * "exclude" (codigo ja usado/rejeitado), forcando o usuario a inserir um novo.
 */
async function pollForCode(codePath, { pollMs, exclude }) {
  // Aguardo defensivo para nao "girar" o CPU caso o arquivo nunca apareca.
  // O loop so termina quando ha um codigo de 6 digitos diferente do exclude.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let content = '';
    try {
      content = await fs.readFile(codePath, 'utf8');
    } catch (err) {
      // ENOENT: arquivo ainda nao criado pelo usuario. Continua aguardando.
      if (err.code !== 'ENOENT') {
        throw new Error(`Falha ao ler ${codePath}: ${err.message}`);
      }
    }

    // Extrai exatamente 6 digitos (ignora espacos/quebras de linha).
    const match = content.match(/\b(\d{6})\b/) || content.match(/(\d{6})/);
    const code = match ? match[1] : null;

    if (code && code !== exclude) {
      return code;
    }

    await sleep(pollMs);
  }
}

/**
 * Considera o OTP resolvido quando o campo some/fica invisivel dentro do prazo.
 * Se continuar visivel, o codigo foi rejeitado (re-tentamos).
 */
async function waitOtpResolved(page, otpField, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stillVisible = await otpField.isVisible().catch(() => false);
    if (!stillVisible) return true;
    // Reconfirma se um NOVO campo OTP aparece (erro inline mantem a tela).
    await sleep(400);
  }
  // Ultimo cheque: talvez tenha trocado de campo mas ainda haja OTP na tela.
  const anotherOtp = await detectOtpField(page);
  return anotherOtp === null;
}

// ---------------------------------------------------------------------------
// scene(): protocolo de sincronia
// ---------------------------------------------------------------------------

/**
 * Executa UMA cena seguindo o PROTOCOLO DE SINCRONIA e grava os offsets em
 * scene-marks.json (incremental, sem sobrescrever outros segmentos):
 *
 *   1) setup()  -> navegacao/scroll ate a posicao (NAO conta no tempo da cena).
 *   2) start = handle.now()  (segundos relativos a t0 = inicio do .webm).
 *   3) during() roda EM PARALELO enquanto esperamos durations[id] segundos,
 *      para o clipe gravado ter a MESMA duracao da narracao.
 *   4) end = handle.now().
 *   5) persiste scene-marks.json[seg][id] = { start, end }.
 *
 * Por que t0 nao e resetado: legenda e audio da cena comecam em "start". Se
 * resetassemos t0 apos o load, os offsets ficariam menores que o real e
 * legenda/audio apareceriam ADIANTADOS. t0 fica fixo desde launchContext().
 *
 * @param {object} args
 * @param {object} args.handle retorno de launchContext (tem t0, now(), work)
 * @param {string} args.seg identificador do segmento
 * @param {string} args.id id da cena ("01", "02", ...)
 * @param {Record<string, number>} args.durations mapa id -> segundos (durations.json)
 * @param {() => Promise<void>} [args.setup] posicionamento antes de marcar start
 * @param {() => Promise<void>} [args.during] interacoes durante a janela da cena
 */
export async function scene({ handle, seg, id, durations, setup, during }) {
  const { work } = handle;

  // 1) Setup fora da janela cronometrada (posicionar a tela).
  if (setup) {
    try {
      await setup();
    } catch (err) {
      // Setup que falha nao deve derrubar a captura inteira: logamos e seguimos
      // para nao perder os segmentos/cenas ja gravados.
      console.warn(`[scene ${seg}/${id}] setup falhou: ${err.message}`);
    }
  }

  // Duracao alvo da cena = duracao do audio medido (durations.json).
  // Fallback de 4s evita cena de duracao zero se faltar a medicao.
  const targetSec = Number.isFinite(durations?.[id]) ? durations[id] : 4;
  const targetMs = Math.max(500, Math.round(targetSec * 1000));

  // 2) Marca de inicio relativa a t0.
  const start = handle.now();

  // 3) during() concorrente com a espera da duracao da narracao.
  //    A cena dura SEMPRE >= targetMs (sincroniza clipe com audio); se during()
  //    terminar antes, esperamos o restante; se durar mais, respeitamos o maior.
  const waitPromise = sleep(targetMs);
  let duringErr = null;
  const duringPromise = during
    ? Promise.resolve()
        .then(during)
        .catch((err) => {
          // Erro de interacao (seletor ausente etc.) nao aborta a cena: a tela
          // continua sendo gravada pelo tempo da narracao. Reportamos no log.
          duringErr = err;
        })
    : Promise.resolve();

  await Promise.all([waitPromise, duringPromise]);

  if (duringErr) {
    console.warn(`[scene ${seg}/${id}] during falhou (cena gravada mesmo assim): ${duringErr.message}`);
  }

  // 4) Marca de fim relativa a t0.
  const end = handle.now();

  // 5) Persistencia incremental de scene-marks.json (read-modify-write).
  //    Lemos o arquivo atual para NAO apagar marcas de outros segmentos.
  const marksPath = path.join(work, 'scene-marks.json');
  const marks = (await readJsonIfExists(marksPath, {})) ?? {};
  if (!marks[seg]) marks[seg] = {};
  marks[seg][id] = { start, end };
  await writeJson(marksPath, marks);

  console.log(
    `[scene ${seg}/${id}] start=${start.toFixed(2)}s end=${end.toFixed(2)}s ` +
      `(alvo=${targetSec.toFixed(2)}s)`
  );

  return { start, end };
}

// ---------------------------------------------------------------------------
// Helper de seletor estavel (usado por explore.mjs)
// ---------------------------------------------------------------------------

/**
 * Gera um seletor CSS razoavelmente ESTAVEL para um elemento, preferindo, nesta
 * ordem: #id, [data-testid], [name], [aria-label], depois tag + nth filtrado
 * por texto. Roda no contexto da pagina (page.evaluate).
 *
 * Retornado dentro do dump de explore para o orquestrador montar scenes.json
 * sem precisar adivinhar seletores.
 */
export const STABLE_SELECTOR_FN = `
(el) => {
  if (!el) return null;
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'));
  if (el.id) return '#' + esc(el.id);
  if (el.getAttribute('data-testid')) return '[data-testid=\"' + el.getAttribute('data-testid') + '\"]';
  const name = el.getAttribute('name');
  if (name) return el.tagName.toLowerCase() + '[name=\"' + name + '\"]';
  const aria = el.getAttribute('aria-label');
  if (aria) return el.tagName.toLowerCase() + '[aria-label=\"' + aria + '\"]';
  // Fallback: tag + indice entre irmaos do mesmo tipo.
  const tag = el.tagName.toLowerCase();
  const sameTag = Array.from(document.querySelectorAll(tag));
  const idx = sameTag.indexOf(el);
  return idx >= 0 ? tag + ':nth-of-type-global(' + idx + ')' : tag;
}
`;
