#!/usr/bin/env node
// compose_final.mjs - Concatena os segmentos finais e produz o master YouTube 16:9.
//
// CONTRATO:
//   node scripts/compose_final.mjs --work <dir> --speed 1.18
//
// Entradas:
//   <work>/config.json          (ordem dos segmentos + dimensoes alvo)
//   <work>/out/<seg>_final.mp4  (gerados por compose.mjs, um por segmento)
// Saida:
//   <work>/out/Video-Demo-YT.mp4
//
// Pipeline: concat demuxer (junta os <seg>_final.mp4 na ordem de config.segmentos)
// -> setpts (acelera o video pelo 'speed') + atempo (acelera o audio na mesma razao,
// preservando pitch) -> loudnorm I=-16 (padrao broadcast/YouTube) -> fade in/out suaves.
//
// POR QUE setpts E atempo juntos: acelerar so o video dessincroniza do audio; ambos
// precisam usar o MESMO fator. setpts divide os timestamps por 'speed' (video mais
// rapido) e atempo multiplica o tempo do audio por 'speed'.

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const FADE = 0.5; // duracao (s) dos fades de entrada e saida

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
const speed = parseFloat(args.speed ?? "1.18");

if (!Number.isFinite(speed) || speed <= 0) {
  console.error(`ERRO: --speed invalido: '${args.speed}'. Use um numero > 0 (ex.: 1.18).`);
  process.exit(1);
}

const configPath = path.join(workDir, "config.json");
const outDir = path.join(workDir, "out");
const masterPath = path.join(outDir, "Video-Demo-YT.mp4");

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

// Mede a duracao total (s) de um mp4 via ffprobe - usada para posicionar o fade-out.
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

// atempo so aceita fatores entre 0.5 e 2.0 por chamada. Para speeds fora disso,
// encadeamos multiplos atempo cujo produto = speed. Aqui speeds tipicos (~1.18)
// cabem numa unica chamada, mas tratamos o caso geral por robustez.
function atempoChain(factor) {
  let remaining = factor;
  const parts = [];
  while (remaining > 2.0) {
    parts.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    parts.push("atempo=0.5");
    remaining /= 0.5;
  }
  parts.push(`atempo=${remaining.toFixed(6)}`);
  return parts.join(",");
}

async function main() {
  const config = await readJson(configPath);
  if (!config || !Array.isArray(config.segmentos)) {
    throw new Error("config.json invalido: faltando array 'segmentos'.");
  }

  await mkdir(outDir, { recursive: true });

  // Ordem dos segmentos = ordem em config.segmentos (campo .seg).
  const segOrder = config.segmentos.map((s) => s.seg);
  const segFiles = [];
  for (const segName of segOrder) {
    const f = path.join(outDir, `${segName}_final.mp4`);
    if (!existsSync(f)) {
      throw new Error(
        `Faltando ${path.relative(workDir, f)}. Rode compose.mjs --seg ${segName} antes.`
      );
    }
    segFiles.push(f);
  }
  if (segFiles.length === 0) {
    throw new Error("Nenhum segmento listado em config.segmentos.");
  }

  // 1) Escreve a lista do concat demuxer. Cada linha: file '<caminho>'.
  // Usamos caminhos relativos a out/ e rodamos o ffmpeg com cwd=out/ para evitar
  // problemas de escaping de path (mesma razao do compose.mjs no Windows).
  const listPath = path.join(outDir, "_concat-yt.txt");
  // O concat demuxer trata a aspa simples de forma especial; nomes aqui sao
  // "<seg>_final.mp4" sem aspas problematicas, entao o formato simples basta.
  const listBody = segFiles
    .map((f) => `file '${path.basename(f)}'`)
    .join("\n");
  await writeFile(listPath, listBody + "\n", "utf8");

  // 2) Concatena de forma rapida (sem reencode) para um arquivo intermediario.
  // Reencodar duas vezes degrada qualidade; entao primeiro concatenamos com -c copy,
  // depois aplicamos os filtros (speed/loudnorm/fade) num unico passe de reencode.
  const concatTmp = path.join(outDir, "_concat-yt.mp4");
  const concatArgs = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    path.basename(listPath),
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    path.basename(concatTmp),
  ];
  console.log(`[concat] juntando ${segFiles.length} segmentos ...`);
  const concatRes = await run("ffmpeg", concatArgs, { cwd: outDir });
  if (concatRes.code !== 0) {
    throw new Error(`ffmpeg concat falhou:\n${concatRes.stderr.trim()}`);
  }

  // 3) Duracao apos o speed para posicionar o fade-out corretamente.
  const rawDuration = await probeDuration(concatTmp);
  const finalDuration = rawDuration / speed;
  const fadeOutStart = Math.max(0, finalDuration - FADE);

  // setpts divide PTS por speed (acelera video). atempo encadeia para o audio.
  const vFilter =
    `setpts=PTS/${speed.toFixed(6)},` +
    `fade=t=in:st=0:d=${FADE},` +
    `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${FADE}`;
  const aFilter =
    `${atempoChain(speed)},` +
    // loudnorm I=-16 LUFS: alvo recomendado para YouTube; TP=-1.5 evita clipping.
    `loudnorm=I=-16:TP=-1.5:LRA=11,` +
    `afade=t=in:st=0:d=${FADE},` +
    `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${FADE}`;

  // Resolucao alvo do master vinda do config (default 1920x1080 conforme contrato).
  const [mw, mh] =
    config.dimensoes && Array.isArray(config.dimensoes.master)
      ? config.dimensoes.master
      : [1920, 1080];

  const masterArgs = [
    "-y",
    "-i",
    path.basename(concatTmp),
    "-vf",
    // Garante a resolucao master exata e fps consistente para upload.
    `${vFilter},scale=${mw}:${mh}:force_original_aspect_ratio=decrease,` +
      `pad=${mw}:${mh}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,
    "-af",
    aFilter,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    path.basename(masterPath),
  ];

  console.log(`[ffmpeg] master YT (speed ${speed}, loudnorm I=-16) ...`);
  const masterRes = await run("ffmpeg", masterArgs, { cwd: outDir });
  if (masterRes.code !== 0) {
    throw new Error(`ffmpeg master falhou:\n${masterRes.stderr.trim()}`);
  }
  if (!existsSync(masterPath)) {
    throw new Error(`ffmpeg terminou sem gerar ${masterPath}.`);
  }

  // Limpa intermediarios (nao deixa lixo na pasta de trabalho).
  await rm(listPath, { force: true });
  await rm(concatTmp, { force: true });

  console.log(`OK: ${path.relative(workDir, masterPath)} (~${finalDuration.toFixed(1)}s)`);
}

main().catch((err) => {
  console.error(`\nERRO compose_final: ${err.message}`);
  process.exit(1);
});
