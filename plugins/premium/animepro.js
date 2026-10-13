import { searchAnime } from "@/src/services/network/scrape.js";

export default {
  name: "animepro",
  description: "Search anime info (Jikan API)",
  usage: "<judul anime>",
  premiumOnly: true,
  category: "Premium",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const query = args.join(" ");
    if (!query) return reply("Masukkan judul anime! Contoh: *.animepro naruto*");
    await reply("Mencari anime...");
    try {
      const anime = await searchAnime(query);
      const text =
        `*${anime.title}*\n\n` +
        `*Judul JP:* ${anime.titleJp || "-"}\n` +
        `*Tipe:* ${anime.type || "-"}\n` +
        `*Episode:* ${anime.episodes ?? "-"}\n` +
        `*Status:* ${anime.status}\n` +
        `*Skor:* ${anime.score || "-"}\n` +
        `*Genre:* ${anime.genres}\n\n` +
        `${anime.synopsis || "-"}`;
      await sock.sendMessage(msg.key.remoteJid, { image: { url: anime.image }, caption: text }, { quoted: msg });
    } catch (_err) {
      await reply(`Anime tidak ditemukan.`);
    }
  },
};
