import { getMarketOverview, formatOverviewText } from "@/src/services/finance/market/index.js";

export default {
  name: "pasar",
  aliases: ["overview", "marketoverview", "ringkasanpasar", "marketglobal"],
  description: "Ringkasan pasar global: IHSG, USD/IDR, emas, minyak, Bitcoin & Ethereum",
  usage: "",
  premiumOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    try {
      const items = await getMarketOverview();
      return reply(formatOverviewText(items));
    } catch (err) {
      return reply(`Gagal memuat ringkasan pasar: ${err.message}`);
    }
  },
};
