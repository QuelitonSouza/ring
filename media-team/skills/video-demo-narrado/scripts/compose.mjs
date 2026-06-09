#!/usr/bin/env node
// compose.mjs - Compoe UM segmento: gera legenda .ass sincronizada e muxa audio
// das cenas sobre a gravacao .webm, queimando as legendas no video.
//
// CONTRATO:
//   node scripts/compose.mjs --work <dir> --seg <seg>
//
// Entradas:
//   <work>/config.json
//   <work>/scenes.json          (array ordenado de { id, seg, text, short })
//   <work>/durations.json       ({ "<id>": <segundos> })
//   <work>/scene-marks.json     ({ "<seg>": { "<id>": { start, end } } })
//   <work>/video/<seg>.webm     (gravacao bruta do Playwright deste segmento)
//   <work>/audio/<id>.mp3        (narracao master por cena)
// Saidas:
//   <work>/subs/<seg>.ass
//   <work>/out/<seg>_final.mp4
//
// POR QUE scene-marks importa: start/end sao offsets em segundos RELATIVOS ao inicio
// do .webm daquele segmento (t0 = inicio real da gravacao, fixado no bootstrap e nunca
// resetado). A legenda e o audio de cada cena comecam exatamente em 'start'. Se
// usassemos qualquer outro referencial, legenda/audio adiantariam (bug classico de t0).

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// LEAD: pequeno avanco (s) para a legenda aparecer um pouco ANTES da voz. Da
// sensacao de leitura natural; o olho chega ao texto antes do audio comecar.
const SUBTITLE_LEAD = 0.15;

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
const seg = args.seg;

if (!seg) {
  console.error("ERRO: --seg <seg> e obrigatorio.");
  process.exit(1);
}

const configPath = path.join(workDir, "config.json");
const scenesPath = path.join(workDir, "scenes.json");
const durationsPath = path.join(workDir, "durations.json");
const marksPath = path.join(workDir, "scene-marks.json");
const subsDir = path.join(workDir, "subs");
const outDir = path.join(workDir, "out");
const webmPath = path.join(workDir, "video", `${seg}.webm`);
const audioDir = path.join(workDir, "audio");

const assPath = path.join(subsDir, `${seg}.ass`);
const finalPath = path.join(outDir, `${seg}_final.mp4`);

// --- util ffmpeg/json ------------------------------------------------------

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

// Converte segundos -> "H:MM:SS.cc" (centissegundos), o formato de tempo do .ass.
function toAssTime(seconds) {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.round((clamped - Math.floor(clamped)) * 100);
  // cs pode estourar para 100 por arredondamento; normaliza.
  const csFinal = cs === 100 ? 0 : cs;
  const sFinal = cs === 100 ? s + 1 : s;
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${h}:${pad(m)}:${pad(sFinal)}.${pad(csFinal)}`;
}

// Escapa texto para um campo de Dialogue do .ass. Quebras de linha viram "\N"
// (quebra dura do ASS) e chaves sao neutralizadas para nao virar override tag.
function escapeAssText(text) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/[{}]/g, "")
    .replace(/\n/g, "\\N");
}

// adelay precisa de milissegundos inteiros, com um valor por canal (estereo).
function delayMs(seconds) {
  return Math.max(0, Math.round(seconds * 1000));
}

// --- geracao do .ass -------------------------------------------------------
// Estilo: caixa translucida legivel (BorderStyle=3 desenha um retangulo opaco
// atras do texto usando BackColour com alpha). Cores em &HAABBGGRR (alpha + BGR).
//   - Alpha 00 = opaco, FF = transparente. BackColour com AA=80 -> ~50% translucido.
function buildAss(scenesForSeg, durations, marks) {
  const header = [
    "[Script Info]",
    "; Gerado por compose.mjs (ring:video-demo-narrado)",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // BorderStyle=3 -> caixa; BackColour &H80000000 -> preto ~50% translucido.
    // Alignment=2 -> base-centro. MarginV=70 sobe a caixa um pouco do rodape.
    "Style: Demo,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,2,1,2,120,120,70,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const lines = [];
  for (const scene of scenesForSeg) {
    const id = scene.id;
    const mark = marks[id];
    if (!mark || typeof mark.start !== "number") {
      throw new Error(
        `scene-marks.json sem 'start' para seg='${seg}' id='${id}'. Rode capture.mjs antes de compose.mjs.`
      );
    }
    const dur = durations[id];
    if (typeof dur !== "number" || dur <= 0) {
      throw new Error(`durations.json sem duracao valida para id='${id}'.`);
    }
    // A legenda aparece um pouco antes da voz (LEAD) e dura o tempo do audio.
    const start = mark.start - SUBTITLE_LEAD;
    const end = mark.start + dur;
    lines.push(
      `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Demo,,0,0,0,,${escapeAssText(scene.text)}`
    );
  }

  return header.join("\n") + "\n" + lines.join("\n") + "\n";
}

// --- composicao ffmpeg -----------------------------------------------------

async function main() {
  const config = await readJson(configPath); // lido para validar contexto/contrato
  if (!config || !Array.isArray(config.segmentos)) {
    throw new Error("config.json invalido: faltando array 'segmentos'.");
  }

  const scenes = await readJson(scenesPath);
  if (!Array.isArray(scenes)) throw new Error("scenes.json deve ser um array.");

  const durations = await readJson(durationsPath);
  const allMarks = await readJson(marksPath);
  const marks = allMarks[seg];
  if (!marks) {
    throw new Error(
      `scene-marks.json nao tem entradas para seg='${seg}'. Rode capture.mjs --seg ${seg} antes.`
    );
  }

  if (!existsSync(webmPath)) {
    throw new Error(`Gravacao nao encontrada: ${webmPath}. Rode capture.mjs --seg ${seg}.`);
  }

  // Apenas as cenas deste segmento, na ordem do scenes.json (que e ordenado).
  const scenesForSeg = scenes.filter((sc) => sc.seg === seg);
  if (scenesForSeg.length === 0) {
    throw new Error(`Nenhuma cena com seg='${seg}' em scenes.json.`);
  }

  await mkdir(subsDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  // 1) Gera o .ass.
  const ass = buildAss(scenesForSeg, durations, marks);
  await writeFile(assPath, ass, "utf8");
  console.log(`[ass ] ${path.relative(workDir, assPath)} (${scenesForSeg.length} cenas)`);

  // 2) Monta o comando ffmpeg.
  // Inputs: 0 = video .webm; 1..N = audios das cenas.
  const inputs = ["-i", webmPath];
  const audioFilterParts = [];
  const amixLabels = [];

  scenesForSeg.forEach((scene, idx) => {
    const mp3 = path.join(audioDir, `${scene.id}.mp3`);
    if (!existsSync(mp3)) {
      throw new Error(`Audio nao encontrado: ${mp3}. Rode gen_tts.mjs antes.`);
    }
    inputs.push("-i", mp3);

    // O input de audio idx ocupa o indice (idx+1) entre os inputs do ffmpeg.
    const inIdx = idx + 1;
    const delay = delayMs(marks[scene.id].start); // posiciona o audio no 'start' da cena
    const label = `a${idx}`;
    // adelay com um valor por canal (estereo). asetpts=N reseta timestamps para
    // garantir que o adelay seja aplicado a partir do tempo 0 do stream.
    audioFilterParts.push(
      `[${inIdx}:a]aresample=async=1,adelay=${delay}|${delay}[${label}]`
    );
    amixLabels.push(`[${label}]`);
  });

  // amix soma todas as narracoes; dropout_transition=0 evita ganho dinamico que
  // baixaria o volume quando uma cena termina e outra ainda nao comecou.
  const amix =
    amixLabels.join("") +
    `amix=inputs=${amixLabels.length}:duration=longest:dropout_transition=0,` +
    `dynaudnorm=f=200:g=5[aout]`;

  // subtitles: usamos NOME RELATIVO e rodamos o ffmpeg com cwd = subs/. Isto evita
  // o inferno de escaping de path no Windows (drive letter "C:" e contrabarras
  // sao interpretados pelo parser de filtros do ffmpeg). Dentro de subs/ o nome
  // e simplesmente "<seg>.ass".
  const assRelName = `${seg}.ass`;

  const filterComplex =
    audioFilterParts.join(";") +
    ";" +
    amix +
    `;[0:v]subtitles=${assRelName}[vout]`;

  // Caminho da saida relativo ao cwd (subs/), apontando para ../out/<seg>_final.mp4.
  const outRel = path.join("..", "out", `${seg}_final.mp4`);

  const ffArgs = [
    "-y",
    ...inputs,
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
    // -shortest: o video termina junto com a ultima narracao + cauda do .webm.
    // Mantemos a duracao do video (sem -shortest) para nao cortar a gravacao,
    // pois compose_final fara fades/concat depois.
    "-movflags",
    "+faststart",
    outRel,
  ];

  // POR QUE cwd = subsDir: ver comentario do assRelName acima (escaping Windows).
  console.log(`[ffmpeg] compondo ${path.relative(workDir, finalPath)} ...`);
  const { code, stderr } = await run("ffmpeg", ffArgs, { cwd: subsDir });
  if (code !== 0) {
    throw new Error(`ffmpeg falhou no segmento '${seg}' (exit ${code}):\n${stderr.trim()}`);
  }
  if (!existsSync(finalPath)) {
    throw new Error(`ffmpeg terminou sem gerar ${finalPath}.`);
  }

  console.log(`OK: ${path.relative(workDir, finalPath)}`);
}

main().catch((err) => {
  console.error(`\nERRO compose: ${err.message}`);
  process.exit(1);
});
