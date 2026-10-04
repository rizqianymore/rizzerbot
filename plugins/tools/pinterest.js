import { searchPinterest, scrapeWebImages } from "@/src/services/images.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default {
  "name": "pinterest",
  "aliases": ["pin","pint"],
  "description": "Cari foto dan wallpaper berkualitas tinggi dari Pinterest",
  "usage": "<kata kunci>",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ").trim();
      if (!query) {
        return reply("❌ Masukkan kata kunci gambar! Contoh: *.pinterest anime aesthetic*");
      }

      await reply(`🔍 Mencari gambar Pinterest untuk *"${query}"*...`);

      try {
        const results = await searchPinterest(query);

        const randomItem = results[Math.floor(Math.random() * Math.min(results.length, 10))];

        const imgBuffer = await fetchBuffer(randomItem.image, { redirect: "follow" });
        const caption =
          `📌 *PINTEREST SEARCH*\n\n` +
          `🏷️ *Judul:* ${randomItem.title.trim()}\n` +
          `👤 *Pinner:* ${randomItem.author}\n` +
          `🔗 *Tautan:* ${randomItem.pin}`;

        await sock.sendMessage(
          msg.key.remoteJid,
          { image: imgBuffer, caption },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mencari di Pinterest: ${err.message}`);
      }
    },
};
