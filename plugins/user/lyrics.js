import { fetchLyrics } from "@/src/services/network/scrape.js";

export default {
  name: "lyrics",
  aliases: ["lirik"],
  description: "Search song lyrics",
  usage: "<judul lagu>",
  premiumOnly: true,
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const query = args.join(" ");
    if (!query) return reply("❌ Masukkan judul lagu! Contoh: *.lyrics adele - hello* atau *.lyrics adele | hello*");
    let artist = "unknown";
    let title = query;
    const delim = query.split(/\s*[|\-–—:]\s*/);
    if (delim.length >= 2) {
      artist = delim[0].trim() || "unknown";
      title = delim.slice(1).join(" ").trim() || query;
    } else {
      const parts = query.split(" ");
      if (parts.length >= 2) {
        artist = parts[0];
        title = parts.slice(1).join(" ");
      }
    }
    await reply("🔍 Mencari lirik...");
    try {
      const lyrics = await fetchLyrics(artist, title);
      await reply(`🎵 *Lirik: ${title}*\n\n${lyrics.slice(0, 3000)}`);
    } catch (_err) {
      await reply(`❌ Lirik tidak ditemukan. Pastikan format: *penyair judul*`);
    }
  },
};
