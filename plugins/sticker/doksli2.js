import fs from "fs";
import path from "path";
import { createSticker } from "@/src/services/fetch/media.js";

const BASE_PATH = path.join(process.cwd(), "assets", "brat", "doksli2.png");
let baseCache = null;

function getBase() {
  if (baseCache) return baseCache;
  try {
    baseCache = fs.readFileSync(BASE_PATH);
  } catch (_) {
    return null;
  }
  return baseCache;
}

export default {
  name: "doksli2",
  aliases: ["doksli2sticker", "ds2", "dokslii"],
  description: "Stiker Doksli 2 + teks meme",
  usage: "[--font=Nama --size=48 --wrap=4 --tengah/--atas/--bawah --justify] [teks]",
  premiumOnly: false,
  cooldownMs: 5000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    let font = "";
    let fontSize = 0;
    let wordsPerLine = 0;
    let position = "";
    let align = "center";
    const textArgs = [];

    for (const a of args) {
      const low = String(a || "").toLowerCase();
      if (low.startsWith("--font=")) {
        font = String(a).slice(7).trim();
        continue;
      }
      if (low.startsWith("--size=")) {
        const n = Number(String(a).slice(7));
        if (Number.isFinite(n) && n >= 12 && n <= 200) fontSize = Math.floor(n);
        continue;
      }
      if (low.startsWith("--wrap=")) {
        const n = Number(String(a).slice(7));
        if (Number.isFinite(n) && n >= 1 && n <= 10) wordsPerLine = Math.floor(n);
        continue;
      }
      if (low === "--tengah" || low === "--middle" || low === "--center") {
        position = "tengah";
        continue;
      }
      if (low === "--atas" || low === "--top") {
        position = "atas";
        continue;
      }
      if (low === "--bawah" || low === "--bottom") {
        position = "bawah";
        continue;
      }
      if (low === "--justify" || low === "--rata") {
        align = "justify";
        continue;
      }
      textArgs.push(a);
    }

    let topText = "";
    let bottomText = "";
    if (!position) position = "bawah";
    if (!font) font = "Impact";
    const maxSize = fontSize > 0 ? fontSize : 60;

    if (textArgs.length > 0) {
      const fullText = textArgs.join(" ").trim();
      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        topText = (parts[0]?.trim() || "").toUpperCase();
        bottomText = (parts.slice(1).join("|")?.trim() || "").toUpperCase();
      } else {
        bottomText = fullText.toUpperCase();
      }
    }

    if (!topText && !bottomText) {
      return reply(
        `*DOKSLI 2 STIKER*\n\n` +
          `Contoh Penggunaan:\n` +
          `• ${currentPrefix}doksli2 kamu lucu 😂\n` +
          `• ${currentPrefix}doksli2 teks atas | teks bawah\n` +
          `• ${currentPrefix}doksli2 --size=64 --tengah KOCAK`
      );
    }

    await sendTyping();
    if (!fs.existsSync(BASE_PATH)) {
      return reply("Gambar sumber Doksli 2 belum ada di server.");
    }

    try {
      const stickerBuffer = await createSticker(getBase(), {
        topText,
        bottomText,
        font,
        fontSize,
        maxSize,
        wordsPerLine,
        position,
        align,
      });

      await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer, mimetype: "image/webp" }, { quoted: msg });
    } catch (err) {
      logger?.error?.(`[Doksli2] gagal: ${err?.message || err}`);
      await reply("Gagal membuat stiker doksli2, coba lagi nanti.");
    }
  },
};
