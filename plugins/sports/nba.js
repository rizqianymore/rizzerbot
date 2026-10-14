import { getNbaBoard, formatBoard } from "@/src/services/sports/espn.js";

export default {
  name: "nba",
  aliases: ["skornba", "basket", "basketball"],
  description: "Skor & jadwal NBA",
  usage: "",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    try {
      const board = await getNbaBoard();
      return reply(formatBoard(board));
    } catch (err) {
      return reply(`Gagal memuat skor NBA: ${err.message}`);
    }
  },
};
