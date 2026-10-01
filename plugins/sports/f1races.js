// plugins/sports/f1races.js — jadwal & detail balapan F1 (f1api.dev).
import {
  parseSeasonParam,
  getRacesByYear,
  getRaceDetail,
  getCurrentLast,
  getCurrentNext,
  fmtRaceList,
  fmtRaceDetail,
} from "@/src/services/f1.js";

export default {
  name: "f1races",
  aliases: ["f1race", "f1jadwal", "f1schedule", "f1next", "f1last"],
  description: "Jadwal F1 per musim + detail seri / balapan terakhir & berikutnya",
  usage: "[tahun|last|next] [round], cth: 2024 / 2024 1 / next",
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix, commandName }) => {
    const currentPrefix = prefix || ".";
    const cmd = String(commandName || "").toLowerCase();
    const a0 = (args?.[0] || "").trim().toLowerCase();
    const a1 = (args?.[1] || "").trim();
    await sendTyping();
    try {
      if (cmd === "f1next" || a0 === "next") {
        const data = await getCurrentNext();
        return reply(`⏭️ *BALAPAN BERIKUTNYA*\n\n${fmtRaceDetail(data)}`);
      }
      if (cmd === "f1last" || a0 === "last" || a0 === "terakhir") {
        const data = await getCurrentLast();
        return reply(`⏮️ *BALAPAN TERAKHIR*\n\n${fmtRaceDetail(data)}`);
      }
      const seasonRaw = a0 || "current";
      const season = parseSeasonParam(seasonRaw);
      if (season?.error) {
        return reply(
          `❌ ${season.error}\n\nGunakan: \`${currentPrefix}f1races [tahun|current]\` | \`${currentPrefix}f1race <tahun> <round>\` | \`${currentPrefix}f1next\` | \`${currentPrefix}f1last\``
        );
      }
      if (a1 && /^\d+$/.test(a1)) {
        const data = await getRaceDetail(season, a1);
        return reply(fmtRaceDetail(data));
      }
      const data = await getRacesByYear(season);
      let text = fmtRaceList(data);
      text += `\n\n💡 Detail seri: \`${currentPrefix}f1race ${season === "current" ? "current" : season} <round>\` (cth: \`${currentPrefix}f1race 2024 1\`)`;
      return reply(text);
    } catch (err) {
      return reply(`❌ Gagal memuat jadwal: ${err.message}`);
    }
  },
};
