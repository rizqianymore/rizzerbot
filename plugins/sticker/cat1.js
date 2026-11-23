import fs from "fs";
import path from "path";
import { createSticker } from "@/src/services/fetch/media.js";

const BASE_PATH = path.join(process.cwd(), "assets", "brat", "cat1.png");
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
  name: "cat1",
  aliases: ["stikercat1", "kucing1"],
  description: "Stiker Kucing Cat 1 + teks meme opsional",
  usage: "[--size=48 --tengah/--atas/--bawah] [teks meme atas | bawah]",
  premiumOnly: false,
  cooldownMs: 3000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
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
    const maxSize = fontSize > 0 ? fontSize : 90;

    if (textArgs.length > 0) {
      const fullText = textArgs.join(" ").trim();
      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        topText = parts[0]?.trim() || "";
        bottomText = parts.slice(1).join("|")?.trim() || "";
      } else {
        const words = fullText.split(/\s+/).filter(Boolean);
        if (words.length >= 3 || fullText.length > 14) {
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(" ");
          const line2 = words.slice(mid).join(" ");
          bottomText = `${line1}\n${line2}`;
        } else {
          bottomText = fullText;
        }
      }
    }

    await sendTyping();
    if (!fs.existsSync(BASE_PATH)) {
      return reply("Gambar sumber Cat 1 tidak ditemukan di server.");
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
        pack: "RizzerBot",
        author: "Cat 1",
      });

      await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer, mimetype: "image/webp" }, { quoted: msg });
    } catch (err) {
      logger?.error?.(`[Cat1] gagal: ${err?.message || err}`);
      await reply("Gagal membuat stiker cat 1, coba lagi nanti.");
    }
  },
};
