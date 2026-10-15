import fs from "fs";
import path from "path";
import { createSticker } from "@/src/services/fetch/media.js";

const BASE_PATH = path.join(process.cwd(), "assets", "brat", "Doksli.png");
let baseCache = null;

function getBase() {
  if (baseCache) return baseCache;
  baseCache = fs.readFileSync(BASE_PATH);
  return baseCache;
}

export default {
  name: "doksli",
  aliases: ["dokslisticker"],
  description: "Stiker Doksli + teks meme",
  usage: "[--font=Nama --size=48 --wrap=4 --tengah/--atas/--bawah --justify] [teks atas | bawah]",
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
    // Naikkan ukuran maksimum teks agar font besar, tebal, dan jelas
    const maxSize = fontSize > 0 ? 0 : 100;

    if (textArgs.length > 0) {
      const fullText = textArgs.join(" ").trim();
      if (fullText.includes("|")) {
        // Jika ada tanda '|', user sengaja minta format ATAS | BAWAH
        const parts = fullText.split("|");
        topText = parts[0]?.trim() || "";
        bottomText = parts.slice(1).join("|")?.trim() || "";
      } else {
        // Teks tetap di posisi BAWAH (kecuali user set --atas atau --tengah)
        const words = fullText.split(/\s+/).filter(Boolean);
        // Jika teks panjang (>= 3 kata atau > 14 karakter), otomatis bagi menjadi 2 baris di bawah
        // menggunakan newline (\n). Ini mencegah font mengecil karena menyamping.
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
    if (!topText && !bottomText) {
      return reply(
        `*DOKSLI STIKER*\n\nContoh:\n• ${currentPrefix}doksli GASKEUN\n• ${currentPrefix}doksli ATAS | BAWAH\n• ${currentPrefix}doksli --size=64 --tengah HALO`
      );
    }

    await sendTyping();
    if (!fs.existsSync(BASE_PATH)) {
      return reply("Gambar sumber Doksli belum ada di server. Owner: jalankan *git pull* lalu restart bot.");
    }
    try {
      const stickerBuffer = await createSticker(getBase(), { topText, bottomText, font, fontSize, maxSize, wordsPerLine, position, align });
      await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer, mimetype: "image/webp" }, { quoted: msg });
    } catch (err) {
      logger?.error?.(`[Doksli] gagal: ${err?.message || err}`);
      await reply("Gagal membuat stiker doksli, coba lagi nanti.");
    }
  },
};
