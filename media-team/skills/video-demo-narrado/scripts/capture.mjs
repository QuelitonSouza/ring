// capture.mjs
// CLI: node scripts/capture.mjs --work <dir> --seg <seg>
//
// Objetivo: GRAVAR o video bruto do segmento <seg> sincronizado com a narracao.
// Abre um contexto com recordVideo no tamanho config.dimensoes.master, faz
// login + 2FA quando o segmento exige, e percorre as cenas de scenes.json
// daquele seg EM ORDEM, cada uma cronometrada por durations.json (para o clipe
// gravado bater com a duracao do audio). Ao final, fecha o contexto para
// FLUSHAR video/<seg>.webm e atualiza scene-marks.json com os offsets das cenas.
//
// Le do contrato: config.json, scenes.json, durations.json. Escreve:
//   video/<seg>.webm  (gravacao bruta deste segmento)
//   scene-marks.json  (incremental: { "<seg>": { "<id>": { start, end } } })
//
// Robustez: um seletor ausente em during() loga e segue (a cena continua sendo
// gravada pelo tempo da narracao). UM CONTEXTO POR SEGMENTO (chamamos este
// script uma vez por seg), garantindo t0 unico por .webm.

import path from 'node:path';
import {
  parseArgs,
  resolveWork,
  readJson,
  readJsonIfExists,
  launchContext,
  finalizeRecording,
  login,
  await2FA,
  detectOtpField,
  scene,
  smoothScrollTo,
  clickWithCursor,
  typeHuman,
  sleep,
} from './lib.mjs';

async function main() {
  const args = parseArgs();
  const work = resolveWork(args);
  const seg = typeof args.seg === 'string' ? args.seg : null;

  if (!seg) {
    console.error('Uso: node scripts/capture.mjs --work <dir> --seg <seg>');
    process.exit(2);
  }

  // --- Carrega o contrato de arquivos ---
  const config = await readJson(path.join(work, 'config.json'));
  const scenesAll = await readJson(path.join(work, 'scenes.json'));
  // durations.json pode nao existir ainda se gen_tts nao rodou; avisamos e
  // usamos fallback por cena (scene() ja trata id ausente com 4s).
  const durations = (await readJsonIfExists(path.join(work, 'durations.json'), {})) ?? {};

  const segCfg = (config.segmentos || []).find((s) => s.seg === seg);
  if (!segCfg) {
    console.error(`Segmento "${seg}" nao encontrado em config.json.`);
    process.exit(2);
  }

  // Cenas deste segmento, na ORDEM do scenes.json (que ja vem ordenado).
  const scenes = scenesAll.filter((s) => s.seg === seg);
  if (scenes.length === 0) {
    console.error(`Nenhuma cena com seg="${seg}" em scenes.json.`);
    process.exit(2);
  }

  if (Object.keys(durations).length === 0) {
    console.warn(
      '[capture] durations.json vazio/ausente: cada cena usara fallback de tempo. ' +
        'Rode gen_tts.mjs antes para sincronizar com a narracao.'
    );
  }

  // Master sempre grava em 16:9 (config.dimensoes.master).
  const dims = (config.dimensoes && config.dimensoes.master) || [1920, 1080];

  // t0 e fixado AQUI dentro (launchContext) e nunca mais e resetado.
  const handle = await launchContext({ work, dims, record: true, headed: !!args.headed });
  const { page } = handle;

  try {
    // -------------------------------------------------------------------
    // 1) Login + 2FA antes de marcar qualquer cena.
    //    Esse tempo conta no .webm (faz parte da gravacao), mas NAO e uma
    //    cena: as marcas start/end so comecam nas cenas reais. Por isso a
    //    primeira cena pode ter start > 0 -- isso e CORRETO (legenda/audio
    //    comecam exatamente em start, casando com o que esta na tela).
    // -------------------------------------------------------------------
    if (segCfg.user && segCfg.pass) {
      console.log(`[capture ${seg}] login...`);
      await login(page, {
        loginUrl: segCfg.loginUrl,
        user: segCfg.user,
        pass: segCfg.pass,
      });

      // 2FA: detecta campo OTP e/ou respeita flag config.twofa.
      const needs2FA = !!segCfg.twofa || (await detectOtpField(page)) !== null;
      if (needs2FA) {
        console.log(`[capture ${seg}] 2FA: aguardando admin_code.txt...`);
        await await2FA(page, { work });
      }
    }

    // Garante que estamos na URL do segmento (apos login/2FA).
    if (segCfg.url) {
      // Se ja navegamos para a area logada, goto reposiciona deterministicamente.
      if (page.url() !== segCfg.url) {
        await page.goto(segCfg.url, { waitUntil: 'domcontentloaded' }).catch((err) => {
          console.warn(`[capture ${seg}] goto(${segCfg.url}) falhou: ${err.message}`);
        });
      }
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    }

    // -------------------------------------------------------------------
    // 2) Percorre as cenas em ordem. Cada cena = uma janela cronometrada.
    //    setup(): posiciona a tela (scroll/navegacao) -> fora do tempo da cena.
    //    during(): interacoes leves (ex.: scroll lento, hover) DENTRO da janela.
    //    A duracao real vem de durations[id] (scene() cuida disso).
    // -------------------------------------------------------------------
    for (const sc of scenes) {
      const id = String(sc.id);

      await scene({
        handle,
        seg,
        id,
        durations,

        // SETUP: posicionar a tela ANTES de marcar o start (nao conta no tempo).
        setup: async () => {
          // Heuristica de posicionamento: se a cena referencia uma ancora/seletor
          // via campo opcional (sc.anchor ou sc.selector), rolamos suavemente ate
          // ela. Sem isso, mantemos a tela onde esta (cena puramente narrada).
          const anchor = sc.anchor || sc.selector || null;
          if (anchor) {
            await smoothScrollTo(page, anchor).catch((err) =>
              console.warn(`[scene ${seg}/${id}] scroll ate ${anchor} falhou: ${err.message}`)
            );
          }
        },

        // DURING: interacao opcional declarada na cena. Mantemos um conjunto
        // pequeno e robusto; qualquer falha aqui apenas loga (cena segue gravando).
        during: async () => {
          await runSceneInteraction(page, seg, id, sc);
        },
      });
    }

    console.log(`[capture ${seg}] cenas concluidas: ${scenes.length}`);
  } finally {
    // Fechar o contexto e o que FLUSHA o .webm. finalizeRecording renomeia para
    // video/<seg>.webm conforme o contrato.
    const webm = await finalizeRecording(handle, seg);
    if (webm) {
      console.log(`[capture ${seg}] gravacao salva em: ${webm}`);
    } else {
      console.warn(`[capture ${seg}] nenhum .webm produzido (verifique recordVideo).`);
    }
  }
}

/**
 * Interacoes opcionais por cena. O scenes.json pode trazer dicas declarativas:
 *   sc.action: "click" | "type" | "scroll" | "hover" | undefined
 *   sc.selector: alvo da acao
 *   sc.value: texto a digitar (quando action="type")
 *
 * Tudo e tolerante a falha: se o seletor nao existir, logamos e seguimos -- a
 * cena continua sendo gravada pelo tempo da narracao (robustez exigida).
 */
async function runSceneInteraction(page, seg, id, sc) {
  const action = sc.action;
  if (!action) return; // cena apenas narrada (sem interacao) e legitima.

  const selector = sc.selector || sc.anchor;
  if (action !== 'scroll' && !selector) {
    console.warn(`[scene ${seg}/${id}] action="${action}" sem selector; ignorando.`);
    return;
  }

  const locator = selector ? page.locator(selector).first() : null;

  // Confere existencia/visibilidade antes de agir (evita timeouts longos).
  if (locator) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) {
      console.warn(`[scene ${seg}/${id}] selector "${selector}" nao visivel; ignorando ${action}.`);
      return;
    }
  }

  try {
    switch (action) {
      case 'click':
        await clickWithCursor(page, locator);
        break;

      case 'type':
        // Digitar devagar (ex.: campo de busca/login de demo) para a narracao
        // acompanhar. Usa o mesmo ritmo humano do login.
        await typeHuman(locator, String(sc.value ?? ''), { delay: 80 });
        break;

      case 'hover':
        // Move o cursor falso ate o elemento e aguarda um instante.
        await clickWithCursorHoverOnly(page, locator);
        break;

      case 'scroll':
        await smoothScrollTo(page, selector ?? sc.scrollTo ?? document.body);
        break;

      default:
        console.warn(`[scene ${seg}/${id}] action desconhecida: "${action}"; ignorando.`);
    }
  } catch (err) {
    // Sem catch vazio: registramos o erro com contexto e seguimos.
    console.warn(`[scene ${seg}/${id}] interacao "${action}" falhou: ${err.message}`);
  }
}

/** Hover sem clique: reaproveita o movimento suave do cursor falso. */
async function clickWithCursorHoverOnly(page, locator) {
  // moveCursorTo (interno do clickWithCursor) ja faz hover real via mouse.move;
  // aqui chamamos hover do Playwright apos posicionar o cursor falso.
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  await locator.hover({ timeout: 5_000 }).catch(() => {});
  await sleep(300);
}

main().catch((err) => {
  console.error(`[capture] ERRO: ${err.stack || err.message}`);
  process.exit(1);
});
