import {
  parseSeasonParam,
  getDriversChampionship,
  getConstructorsChampionship,
  fmtDriversStandings,
  fmtConstructorsStandings,
} from "@/src/services/f1.js";

export default {
  name: "f1standings",
  aliases: ["f1klasemen", "standings", "f1points"],
  description: "Klasemen F1 pembalap/konstruktor per musim (sumber: f1api.dev)",
  usage: "[tahun|current] [drivers|constructors], cth: 2024 drivers",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const a0 = (args?.[0] || "").trim();
    const a1 = (args?.[1] || "").trim().toLowerCase();
    await sendTyping();
    try {

      let seasonRaw = "current";
      let typeRaw = "drivers";
      if (a0 && /^(driver|pembalap)/i.test(a0)) typeRaw = "drivers";
      else if (a0 && /^(constructor|konstruktor|team|tim)/i.test(a0)) typeRaw = "constructors";
      else if (a0) seasonRaw = a0;
      if (a1) {
        if (/^(driver|pembalap)/i.test(a1)) typeRaw = "drivers";
        else if (/^(constructor|konstruktor|team|tim)/i.test(a1)) typeRaw = "constructors";
        else if (!a0) seasonRaw = a1;
      }
      if (/^(driver|pembalap|constructor|konstruktor|team|tim)/i.test(seasonRaw)) seasonRaw = "current";

      const season = parseSeasonParam(seasonRaw);
      if (season?.error) {
        return reply(
          `❌ ${season.error}\n\nGunakan: \`${currentPrefix}f1standings [tahun|current] [drivers|constructors]\`\n` +
          `Contoh: \`${currentPrefix}f1standings 2024\`, \`${currentPrefix}f1standings current constructors\``
        );
      }
      const isConstructors = typeRaw === "constructors";
      const data = isConstructors
        ? await getConstructorsChampionship(season)
        : await getDriversChampionship(season);
      return reply(
        isConstructors ? fmtConstructorsStandings(data) : fmtDriversStandings(data)
      );
    } catch (err) {
      return reply(`❌ Gagal memuat klasemen: ${err.message}`);
    }
  },
};
