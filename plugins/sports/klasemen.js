import { getFootballTable, formatTable } from "@/src/services/sports/espn.js";

export default {
  name: "klasemen",
  aliases: ["klasmn", "tablebola"],
  description: "Klasemen liga sepak bola (EPL, LaLiga, Serie A, Bundesliga, Ligue 1, UCL, UEL)",
  usage: "[liga], cth: epl | seriea",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();
    try {
      const table = await getFootballTable(args?.[0]);
      return reply(formatTable(table));
    } catch (err) {
      return reply(
        `Gagal memuat klasemen: ${err.message}\n\nGunakan: \`${currentPrefix}klasemen [epl|laliga|seriea|bundesliga|ligue1|ucl|uel]\``
      );
    }
  },
};
