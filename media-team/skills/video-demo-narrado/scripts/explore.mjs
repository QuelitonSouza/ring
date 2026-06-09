// explore.mjs
// CLI: node scripts/explore.mjs --work <dir> --seg <seg>
//
// Objetivo: abrir a pagina do segmento <seg> (logando antes, se o segmento tiver
// credenciais) e DESPEJAR a estrutura real do DOM (nav, botoes, headings) com um
// seletor estavel para cada item, alem de detectar 2FA. A saida e o insumo que o
// orquestrador usa para escrever scenes.json SEM adivinhar seletores.
//
// Saidas (contrato):
//   exploration/<seg>.json  -> { seg, url, title, has2FA, nav[], buttons[], headings[], links[] }
//   exploration/<seg>.png   -> screenshot full page
//
// NUNCA chutamos seletores: tudo e lido do DOM vivo (page.evaluate).
//
// Importante: aqui NAO gravamos video (record=false). Exploracao e so leitura.

import path from 'node:path';
import {
  parseArgs,
  resolveWork,
  readJson,
  writeJson,
  ensureDir,
  launchContext,
  finalizeRecording,
  login,
  detectOtpField,
} from './lib.mjs';

async function main() {
  const args = parseArgs();
  const work = resolveWork(args);
  const seg = typeof args.seg === 'string' ? args.seg : null;

  if (!seg) {
    console.error('Uso: node scripts/explore.mjs --work <dir> --seg <seg>');
    process.exit(2);
  }

  // config.json e a fonte de verdade dos segmentos (url, login, dimensoes).
  const configPath = path.join(work, 'config.json');
  const config = await readJson(configPath);

  const segCfg = (config.segmentos || []).find((s) => s.seg === seg);
  if (!segCfg) {
    console.error(
      `Segmento "${seg}" nao encontrado em config.json (segmentos[].seg).`
    );
    process.exit(2);
  }

  // Dimensoes do master para explorar no mesmo viewport que sera gravado.
  const dims = (config.dimensoes && config.dimensoes.master) || [1920, 1080];

  const handle = await launchContext({ work, dims, record: false, headed: !!args.headed });
  const { page } = handle;

  try {
    // 1) Login quando o segmento exigir (Enter na senha, nunca botao de header).
    if (segCfg.user && segCfg.pass) {
      console.log(`[explore ${seg}] Fazendo login...`);
      await login(page, {
        loginUrl: segCfg.loginUrl,
        user: segCfg.user,
        pass: segCfg.pass,
      });
      // NAO resolvemos 2FA aqui: exploracao so PRECISA detectar a presenca.
    }

    // 2) Navega para a URL do segmento (apos o login, se houve).
    if (segCfg.url) {
      await page.goto(segCfg.url, { waitUntil: 'domcontentloaded' });
    }
    // Espera curta para SPAs montarem o conteudo principal.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // 3) Detecta 2FA de duas formas independentes:
    //    (a) sinal declarado no config (twofa) e
    //    (b) presenca real de campo OTP no DOM (autocomplete=one-time-code
    //        ou input maxlength=6) -- mesma heuristica usada na captura.
    const otpField = await detectOtpField(page);
    const has2FA = Boolean(segCfg.twofa) || otpField !== null;

    // 4) Dump estruturado do DOM com seletores estaveis (lido ao vivo).
    const dump = await page.evaluate(() => {
      // --- seletor estavel inline (mesma logica de STABLE_SELECTOR_FN) ---
      const esc = (s) =>
        window.CSS && CSS.escape
          ? CSS.escape(s)
          : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

      const stableSelector = (el) => {
        if (!el) return null;
        if (el.id) return '#' + esc(el.id);
        const testid = el.getAttribute('data-testid');
        if (testid) return '[data-testid="' + testid + '"]';
        const name = el.getAttribute('name');
        if (name) return el.tagName.toLowerCase() + '[name="' + name + '"]';
        const aria = el.getAttribute('aria-label');
        if (aria) return el.tagName.toLowerCase() + '[aria-label="' + aria + '"]';
        // Fallback: caminho curto com nth-of-type (estavel o suficiente p/ demo).
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1 && parts.length < 4) {
          let part = node.tagName.toLowerCase();
          if (node.parentElement) {
            const siblings = Array.from(node.parentElement.children).filter(
              (c) => c.tagName === node.tagName
            );
            if (siblings.length > 1) {
              part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
            }
          }
          parts.unshift(part);
          node = node.parentElement;
        }
        return parts.join(' > ');
      };

      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          st.visibility !== 'hidden' &&
          st.display !== 'none'
        );
      };

      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

      // NAV: links dentro de <nav>/[role=navigation] ou headers de menu.
      const navEls = Array.from(
        document.querySelectorAll('nav a, [role="navigation"] a, header a')
      ).filter(visible);
      const nav = navEls.slice(0, 40).map((a) => ({
        text: clean(a.textContent),
        href: a.getAttribute('href') || null,
        selector: stableSelector(a),
      }));

      // BUTTONS: <button>, input[type=submit/button], [role=button].
      const btnEls = Array.from(
        document.querySelectorAll(
          'button, input[type="submit"], input[type="button"], [role="button"]'
        )
      ).filter(visible);
      const buttons = btnEls.slice(0, 60).map((b) => ({
        text: clean(b.textContent || b.value),
        selector: stableSelector(b),
      }));

      // HEADINGS: h1..h4 visiveis (estrutura semantica da pagina).
      const headEls = Array.from(
        document.querySelectorAll('h1, h2, h3, h4')
      ).filter(visible);
      const headings = headEls.slice(0, 60).map((h) => ({
        level: h.tagName.toLowerCase(),
        text: clean(h.textContent),
        selector: stableSelector(h),
      }));

      // LINKS gerais relevantes (com texto), fora da nav, para ancoras de cena.
      const linkEls = Array.from(document.querySelectorAll('a[href]')).filter(
        (a) => visible(a) && clean(a.textContent).length > 0
      );
      const links = linkEls.slice(0, 60).map((a) => ({
        text: clean(a.textContent),
        href: a.getAttribute('href'),
        selector: stableSelector(a),
      }));

      // Sinais de OTP detectados no DOM (uteis para o orquestrador validar 2FA).
      const otpSignals = {
        oneTimeCode: !!document.querySelector('input[autocomplete="one-time-code"]'),
        maxlength6: !!document.querySelector('input[maxlength="6"]'),
      };

      return {
        url: location.href,
        title: document.title,
        nav,
        buttons,
        headings,
        links,
        otpSignals,
      };
    });

    // 5) Monta o objeto de saida no formato esperado pelo orquestrador.
    const out = {
      seg,
      url: dump.url,
      title: dump.title,
      has2FA,
      otpSignals: dump.otpSignals,
      nav: dump.nav,
      buttons: dump.buttons,
      headings: dump.headings,
      links: dump.links,
    };

    // 6) Persiste exploration/<seg>.json e screenshot full page.
    const exploreDir = path.join(work, 'exploration');
    await ensureDir(exploreDir);

    const jsonPath = path.join(exploreDir, `${seg}.json`);
    await writeJson(jsonPath, out);

    const pngPath = path.join(exploreDir, `${seg}.png`);
    await page.screenshot({ path: pngPath, fullPage: true });

    console.log(`[explore ${seg}] OK`);
    console.log(`  -> ${jsonPath}`);
    console.log(`  -> ${pngPath}`);
    console.log(
      `  has2FA=${has2FA}  nav=${out.nav.length}  buttons=${out.buttons.length}  headings=${out.headings.length}`
    );
  } finally {
    // Sem video aqui; finalizeRecording apenas fecha contexto/browser limpo.
    await finalizeRecording(handle, seg);
  }
}

main().catch((err) => {
  // Erro real, com contexto: sem catch vazio. Codigo de saida != 0 para o
  // orquestrador detectar a falha.
  console.error(`[explore] ERRO: ${err.stack || err.message}`);
  process.exit(1);
});
