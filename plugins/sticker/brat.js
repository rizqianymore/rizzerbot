import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { createSticker } from "@/src/services/media.js";
import { db } from "@/src/core/database.js";

const execFileAsync = promisify(execFile);

function getFfmpegPath() {
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

let isFontLoaded = false;

const TEMPLATES = {
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
  },
  gojo: {
    localPath: path.join(ASSETS_DIR, "Gojo.jpeg"),
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg",
    width: 1254,
    height: 1254,
    safeZone: { a: 660, b: 1180, c: 270, d: 990 },
  },
};

const TEXT_STYLE = {
  fontFamily: "Arial Narrow",
  maxFontSize: 90,
  minFontSize: 22,
  lineHeight: 1.18,
  color: "#111111",
  align: "center",
};

const VIDEO_CONFIG = {
  fps: 15,
  width: 512,
  height: 512,
  lyric: {
    maxWordPerLayer: 5,
    frameDuration: 0.7,
    lastFrameDuration: 1.5,
  },
};

async function ensureFont() {
  if (isFontLoaded) return;
  try {
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }
    if (!fs.existsSync(BRAT_FONT_PATH)) {
      const res = await fetch(BRAT_FONT_URL);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(BRAT_FONT_PATH, buf);
      }
    }
    if (fs.existsSync(BRAT_FONT_PATH)) {
      GlobalFonts.registerFromPath(BRAT_FONT_PATH, TEXT_STYLE.fontFamily);
      isFontLoaded = true;
    }
  } catch (err) {
    console.error("[Brat] Font registration error:", err.message);
  }
}

async function loadTemplateImage(template) {
  if (template.isClassic) return null;

  if (template.localPath && fs.existsSync(template.localPath)) {
    return await loadImage(template.localPath);
  }

  if (template.url) {
    const res = await fetch(template.url);
    if (!res.ok) {
      throw new Error(`Gagal download template: ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (template.localPath) {
      try {
        fs.writeFileSync(template.localPath, buf);
      } catch (_) {}
    }
    return await loadImage(buf);
  }

  throw new Error("Template gambar tidak ditemukan");
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
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

function buildRevealFrames(text, configObj) {
  const tokens = tokenize(text);
  const layers = splitIntoLayers(tokens, configObj.lyric.maxWordPerLayer);
  const frames = [];

  for (const layer of layers) {
    let current = "";
    for (let i = 0; i < layer.length; i++) {
      current += (current ? " " : "") + layer[i];
      frames.push({
        text: current,
        isLastInLayer: i === layer.length - 1,
      });
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

function fitText(ctx, text, rect) {
  for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
    setFont(ctx, size);
    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= rect.h) {
      return { size, lines, lineHeight, totalHeight };
    }
  }

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
  ctx.textAlign = options.align || TEXT_STYLE.align;
  ctx.textBaseline = "top";

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    ctx.fillText(line, rect.centerX, y);
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

async function createBratImage(text, template, options = {}) {
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
  await execFileAsync(ffmpegCmd, args, { maxBuffer: 1024 * 1024 * 10 });
}

async function createBratVideo(text, template, options = {}) {
  await ensureFont();
  const frames = buildRevealFrames(text, VIDEO_CONFIG);
  if (!frames.length) {
    throw new Error("Teks kosong untuk membuat video stiker");
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bratvid-"));
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    const image = await loadTemplateImage(template);

    const framePaths = frames.map((_, index) => {
      return path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
    });

    const batchSize = 5;
    for (let start = 0; start < frames.length; start += batchSize) {
      const batch = frames.slice(start, start + batchSize);
      await Promise.all(
        batch.map(async (frame, i) => {
          const index = start + i;
          const canvas = await renderBratCanvas(image, frame.text, template, options);
          const buf = await canvas.encode("png");
          fs.writeFileSync(framePaths[index], buf);
        })
      );
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatPath, buildManifest(frames, framePaths));

    await encodeVideo(concatPath, outputPath, VIDEO_CONFIG);
    const videoBuffer = fs.readFileSync(outputPath);
    return videoBuffer;
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function sendStickerBuffer(sock, msg, buffer) {
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

function showBratGuide(prefix) {
  return (
    `🌿 *BRAT STICKER GENERATOR*\n\n` +
    `• *${prefix}brat <teks>* : Stiker Brat Classic\n` +
    `• *${prefix}brat --green <teks>* : Stiker Brat Warna Hijau\n` +
    `• *${prefix}bratvid <teks>* : Stiker Brat Video Animasi\n` +
    `• *${prefix}bratgojo <teks>* : Stiker Brat Tema Gojo\n` +
    `• *${prefix}bratgojovid <teks>* : Stiker Brat Gojo Animasi Video\n` +
    `• *${prefix}bratvermeil <teks>* : Stiker Brat Tema Vermeil\n` +
    `• *${prefix}bratvermeilvid <teks>* : Stiker Brat Vermeil Animasi Video\n\n` +
    `💡 *Contoh:*\n` +
    `*${prefix}brat party girl*\n` +
    `*${prefix}bratgojo halo kawan*`
  );
}

export default [
  {
    name: "brat",
    aliases: ["bratimg", "brattext", "sbrat"],
    description: "Membuat stiker teks Brat Classic (lokal generator)",
    premiumOnly: true,
    category: "Sticker",
    run: async (sock, msg, args, { reply, prefix }) => {
      let text = args.join(" ").trim();
      if (!text) {
        return reply(showBratGuide(prefix));
      }

      let isVideo = false;
      let bgColor = "#FFFFFF";

      if (text.includes("--vid") || text.includes("--video")) {
        isVideo = true;
        text = text.replace(/--vid|--video/gi, "").trim();
      }

      if (text.includes("--green") || text.includes("-g")) {
        bgColor = "#8ACE00";
        text = text.replace(/--green|-g/gi, "").trim();
      }

      if (!text) {
        return reply(`⚠️ Masukkan teks untuk stiker!\nContoh: \`${prefix}brat Hai semua\``);
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const inputText = normalizeText(text);
        if (isVideo) {
          const videoBuffer = await createBratVideo(inputText, TEMPLATES.classic, { bgColor });
          await sendStickerBuffer(sock, msg, videoBuffer);
        } else {
          const imageBuffer = await createBratImage(inputText, TEMPLATES.classic, { bgColor });
          await sendStickerBuffer(sock, msg, imageBuffer);
        }
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker Brat: ${err.message}`);
      }
    },
  },

  {
    name: "bratvid",
    aliases: ["bratvideo", "bratvid2"],
    description: "Membuat stiker teks Brat video animasi teks berjalan",
    premiumOnly: true,
    category: "Sticker",
    run: async (sock, msg, args, { reply, prefix }) => {
      let text = args.join(" ").trim();
      if (!text) {
        return reply(`⚠️ Masukkan teks!\nContoh: \`${prefix}bratvid lagu baru charli xcx\``);
      }

      let bgColor = "#FFFFFF";
      if (text.includes("--green") || text.includes("-g")) {
        bgColor = "#8ACE00";
        text = text.replace(/--green|-g/gi, "").trim();
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const inputText = normalizeText(text);
        const videoBuffer = await createBratVideo(inputText, TEMPLATES.classic, { bgColor });
        await sendStickerBuffer(sock, msg, videoBuffer);
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker Brat Video: ${err.message}`);
      }
    },
  },

  {
    name: "bratgojo",
    aliases: ["sbratgojo"],
    description: "Membuat stiker Brat versi Gojo Satoru",
    premiumOnly: true,
    category: "Sticker",
    run: async (sock, msg, args, { reply, prefix }) => {
      const text = args.join(" ").trim();
      if (!text) {
        return reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${prefix}bratgojo Halo semuanya\``);
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const inputText = normalizeText(text);
        const imageBuffer = await createBratImage(inputText, TEMPLATES.gojo);
        await sendStickerBuffer(sock, msg, imageBuffer);
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker Brat Gojo: ${err.message}`);
      }
    },
  },

  {
    name: "bratgojovid",
    aliases: ["sbratgojovid"],
    description: "Membuat stiker Brat Gojo video animasi berjalan",
    premiumOnly: true,
    category: "Sticker",
    run: async (sock, msg, args, { reply, prefix }) => {
      const text = args.join(" ").trim();
      if (!text) {
        return reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${prefix}bratgojovid Halo semuanya\``);
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const inputText = normalizeText(text);
        const videoBuffer = await createBratVideo(inputText, TEMPLATES.gojo);
        await sendStickerBuffer(sock, msg, videoBuffer);
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker Brat Gojo Video: ${err.message}`);
      }
    },
  },

  {
    name: "bratvermeil",
    aliases: ["sbratvermeil"],
    description: "Membuat stiker Brat versi Vermeil",
    premiumOnly: true,
    category: "Sticker",
    run: async (sock, msg, args, { reply, prefix }) => {
      const text = args.join(" ").trim();
      if (!text) {
        return reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${prefix}bratvermeil Halo semuanya\``);
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const inputText = normalizeText(text);
        const imageBuffer = await createBratImage(inputText, TEMPLATES.vermeil);
        await sendStickerBuffer(sock, msg, imageBuffer);
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker Brat Vermeil: ${err.message}`);
      }
    },
  },

  {
    name: "bratvermeilvid",
    aliases: ["sbratvermeilvid"],
    description: "Membuat stiker Brat Vermeil video animasi berjalan",
    premiumOnly: true,
    category: "Sticker",
    run: async (sock, msg, args, { reply, prefix }) => {
      const text = args.join(" ").trim();
      if (!text) {
        return reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${prefix}bratvermeilvid Halo semuanya\``);
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const inputText = normalizeText(text);
        const videoBuffer = await createBratVideo(inputText, TEMPLATES.vermeil);
        await sendStickerBuffer(sock, msg, videoBuffer);
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker Brat Vermeil Video: ${err.message}`);
      }
    },
  },
];
