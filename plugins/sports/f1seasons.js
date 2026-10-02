// plugins/sports/f1seasons.js — daftar musim F1 (f1api.dev).
import { getSeasons } from "@/src/services/f1.js";

export default {
  name: "f1seasons",
  aliases: ["f1season", "f1musim", "seasons"],
  description: "List musim/kejuaraan F1 dari 1950–sekarang (sumber: f1api.dev)",
  usage: "[jumlah, cth: 5]",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    let limit = parseInt(args?.[0], 10);
    if (Number.isNaN(limit)) limit = 10;
    limit = Math.min(Math.max(limit, 1), 30);
    await sendTyping();
    try {
      const data = await getSeasons(limit, 0);
      const arr = data?.championships || [];
      if (!arr.length) return reply("❌ Data musim tidak ditemukan.");
      let text = `📅 *MUSIM F1 (${arr.length} terbaru)*\n\n`;
      arr.forEach((c) => {
        text += `• *${c.year}* — ${c.championshipName} (\`${c.championshipId}\`)\n`;
      });
      text += `\n💡 Jadwal: \`${currentPrefix}f1races 2024\` | Klasemen: \`${currentPrefix}f1standings 2024\``;
      return reply(text.trim());
    } catch (err) {
      return reply(`❌ Gagal memuat musim: ${err.message}`);
    }
  },
};
