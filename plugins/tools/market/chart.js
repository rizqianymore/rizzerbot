import { getQuote, formatQuoteText, renderMarketChart } from "@/src/services/finance/market/index.js";
import { parseMarketArgs, sendChart } from "./_args.js";

export default {
  name: "chart",
  aliases: ["grafik", "candlestick", "stockchart", "marketchart", "chartstock"],
  description: "Grafik candlestick saham, crypto, komoditas & indeks dari Yahoo Finance (gambar langsung jadi)",
  usage: "<simbol> [rentang], cth: BBCA 3mo | BTC 1d | AAPL 1y",
  premiumOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();

    const { query, range } = parseMarketArgs(args, "1mo");
    if (!query) {
      return reply(
        `*GRAFIK PASAR*\n\n` +
          `• \`${currentPrefix}chart BBCA\` — saham IDX (auto .JK)\n` +
          `• \`${currentPrefix}chart BTC 1d\` — crypto intraday\n` +
          `• \`${currentPrefix}chart AAPL 1y\` — saham US\n` +
          `• \`${currentPrefix}chart emas 5y\` — komoditas\n` +
          `• \`${currentPrefix}chart ihsg\` — indeks\n\n` +
          `*Rentang:* 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max`
      );
    }

    try {
      const quote = await getQuote(query, { range });
      const text = formatQuoteText(quote);
      return await sendChart(sock, msg, reply, { quote, text, render: renderMarketChart });
    } catch (err) {
      return reply(
        `Gagal membuat grafik *${query}*: ${err.message}\n\n` +
          `Coba gunakan simbol lengkap, misal \`${currentPrefix}chart BBCA.JK\` atau \`${currentPrefix}cari ${query}\`.`
      );
    }
  },
};
