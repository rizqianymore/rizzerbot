// plugins/sports/f1results.js — hasil sesi F1: race/qualy/fp1-3/sprint (f1api.dev).
import {
  parseSeasonParam,
  parseResultType,
  getSessionResult,
  getLastSessionResult,
  fmtSessionResults,
} from "@/src/services/f1.js";

export default {
  name: "f1results",
  aliases: ["f1result", "f1hasil", "f1qualy", "f1raceresults"],
  description: "Hasil balapan/kualifikasi/latihan/sprint F1 per seri",
  usage: "[tahun] <round> [race|qualy|fp1|fp2|fp3|sprint], cth: 2024 1 race",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const [a0 = "", a1 = "", a2 = ""] = (args || []).map((a) => String(a).trim());
    await sendTyping();
    try {
      // ".f1results last race" -> hasil balapan terakhir musim berjalan
      if (/^(last|terakhir)$/i.test(a0)) {
        const type = parseResultType(a1 || "race") || "race";
        const data = await getLastSessionResult(type, 10);
        return reply(fmtSessionResults(data));
      }
      // Tentukan posisi tahun & round (mendukung "2024 1 race" dan "1 race" -> current)
      let seasonRaw = "current";
      let roundRaw = "";
      let typeRaw = "race";
      if (/^\d{4}$/.test(a0) && /^\d+$/.test(a1)) {
        seasonRaw = a0; roundRaw = a1; typeRaw = a2 || "race";
      } else if (/^current$/i.test(a0) && /^\d+$/.test(a1)) {
        seasonRaw = "current"; roundRaw = a1; typeRaw = a2 || "race";
      } else if (/^\d+$/.test(a0)) {
        seasonRaw = "current"; roundRaw = a0; typeRaw = a1 || "race";
      } else {
        return reply(
          `Masukkan tahun & round! Contoh:\n` +
          `• \`${currentPrefix}f1results 2024 1 race\`\n` +
          `• \`${currentPrefix}f1results 2024 1 qualy\`\n` +
          `• \`${currentPrefix}f1results last race\``
        );
      }
      const season = parseSeasonParam(seasonRaw);
      if (season?.error) return reply(`❌ ${season.error}`);
      const type = parseResultType(typeRaw);
      if (!type) {
        return reply(
          `❌ Tipe sesi "${typeRaw}" tidak dikenal.\nPilih: race, qualy, fp1, fp2, fp3, sprint(=sprint/race), sq(=sprint/qualy)`
        );
      }
      const data = await getSessionResult(season, roundRaw, type, 20);
      return reply(fmtSessionResults(data));
    } catch (err) {
      return reply(`❌ Gagal memuat hasil: ${err.message}`);
    }
  },
};
