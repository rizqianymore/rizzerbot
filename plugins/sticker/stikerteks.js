import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { createSticker, addTextToImage, getMediaBuffer, findDownloadableTarget } from "@/src/services/media.js";
import { db } from "@/src/core/database.js";

export default {
  "name": "stikerteks",
  "aliases": ["stikermeme","smeme","stkteks"],
  "description": "Buat stiker dari gambar dengan teks atas/bawah gaya meme",
  "usage": "[teks atas | bawah] (kirim/reply gambar)",
  "premiumOnly": true,
  "category": "Sticker",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const targetMsg = findDownloadableTarget(msg);

      if (!targetMsg) {
        return reply(
          `📌 *Cara Penggunaan ${prefix}stikerteks:*\n\n` +
          `Kirim/balas gambar dengan caption:\n` +
          `• *${prefix}stikerteks Teks Bawah*\n` +
          `• *${prefix}stikerteks Teks Atas | Teks Bawah*\n\n` +
          `💡 Gunakan tanda *|* untuk memisahkan teks atas dan bawah.\n` +
          `_Contoh: ${prefix}stikerteks When you win | but lose yourself_`
        );
      }

      let topText = "";
      let bottomText = "";
      const fullText = args.join(" ").trim();

      if (!fullText) {
        return reply(
          `⚠️ Masukkan teks!\n` +
          `Contoh: \`${prefix}stikerteks Teks Atas | Teks Bawah\`\n` +
          `Atau: \`${prefix}stikerteks Teks Bawah Saja\``
        );
      }

      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        topText = parts[0]?.trim() || "";
        bottomText = parts.slice(1).join("|")?.trim() || "";
      } else {
        bottomText = fullText;
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        const mediaBuffer = await getMediaBuffer(sock, targetMsg);
        if (!mediaBuffer) throw new Error("Gagal membaca media. Coba kirim ulang gambarnya.");

        const activeSettings = db.getSettings();
        const stickerBuffer = await createSticker(mediaBuffer, {
          pack: activeSettings.stickerPackName,
          author: activeSettings.stickerAuthor,
          topText,
          bottomText,
        });

        await sock.sendMessage(
          msg.key.remoteJid,
          { sticker: stickerBuffer },
          { quoted: msg }
        );
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        reply(`❌ Gagal membuat stiker: ${err.message}`);
      }
    },
};
