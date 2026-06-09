#!/usr/bin/env node
// make_vertical.mjs - Deriva o vertical 9:16 (TikTok/Instagram) a partir das gravacoes.
//
// CONTRATO:
//   node scripts/make_vertical.mjs --work <dir>
//
// Entradas:
//   <work>/config.json           (dimensoes.short, default [1080,1920])
//   <work>/scenes-short.json     (subconjunto condensado; cada cena { id, seg, text, short })
//   <work>/durations-short.json  ({ "<id>": <segundos> })
//   <work>/scene-marks.json      ({ "<seg>": { "<id>": { start, end } } })
//   <work>/video/<seg>.webm      (gravacoes brutas - mesma fonte do master)
//   <work>/audio-short/<id>.mp3  (narracao condensada por cena)
// Saida:
//   <work>/out/Video-Demo-Short.mp4
//
// ESTRATEGIA:
//   1) Para cada cena short, CORTA o trecho de video/<seg>.webm usando
//      scene-marks[seg][id].start/end (offsets relativos ao inicio do .webm daquele
//      segmento - ver protocolo de sincronia: t0 fixado no bootstrap, nunca resetado).
//   2) Reenquadra 16:9 -> 9:16: o frame escalado para 1080 de LARGURA fica centrado
//      sobre um canvas 1080x1920 cujo fundo e uma copia DESFOCADA (boxblur) do proprio
//      frame escalada para COBRIR o canvas - assim nao sobram tarjas pretas.
//   3) Queima legendas grandes (drawtext) a partir do texto de scenes-short.json.
//   4) Muxa audio-short/<id>.mp3 e normaliza a duracao do clipe pela narracao.
//   5) Concatena todos os clipes short em out/Video-Demo-Short.mp4.
//
// POR QUE cortar do .webm (e nao reusar <seg>_final.mp4): o vertical precisa de
// reenquadramento por cena (cada cena pode focar uma regiao diferente) e de timing
// independente do master. Cortar a partir do scene-marks da controle exato por cena.

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const FADE = 0.4;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const workDir = path.resolve(args.work || process.cwd());

const configPath = path.join(workDir, "config.json");
const scenesShortPath = path.join(workDir, "scenes-short.json");
const durationsShortPath = path.join(workDir, "durations-short.json");
const marksPath = path.join(workDir, "scene-marks.json");
const videoDir = path.join(workDir, "video");
const audioShortDir = path.join(workDir, "audio-short");
const outDir = path.join(workDir, "out");
const tmpDir = path.join(outDir, "_short-tmp");
const shortPath = path.join(outDir, "Video-Demo-Short.mp4");

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, opts);
    let stderr = "";
    if (child.stderr) child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

async function readJson(file) {
  if (!existsSync(file)) throw new Error(`Arquivo nao encontrado: ${file}`);
  const raw = await readFile(file, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON invalido em ${file}: ${err.message}`);
  }
}

// Escapa texto para o filtro drawtext do ffmpeg. drawtext usa ':' como separador
// de opcoes e '%' como expansao; alem disso interpretamos quebras como \n reais.
// Como o texto vai num arquivo (textfile=), o cuidado principal e com aspas e
// quebras de linha que quebrariam o arquivo de legenda.
function wrapCaption(text, maxCharsPerLine = 24) {
  // Quebra o texto em linhas curtas (vertical => fonte grande, poucas palavras/linha).
  const words = String(text).replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe falhou: ${stderr.trim()}`));
      const v = parseFloat(stdout.trim());
      if (!Number.isFinite(v)) return reject(new Error(`Duracao invalida: '${stdout.trim()}'`));
      resolve(v);
    });
  });
}

async function main() {
  const config = await readJson(configPath);
  const scenes = await readJson(scenesShortPath);
  if (!Array.isArray(scenes)) throw new Error("scenes-short.json deve ser um array.");
  const durations = await readJson(durationsShortPath);
  const allMarks = await readJson(marksPath);

  // Dimensoes verticais do contrato (default 1080x1920).
  const [W, H] =
    config.dimensoes && Array.isArray(config.dimensoes.short)
      ? config.dimensoes.short
      : [1080, 1920];

  await mkdir(outDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  // Apenas cenas marcadas para o vertical. Geralmente scenes-short.json ja e o
  // subconjunto; ainda assim respeitamos short:false caso esteja presente.
  const shortScenes = scenes.filter((sc) => sc.short !== false);
  if (shortScenes.length === 0) {
    throw new Error("Nenhuma cena com short!=false em scenes-short.json.");
  }

  const clipFiles = [];

  for (let i = 0; i < shortScenes.length; i++) {
    const scene = shortScenes[i];
    const id = scene.id;
    const seg = scene.seg;

    const segMarks = allMarks[seg];
    if (!segMarks || !segMarks[id] || typeof segMarks[id].start !== "number") {
      throw new Error(
        `scene-marks.json sem start/end para seg='${seg}' id='${id}'. Rode capture.mjs.`
      );
    }
    const { start } = segMarks[id];
    let { end } = segMarks[id];

    const webm = path.join(videoDir, `${seg}.webm`);
    if (!existsSync(webm)) {
      throw new Error(`Gravacao nao encontrada: ${webm}.`);
    }
    const audio = path.join(audioShortDir, `${id}.mp3`);
    if (!existsSync(audio)) {
      throw new Error(`Audio short nao encontrado: ${audio}. Rode gen_tts.mjs --out audio-short.`);
    }

    // Duracao do clipe = max(janela de video marcada, duracao da narracao short).
    // A narracao manda no tempo do vertical: se o audio short e mais longo que a
    // janela gravada, esticamos o fim do corte para nao cortar a fala.
    const audioDur = durations[id];
    if (typeof audioDur !== "number" || audioDur <= 0) {
      throw new Error(`durations-short.json sem duracao valida para id='${id}'.`);
    }
    const markWindow = typeof end === "number" ? Math.max(0, end - start) : 0;
    const clipDur = Math.max(markWindow, audioDur);

    // Escreve a legenda em arquivo (textfile=) para evitar escaping no comando.
    const captionFile = path.join(tmpDir, `cap-${id}.txt`);
    await writeFile(captionFile, wrapCaption(scene.text) + "\n", "utf8");

    // --- filtro de video -------------------------------------------------
    // [0:v] do .webm:
    //   split em duas copias: 'fg' (primeiro plano) e 'bg' (fundo).
    //   bg: escala para COBRIR o canvas (increase + crop) e aplica boxblur forte.
    //   fg: escala para 1080 de LARGURA mantendo proporcao (altura livre).
    //   overlay: centra o fg sobre o bg desfocado -> sem tarjas pretas.
    //   drawtext: legenda grande perto do rodape com caixa translucida.
    const blurBg =
      `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
      `crop=${W}:${H},boxblur=20:2,setsar=1[bgb]`;
    const fg = `[fg]scale=${W}:-2:force_original_aspect_ratio=decrease,setsar=1[fgs]`;
    const overlay = `[bgb][fgs]overlay=(W-w)/2:(H-h)/2[ov]`;

    // drawtext: fonte grande (60), branca, com caixa preta translucida; posicionada
    // a ~22% da base. textfile evita problemas de aspas/acentos no shell.
    // Caminho do textfile escapado para Windows: trocamos '\' por '/' e escapamos ':'.
    const captionForFilter = captionFile.replace(/\\/g, "/").replace(/:/g, "\\:");
    const draw =
      `[ov]drawtext=textfile='${captionForFilter}':` +
      `fontcolor=white:fontsize=60:line_spacing=10:` +
      `box=1:boxcolor=black@0.55:boxborderw=24:` +
      `x=(w-text_w)/2:y=h-text_h-h*0.18,` +
      `fade=t=in:st=0:d=${FADE},fade=t=out:st=${Math.max(0, clipDur - FADE).toFixed(3)}:d=${FADE},` +
      `fps=30[vout]`;

    const filterComplex =
      `[0:v]split=2[fg][bg];${blurBg};${fg};${overlay};${draw};` +
      // Audio: narracao short normalizada e com fades suaves.
      `[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,` +
      `afade=t=in:st=0:d=${FADE},afade=t=out:st=${Math.max(0, clipDur - FADE).toFixed(3)}:d=${FADE}[aout]`;

    const clipOut = path.join(tmpDir, `clip-${String(i).padStart(2, "0")}.mp4`);

    // -ss antes do -i (fast seek) + -t define a janela cortada do .webm.
    // POR QUE -ss/-t no input do video mas o audio vem de outro input: o corte
    // se aplica so ao .webm; o mp3 ja e a narracao inteira da cena short.
    const ffArgs = [
      "-y",
      "-ss",
      start.toFixed(3),
      "-t",
      clipDur.toFixed(3),
      "-i",
      webm,
      "-i",
      audio,
      "-filter_complex",
      filterComplex,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      // -shortest garante que clipe termina junto com o audio (que manda no tempo).
      "-shortest",
      "-movflags",
      "+faststart",
      clipOut,
    ];

    console.log(`[short] clipe ${i + 1}/${shortScenes.length} (seg=${seg} id=${id}) -> ${path.basename(clipOut)}`);
    const { code, stderr } = await run("ffmpeg", ffArgs);
    if (code !== 0) {
      throw new Error(`ffmpeg falhou no clipe short ${id} (exit ${code}):\n${stderr.trim()}`);
    }
    if (!existsSync(clipOut)) {
      throw new Error(`ffmpeg terminou sem gerar ${clipOut}.`);
    }
    clipFiles.push(clipOut);
  }

  // --- concat final ----------------------------------------------------
  // Lista do concat demuxer com caminhos relativos a tmpDir; rodamos com cwd=tmpDir
  // para evitar escaping de path (Windows). Reencode no concat para uniformizar
  // timestamps dos clipes (cada um foi gerado isolado).
  const listPath = path.join(tmpDir, "_concat-short.txt");
  const listBody = clipFiles.map((f) => `file '${path.basename(f)}'`).join("\n");
  await writeFile(listPath, listBody + "\n", "utf8");

  const concatArgs = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    path.basename(listPath),
    // Reencode leve para garantir continuidade A/V entre clipes independentes.
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    // Saida relativa ao cwd (tmpDir) apontando para ../Video-Demo-Short.mp4.
    path.join("..", "Video-Demo-Short.mp4"),
  ];

  console.log(`[concat] juntando ${clipFiles.length} clipes verticais ...`);
  const { code, stderr } = await run("ffmpeg", concatArgs, { cwd: tmpDir });
  if (code !== 0) {
    throw new Error(`ffmpeg concat (vertical) falhou:\n${stderr.trim()}`);
  }
  if (!existsSync(shortPath)) {
    throw new Error(`ffmpeg terminou sem gerar ${shortPath}.`);
  }

  // Limpa a pasta temporaria (clipes + listas + captions).
  await rm(tmpDir, { recursive: true, force: true });

  const total = await probeDuration(shortPath);
  console.log(`OK: ${path.relative(workDir, shortPath)} (${W}x${H}, ~${total.toFixed(1)}s)`);
}

main().catch((err) => {
  console.error(`\nERRO make_vertical: ${err.message}`);
  process.exit(1);
});
