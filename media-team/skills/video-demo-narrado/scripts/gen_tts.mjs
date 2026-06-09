#!/usr/bin/env node
// gen_tts.mjs - Sintese de narracao TTS (PT-BR, voz masculina por padrao) via edge-tts.
//
// CONTRATO:
//   node scripts/gen_tts.mjs --work <dir> --scenes scenes.json --out audio \
//        --voice pt-BR-AntonioNeural --rate=-2%
//   node scripts/gen_tts.mjs --work <dir> --scenes scenes-short.json --out audio-short
//
// Entradas:  <work>/<scenes.json>  (array ordenado de { id, seg, text, short })
// Saidas:    <work>/<out>/<id>.mp3  +  <work>/durations.json (ou durations-short.json)
//
// POR QUE durations.json e critico: a captura (capture.mjs) usa durations[id] para saber
// por quantos segundos rodar o during() de cada cena, e a composicao (compose.mjs) usa o
// mesmo valor para dimensionar a legenda. O audio e a "fonte da verdade" do tempo de cada
// cena, entao medimos cada mp3 com ffprobe APOS sintetizar - nunca chutamos a duracao.

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------------------
// Parsing de CLI. Aceita tanto "--rate -2%" quanto "--rate=-2%" porque um valor
// que comeca com "-" pode ser confundido com uma flag pelo parser ingenuo; o
// formato "--rate=-2%" e a forma robusta documentada no contrato.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      // Forma --chave=valor (ex.: --rate=-2%)
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else {
      const key = token.slice(2);
      const next = argv[i + 1];
      // Se o proximo token e um valor (nao outra flag), consome-o. Caso contrario,
      // tratamos como flag booleana.
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
const scenesName = args.scenes || "scenes.json";
const outName = args.out || "audio";

// config.json e a fonte da verdade de voz/rate; as flags --voice/--rate sobrescrevem.
// Le <work>/config.json de forma TOLERANTE: se nao existir (ou for invalido), seguimos
// sem config e caimos nos defaults. So as flags + config influenciam aqui.
function loadConfig(dir) {
  const cfgPath = path.join(dir, "config.json");
  if (!existsSync(cfgPath)) return {};
  try {
    return JSON.parse(readFileSync(cfgPath, "utf8"));
  } catch (err) {
    // Config presente porem ilegivel: avisamos (sem catch vazio) e usamos defaults.
    console.warn(`Aviso: config.json invalido em ${cfgPath} (${err.message}). Usando defaults.`);
    return {};
  }
}

const config = loadConfig(workDir);

// Precedencia: flag CLI > config.json > default.
const voice = args.voice || config.voz || "pt-BR-AntonioNeural"; // default MASCULINA, conforme contrato
const rate = args.rate || config.rate || "-2%";

const scenesPath = path.join(workDir, scenesName);
const outDir = path.join(workDir, outName);

// Quando o destino e "audio-short", o arquivo de duracoes correspondente e
// durations-short.json; senao, durations.json. Isto mantem master e vertical separados.
const durationsName = outName === "audio-short" ? "durations-short.json" : "durations.json";
const durationsPath = path.join(workDir, durationsName);

// ---------------------------------------------------------------------------
// Deteccao de runtime do edge-tts.
//   - Windows: o launcher padrao e "py -m edge_tts" (modulo Python).
//   - Linux/macOS: normalmente existe o executavel "edge-tts" no PATH.
// Se nada funcionar, falhamos com mensagem clara (NUNCA engolimos o erro).
// ---------------------------------------------------------------------------
function isWindows() {
  return process.platform === "win32";
}

// Executa um comando e resolve com { code, stdout, stderr }. Nao rejeita por
// exit code != 0 - quem chama decide o que fazer (assim conseguimos probar
// disponibilidade de binarios sem lancar excecao).
function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { ...opts });
    let stdout = "";
    let stderr = "";
    if (child.stdout) child.stdout.on("data", (d) => (stdout += d.toString()));
    if (child.stderr) child.stderr.on("data", (d) => (stderr += d.toString()));
    // ENOENT etc. - binario inexistente. Propagamos para quem chamou tratar.
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

// Resolve qual invocacao de edge-tts usar. Testa "--version" para confirmar que
// o binario/modulo realmente responde antes de gerar dezenas de chamadas.
async function resolveEdgeTts() {
  const candidates = isWindows()
    ? [
        { cmd: "py", base: ["-m", "edge_tts"] },
        { cmd: "python", base: ["-m", "edge_tts"] },
        { cmd: "edge-tts", base: [] },
      ]
    : [
        { cmd: "edge-tts", base: [] },
        { cmd: "python3", base: ["-m", "edge_tts"] },
        { cmd: "python", base: ["-m", "edge_tts"] },
      ];

  for (const candidate of candidates) {
    try {
      const { code } = await run(candidate.cmd, [...candidate.base, "--version"]);
      // edge-tts retorna 0 em --version quando esta instalado.
      if (code === 0) return candidate;
    } catch (err) {
      // ENOENT: este candidato nao existe. Tenta o proximo silenciosamente.
      if (err && err.code === "ENOENT") continue;
      // Outro erro de spawn inesperado: registra mas continua tentando.
      console.warn(`Aviso ao testar '${candidate.cmd}': ${err.message}`);
    }
  }
  return null;
}

// Resolve ffprobe (esperado no PATH conforme stack do contrato).
async function ensureFfprobe() {
  try {
    const { code } = await run("ffprobe", ["-version"]);
    if (code === 0) return "ffprobe";
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
  throw new Error(
    "ffprobe nao encontrado no PATH. Instale o ffmpeg (que inclui ffprobe) e garanta que esta no PATH."
  );
}

// Mede a duracao de um arquivo de audio em segundos (float) via ffprobe.
async function probeDuration(ffprobe, file) {
  const { code, stdout, stderr } = await run(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  if (code !== 0) {
    throw new Error(`ffprobe falhou para ${file}: ${stderr.trim()}`);
  }
  const seconds = parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Duracao invalida medida para ${file}: '${stdout.trim()}'`);
  }
  // Arredonda para 3 casas (ms) - precisao suficiente para sincronia, evita ruido.
  return Math.round(seconds * 1000) / 1000;
}

// Decide se podemos pular a re-sintese: o mp3 ja existe E e mais novo que o
// arquivo de cenas. Isto torna re-execucoes baratas quando so o codigo mudou.
async function isFresh(mp3Path, scenesMtimeMs) {
  if (!existsSync(mp3Path)) return false;
  try {
    const s = await stat(mp3Path);
    return s.mtimeMs >= scenesMtimeMs && s.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  // Validacao de entradas - falha cedo e claro.
  if (!existsSync(scenesPath)) {
    throw new Error(`Arquivo de cenas nao encontrado: ${scenesPath}`);
  }

  const edge = await resolveEdgeTts();
  if (!edge) {
    throw new Error(
      isWindows()
        ? "edge-tts nao encontrado. No Windows instale com: py -m pip install edge-tts (ou pip install edge-tts)."
        : "edge-tts nao encontrado. Instale com: pip install edge-tts (ou pip3 install edge-tts)."
    );
  }

  const ffprobe = await ensureFfprobe();

  const raw = await readFile(scenesPath, "utf8");
  let scenes;
  try {
    scenes = JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON invalido em ${scenesPath}: ${err.message}`);
  }
  if (!Array.isArray(scenes)) {
    throw new Error(`${scenesName} deve ser um array ORDENADO de cenas.`);
  }

  const scenesStat = await stat(scenesPath);
  await mkdir(outDir, { recursive: true });

  const durations = {};
  let synthesized = 0;
  let skipped = 0;

  for (const scene of scenes) {
    // Cada cena precisa de id (string "01","02"...) e text (narracao = legenda).
    if (!scene || typeof scene.id !== "string" || !scene.text) {
      throw new Error(
        `Cena invalida (precisa de 'id' string e 'text'): ${JSON.stringify(scene)}`
      );
    }
    const mp3Path = path.join(outDir, `${scene.id}.mp3`);

    if (await isFresh(mp3Path, scenesStat.mtimeMs)) {
      // Reaproveita audio existente; ainda assim medimos para popular durations.json.
      durations[scene.id] = await probeDuration(ffprobe, mp3Path);
      skipped++;
      console.log(`[skip] ${scene.id} (mp3 atualizado) -> ${durations[scene.id]}s`);
      continue;
    }

    // edge-tts: --text/--voice/--rate/--write-media. O --rate aceita "-2%" etc.
    const ttsArgs = [
      ...edge.base,
      "--voice",
      voice,
      "--rate",
      rate,
      "--text",
      scene.text,
      "--write-media",
      mp3Path,
    ];

    console.log(`[tts ] ${scene.id} (${voice} ${rate}) -> ${path.basename(mp3Path)}`);
    const { code, stderr } = await run(edge.cmd, ttsArgs, { cwd: workDir });
    if (code !== 0) {
      throw new Error(
        `edge-tts falhou na cena ${scene.id} (exit ${code}). stderr:\n${stderr.trim()}`
      );
    }
    if (!existsSync(mp3Path)) {
      throw new Error(`edge-tts terminou sem gerar ${mp3Path} na cena ${scene.id}.`);
    }

    durations[scene.id] = await probeDuration(ffprobe, mp3Path);
    synthesized++;
  }

  // Escreve durations.json (ou durations-short.json) com indentacao legivel.
  await writeFile(durationsPath, JSON.stringify(durations, null, 2) + "\n", "utf8");

  console.log(
    `\nOK: ${synthesized} sintetizadas, ${skipped} reaproveitadas. Duracoes em ${durationsName}.`
  );
}

main().catch((err) => {
  console.error(`\nERRO gen_tts: ${err.message}`);
  process.exit(1);
});
