import { getFootballBoard, formatBoard } from "@/src/services/sports/espn.js";

export default {
  name: "bola",
  aliases: ["skorbola", "jadwalbola", "football", "soccer"],
  description: "Skor & jadwal sepak bola (EPL, LaLiga, Serie A, Bundesliga, Ligue 1, UCL, UEL)",
  usage: "[liga], cth: epl | laliga | ucl",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();
    try {
      const board = await getFootballBoard(args?.[0]);
      return reply(formatBoard(board));
    } catch (err) {
      return reply(
        `Gagal memuat skor: ${err.message}\n\nGunakan: \`${currentPrefix}bola [epl|laliga|seriea|bundesliga|ligue1|ucl|uel]\``
      );
    }
  },
};
