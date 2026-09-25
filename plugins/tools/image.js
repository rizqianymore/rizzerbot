import { searchPinterest, scrapeWebImages } from "@/src/services/images.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default [
  {
    name: "pinterest",
    aliases: ["pin", "pint"],
    description: "Cari foto dan wallpaper berkualitas tinggi dari Pinterest",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ").trim();
      if (!query) {
        return reply("❌ Masukkan kata kunci gambar! Contoh: *.pinterest anime aesthetic*");
      }

      await reply(`🔍 Mencari gambar Pinterest untuk *"${query}"*...`);

      try {
        const results = await searchPinterest(query);
        // Ambil acak salah satu gambar dari top results
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
  },
  {
    name: "image",
    aliases: ["gimage", "img", "gambar"],
    description: "Scrape dan cari gambar beresolusi tinggi langsung dari web",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ").trim();
      if (!query) {
        return reply("❌ Masukkan nama gambar yang ingin dicari! Contoh: *.image pemandangan gunung*");
      }

      await reply(`🖼️ Mengunduh gambar untuk *"${query}"*...`);

      try {
        const results = await scrapeWebImages(query, 10);
        const randomItem = results[Math.floor(Math.random() * results.length)];

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
  },
];
