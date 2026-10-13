import { createSticker } from "@/src/services/fetch/media.js";
import { db } from "@/src/core/database.js";
import { normalizeText, tokenizeLine } from "./text.js";
import { MAX_BRAT_STATIC_LENGTH, MAX_BRAT_VIDEO_LENGTH, MAX_BRAT_VIDEO_WORDS } from "./config.js";

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
  const tokens = String(args?.join(" ") || "")
    .split(/\s+/)
    .filter(Boolean);
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
