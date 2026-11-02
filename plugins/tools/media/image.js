import { scrapeWebImages } from "@/src/services/fetch/images.js";
import { fetchBuffer } from "@/src/services/network/scrape.js";

export default {
  name: "image",
  aliases: ["gimage", "img", "gambar"],
  description: "Scrape dan cari gambar beresolusi tinggi langsung dari web",
  usage: "<kata kunci>",
  premiumOnly: true,
  cooldownMs: 5000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const query = args.join(" ").trim();
    if (!query) {
      return reply("Masukkan nama gambar yang ingin dicari! Contoh: *.image pemandangan gunung*");
    }

    await reply(`Mengunduh gambar untuk *"${query}"*...`);

    try {
      const results = await scrapeWebImages(query, 15);
      if (!results?.length) return reply("Gambar tidak ditemukan untuk kata kunci tersebut.");
      // try up to 3 random images with fallback
      let imgBuffer = null;
      let chosen = null;
      const shuffled = [...results].sort(() => Math.random() - 0.5);
      for (const item of shuffled.slice(0, 3)) {
        try {
          if (!item?.url) continue;
          const buf = await fetchBuffer(item.url, { redirect: "follow", timeout: 15000, maxBytes: 10 * 1024 * 1024 });
          if (buf && buf.length > 1000) {
            imgBuffer = buf;
            chosen = item;
            break;
          }
        } catch (_) {}
      }
      if (!imgBuffer || !chosen) return reply("Gagal mengunduh gambar, coba kata kunci lain.");
      const caption =
        `*WEB IMAGE SEARCH*\n\n` + `*Judul:* ${chosen.title}\n` + `*Sumber:* ${chosen.source || "-"}\n` + `*Hasil:* ${results.length} ditemukan`;

      await sock.sendMessage(msg.key.remoteJid, { image: imgBuffer, caption }, { quoted: msg });
    } catch (err) {
      await reply(`Gagal mengunduh gambar: ${err.message}`);
    }
  },
};
