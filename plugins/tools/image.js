import { searchPinterest, scrapeWebImages } from "@/src/services/images.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default {
  "name": "image",
  "aliases": ["gimage","img","gambar"],
  "description": "Scrape dan cari gambar beresolusi tinggi langsung dari web",
  "usage": "<kata kunci>",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ").trim();
      if (!query) {
        return reply("❌ Masukkan nama gambar yang ingin dicari! Contoh: *.image pemandangan gunung*");
      }

      await reply(`🖼️ Mengunduh gambar untuk *"${query}"*...`);

      try {
        const results = await scrapeWebImages(query, 10);
        if (!results?.length) return reply("❌ Gambar tidak ditemukan untuk kata kunci tersebut.");
        const randomItem = results[Math.floor(Math.random() * results.length)];
        if (!randomItem?.url) return reply("❌ Gambar tidak ditemukan untuk kata kunci tersebut.");

        const imgBuffer = await fetchBuffer(randomItem.url, { redirect: "follow" });
        const caption =
          `🖼️ *WEB IMAGE SEARCH*\n\n` +
          `🏷️ *Judul:* ${randomItem.title}\n` +
          `🌐 *Sumber:* ${randomItem.source || "-"}`;

        await sock.sendMessage(
          msg.key.remoteJid,
          { image: imgBuffer, caption },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mengunduh gambar: ${err.message}`);
      }
    },
};
