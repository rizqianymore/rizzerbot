import { searchPinterest } from "@/src/services/fetch/images.js";
import { fetchBuffer } from "@/src/services/network/scrape.js";

export default {
  name: "pinterest",
  aliases: ["pin", "pint"],
  description: "Cari foto dan wallpaper berkualitas tinggi dari Pinterest",
  usage: "<kata kunci>",
  premiumOnly: true,
  cooldownMs: 5000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const query = args.join(" ").trim();
    if (!query) {
      return reply("Masukkan kata kunci gambar! Contoh: *.pinterest anime aesthetic*");
    }

    await reply(`Mencari gambar Pinterest untuk *"${query}"*...`);

    try {
      const results = await searchPinterest(query);
      if (!results?.length) return reply("Pinterest tidak menemukan hasil untuk kata kunci tersebut.");

      const shuffled = [...results].sort(() => Math.random() - 0.5).slice(0, 3);
      let imgBuffer = null;
      let chosen = null;
      for (const item of shuffled) {
        try {
          if (!item?.image) continue;
          const buf = await fetchBuffer(item.image, { redirect: "follow", timeout: 15000, maxBytes: 10 * 1024 * 1024 });
          if (buf && buf.length > 1000) {
            imgBuffer = buf;
            chosen = item;
            break;
          }
        } catch (_) {}
      }
      if (!imgBuffer || !chosen) return reply("Gagal mengunduh gambar Pinterest, coba lagi.");

      const caption =
        `*PINTEREST SEARCH*\n\n` +
        `*Judul:* ${String(chosen.title || query).trim().slice(0, 200)}\n` +
        `*Pinner:* ${chosen.author || "-"}\n` +
        `*Tautan:* ${chosen.pin || "-"}\n` +
        `*Hasil:* ${results.length} pin`;

      await sock.sendMessage(msg.key.remoteJid, { image: imgBuffer, caption }, { quoted: msg });
    } catch (err) {
      await reply(`Gagal mencari di Pinterest: ${err.message}`);
    }
  },
};
