import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createSticker } from "@/src/services/media.js";
import { db } from "@/src/core/database.js";

const execFileAsync = promisify(execFile);

export function getFfmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const localBin = path.join(process.cwd(), "bin", "ffmpeg");
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  const localBinWin = path.join(process.cwd(), "bin", "ffmpeg.exe");
  if (fs.existsSync(localBinWin)) {
    return localBinWin;
  }
  for (const sysPath of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(sysPath)) {
      return sysPath;
    }
  }
  return "ffmpeg";
}

const ASSETS_DIR = path.join(process.cwd(), "assets", "brat");
const BRAT_FONT_PATH = path.join(ASSETS_DIR, "ArialNarrow.ttf");
const BRAT_FONT_URL =
  "https://raw.githubusercontent.com/Arifzyn19/brat-generator/master/src/fonts/arialnarrow.ttf";

export const TEMPLATES = {
  classic: {
    isClassic: true,
    width: 512,
    height: 512,
    safeZone: { a: 40, b: 472, c: 40, d: 472 },
  },
  vermeil: {
    localPath: path.join(ASSETS_DIR, "Vermile.jpg"),
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Vermile.jpg",
    width: 1254,
    height: 1254,
    safeZone: { a: 655, b: 1118, c: 282, d: 993 },
    stroke: true,
  },
  gojo: {
    localPath: path.join(ASSETS_DIR, "Gojo.jpeg"),
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg",
    width: 1254,
    height: 1254,
    safeZone: { a: 660, b: 1180, c: 270, d: 990 },
    stroke: true,
  },
};

const TEXT_STYLE = {
  fontFamily: "Arial Narrow",
  maxFontSize: 90,
  growMaxFontSize: 200,
  minFontSize: 14,
  lineHeight: 1.18,
  color: "#111111",
  strokeColor: "rgba(255, 255, 255, 0.9)",
  align: "justify",
};

const VIDEO_CONFIG = {
  fps: 15,
  width: 512,
  height: 512,
  lyric: {
    maxWordPerLayer: 5,
    frameDuration: 0.5,
    lastFrameDuration: 1.5,
  },
};

export const MAX_BRAT_STATIC_LENGTH = 100;
export const MAX_BRAT_VIDEO_LENGTH = 50;
export const MAX_BRAT_VIDEO_WORDS = 10;

const DOWNLOAD_TIMEOUT_MS = 15000;
const DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;

function isFontBuffer(buf) {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return true;
  const head = buf.subarray(0, 4).toString("ascii");
  return head === "OTTO" || head === "wOF2" || head === "wOFF";
}

function isImageBuffer(buf) {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return true;
  }
  return false;
}

async function downloadValidated(url, validate, label) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > DOWNLOAD_MAX_BYTES) {
        throw new Error("ukuran file tidak wajar");
      }
      if (!validate(buf)) {
        throw new Error("isi file bukan format yang diharapkan (kemungkinan halaman error)");
      }
      return buf;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Gagal download ${label}: ${lastErr?.message || lastErr}`);
}

let fontReadyPromise = null;

export async function ensureFont() {
  if (!fontReadyPromise) {
    fontReadyPromise = (async () => {
      if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
      }
      let needDownload = true;
      if (fs.existsSync(BRAT_FONT_PATH)) {
        try {
          const existing = await fsp.readFile(BRAT_FONT_PATH);
          if (isFontBuffer(existing)) {
            needDownload = false;
          } else {
            await fsp.unlink(BRAT_FONT_PATH).catch(() => {});
          }
        } catch {
          needDownload = true;
        }
      }
      if (needDownload) {
        const buf = await downloadValidated(BRAT_FONT_URL, isFontBuffer, "font brat");
        await fsp.writeFile(BRAT_FONT_PATH, buf);
      }
      GlobalFonts.registerFromPath(BRAT_FONT_PATH, TEXT_STYLE.fontFamily);
    })().catch((err) => {
      fontReadyPromise = null;
      throw new Error(`Font brat tidak tersedia: ${err.message}`);
    });
  }
  return fontReadyPromise;
}

export async function loadTemplateImage(template) {
  if (template.isClassic) return null;

  if (template.localPath && fs.existsSync(template.localPath)) {
    try {
      const local = await fsp.readFile(template.localPath);
      if (!isImageBuffer(local)) throw new Error("file template korup");
      return await loadImage(local);
    } catch {
      await fsp.unlink(template.localPath).catch(() => {});
    }
  }

  if (template.url) {
    const buf = await downloadValidated(template.url, isImageBuffer, "template brat");
    if (template.localPath) {
      try {
        await fsp.writeFile(template.localPath, buf);
      } catch (_) {}
    }
    return await loadImage(buf);
  }

  throw new Error("Template gambar tidak ditemukan");
}

export function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenizeLine(line) {
  return normalizeText(line)
    .replace(/[,，]/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function splitIntoLayers(tokens, maxWordPerLayer) {
  if (!Number.isFinite(maxWordPerLayer) || maxWordPerLayer <= 0) {
    return [tokens];
  }
  const layers = [];
  for (let i = 0; i < tokens.length; i += maxWordPerLayer) {
    layers.push(tokens.slice(i, i + maxWordPerLayer));
  }
  return layers;
}

function resolveDurations(frames, lyric) {
  return frames.map((frame) => {
    return frame.isLastInLayer
      ? Math.max(0.05, lyric.lastFrameDuration)
      : Math.max(0.05, lyric.frameDuration);
  });
}

export function buildRevealFrames(text, configObj = VIDEO_CONFIG) {
  const segments = normalizeText(text)
    .split("\n")
    .map((line) => tokenizeLine(line))
    .filter((tokens) => tokens.length > 0);
  if (!segments.length) return [];

  const frames = [];
  let current = "";
  for (const segment of segments) {
    const layers = splitIntoLayers(segment, configObj.lyric.maxWordPerLayer);
    for (const layer of layers) {
      for (let i = 0; i < layer.length; i++) {
        current += (current ? " " : "") + layer[i];
        frames.push({
          text: current,
          isLastInLayer: i === layer.length - 1,
        });
      }
    }
  }

  const durations = resolveDurations(frames, configObj.lyric);
  return frames.map((frame, index) => ({
    ...frame,
    duration: durations[index],
  }));
}

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2,
  };
}

function setFont(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }

  if (current) {
    parts.push(current);
  }
  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function wrapText(ctx, text, maxWidth) {
  return text
    .split("\n")
    .flatMap((paragraph) => {
      const clean = paragraph.trim();
      if (!clean) {
        return [""];
      }
      return wrapParagraph(ctx, clean, maxWidth);
    });
}

function measureFit(ctx, text, rect, size) {
  setFont(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const totalHeight = lines.length * lineHeight;
  return { size, lines, lineHeight, totalHeight, fits: totalHeight <= rect.h };
}

function fitText(ctx, text, rect) {
  let best = null;
  for (let size = TEXT_STYLE.minFontSize; size <= TEXT_STYLE.growMaxFontSize; size += 2) {
    const fit = measureFit(ctx, text, rect, size);
    if (!fit.fits) break;
    best = fit;
  }
  if (best) return best;

  const size = TEXT_STYLE.minFontSize;
  setFont(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }
    clipped[clipped.length - 1] = `${last}...`;
  }

  return {
    size,
    lines: clipped,
    lineHeight,
    totalHeight: clipped.length * lineHeight,
  };
}

function strokeLine(ctx, line, x, y, size) {
  ctx.save();
  ctx.strokeStyle = TEXT_STYLE.strokeColor;
  ctx.lineWidth = Math.max(2, Math.round(size / 14));
  ctx.lineJoin = "round";
  ctx.strokeText(line, x, y);
  ctx.restore();
}

function drawJustifiedLine(ctx, line, x, y, maxWidth, useStroke, size) {
  const words = line.split(" ").filter(Boolean);
  if (words.length <= 1) {
    if (useStroke) strokeLine(ctx, line, x, y, size);
    ctx.fillText(line, x, y);
    return;
  }
  const widths = words.map((w) => ctx.measureText(w).width);
  const wordsWidth = widths.reduce((a, b) => a + b, 0);
  const gap = (maxWidth - wordsWidth) / (words.length - 1);
  let cx = x;
  for (let i = 0; i < words.length; i++) {
    if (useStroke) strokeLine(ctx, words[i], cx, y, size);
    ctx.fillText(words[i], cx, y);
    cx += widths[i] + gap;
  }
}

function drawCenteredText(ctx, text, zone, options = {}) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFont(ctx, fitted.size);
  ctx.fillStyle = options.color || TEXT_STYLE.color;
  ctx.textBaseline = "top";

  const align = options.align || TEXT_STYLE.align;
  const useStroke = options.stroke ?? zone.stroke ?? false;

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    const isLastLine = index === fitted.lines.length - 1;
    if (align === "justify" && !isLastLine) {
      ctx.textAlign = "left";
      drawJustifiedLine(ctx, line, rect.x, y, rect.w, useStroke, fitted.size);
      return;
    }
    ctx.textAlign = align === "justify" ? "left" : align;
    if (useStroke) strokeLine(ctx, line, align === "justify" ? rect.x : rect.centerX, y, fitted.size);
    ctx.fillText(line, align === "justify" ? rect.x : rect.centerX, y);
  });

  ctx.restore();
}

async function renderBratCanvas(image, text, template, options = {}) {
  const width = template.width || 512;
  const height = template.height || 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (template.isClassic) {
    ctx.fillStyle = options.bgColor || "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  } else if (image) {
    ctx.drawImage(image, 0, 0, width, height);
  }

  drawCenteredText(ctx, text, template.safeZone, options);
  return canvas;
}

export async function createBratImage(text, template, options = {}) {
  await ensureFont();
  const image = await loadTemplateImage(template);
  const canvas = await renderBratCanvas(image, text, template, options);
  return await canvas.encode("png");
}

function escapeConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildManifest(frames, framePaths) {
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    lines.push(`file '${escapeConcatPath(framePaths[i])}'`);
    lines.push(`duration ${frames[i].duration}`);
  }
  lines.push(`file '${escapeConcatPath(framePaths[framePaths.length - 1])}'`);
  return lines.join("\n");
}

async function encodeVideo(concatPath, outputPath, configObj) {
  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatPath,
    "-vf", `fps=${configObj.fps},scale=${configObj.width}:${configObj.height}:flags=lanczos`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "30",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ];

  const ffmpegCmd = getFfmpegPath();
  await execFileAsync(ffmpegCmd, args, {
    maxBuffer: 1024 * 1024 * 10,
    timeout: 30000,
    killSignal: "SIGKILL",
  });
}

export async function createBratVideo(text, template, options = {}) {
  await ensureFont();
  const frames = buildRevealFrames(text, VIDEO_CONFIG);
  if (!frames.length) {
    throw new Error("Teks kosong untuk membuat video stiker");
  }

  const cacheBase = path.join(process.cwd(), "assets", "cache");
  if (!fs.existsSync(cacheBase)) {
    try { fs.mkdirSync(cacheBase, { recursive: true }); } catch (_) {}
  }
  const tmpDir = await fsp.mkdtemp(path.join(cacheBase, "bratvid-"));
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    const image = await loadTemplateImage(template);

    const framePaths = frames.map((_, index) => {
      return path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
    });

    for (let index = 0; index < frames.length; index++) {
      const canvas = await renderBratCanvas(image, frames[index].text, template, options);
      const buf = await canvas.encode("png");
      await fsp.writeFile(framePaths[index], buf);
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    await fsp.writeFile(concatPath, buildManifest(frames, framePaths));

    await encodeVideo(concatPath, outputPath, VIDEO_CONFIG);
    return await fsp.readFile(outputPath);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function sendStickerBuffer(sock, msg, buffer) {
  const activeSettings = db.getSettings();
  const stickerBuffer = await createSticker(buffer, {
    pack: activeSettings.stickerPackName,
    author: activeSettings.stickerAuthor,
  });

  await sock.sendMessage(
    msg.key.remoteJid,
    {
      sticker: stickerBuffer,
      mimetype: "image/webp",
    },
    { quoted: msg }
  );
}

export function showBratGuide(prefix) {
  const p = prefix || ".";
  return (
    `🌿 *BRAT STICKER GENERATOR*\n\n` +
    `• *${p}brat <teks>* : Stiker Brat Classic\n` +
    `• *${p}brat --green <teks>* : Stiker Brat Warna Hijau\n` +
    `• *${p}bratvid <teks>* : Stiker Brat Video Animasi\n` +
    `• *${p}bratgojo <teks>* : Stiker Brat Tema Gojo\n` +
    `• *${p}bratgojovid <teks>* : Stiker Brat Gojo Animasi Video\n` +
    `• *${p}bratvermeil <teks>* : Stiker Brat Tema Vermeil\n` +
    `• *${p}bratvermeilvid <teks>* : Stiker Brat Vermeil Animasi Video\n\n` +
    `💡 *Contoh:*\n` +
    `*${p}brat party girl*\n` +
    `*${p}bratgojo halo kawan*`
  );
}

const VIDEO_FLAGS = new Set(["--video", "--vid"]);
const GREEN_FLAGS = new Set(["--green", "-g"]);

export function parseBratArgs(args, { allowVideo = false, allowGreen = false } = {}) {
  const tokens = String(args?.join(" ") || "").split(/\s+/).filter(Boolean);
  let isVideo = false;
  let bgColor = "#FFFFFF";
  const words = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (allowVideo && VIDEO_FLAGS.has(lower)) {
      isVideo = true;
      continue;
    }
    if (allowGreen && GREEN_FLAGS.has(lower)) {
      bgColor = "#8ACE00";
      continue;
    }
    words.push(token);
  }

  return { text: normalizeText(words.join(" ")), isVideo, bgColor };
}

export function countWords(text) {
  return tokenizeLine(text).length;
}

export function validateBratText(text, isVideo) {
  if (isVideo) {
    if (text.length > MAX_BRAT_VIDEO_LENGTH) {
      return {
        ok: false,
        error:
          `⚠️ *Kalimat Terlalu Panjang!*\n\n` +
          `Maksimal *${MAX_BRAT_VIDEO_LENGTH} karakter* dan *${MAX_BRAT_VIDEO_WORDS} kata* untuk stiker Brat Video.\n` +
          `Teks Anda: *${text.length} karakter, ${countWords(text)} kata*.\n\n` +
          `💡 _Tips: Gunakan kalimat yang lebih ringkas agar animasi stiker berjalan mulus!_`,
      };
    }
    if (countWords(text) > MAX_BRAT_VIDEO_WORDS) {
      return {
        ok: false,
        error:
          `⚠️ *Terlalu Banyak Kata!*\n\n` +
          `Maksimal *${MAX_BRAT_VIDEO_WORDS} kata* untuk stiker Brat Video agar tidak terpotong.\n` +
          `Teks Anda: *${countWords(text)} kata*.\n\n` +
          `💡 _Tips: Gunakan kalimat yang lebih ringkas agar animasi stiker berjalan mulus!_`,
      };
    }
    return { ok: true };
  }
  if (text.length > MAX_BRAT_STATIC_LENGTH) {
    return {
      ok: false,
      error:
        `⚠️ *Teks Terlalu Panjang!*\n\n` +
        `Maksimal *${MAX_BRAT_STATIC_LENGTH} karakter* untuk stiker Brat gambar agar teks pas dan terbaca rapi.\n` +
        `Panjang teks Anda: *${text.length} karakter*.\n\n` +
        `💡 _Tips: Gunakan teks yang lebih padat._`,
    };
  }
  return { ok: true };
}
