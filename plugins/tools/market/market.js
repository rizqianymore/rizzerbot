import { getQuote, formatQuoteText } from "@/src/services/finance/market/index.js";
import { parseMarketArgs } from "./_args.js";

export default {
  name: "market",
  aliases: ["stockmarket", "hargasaham", "cekstock", "quotesaham"],
  description: "Harga saham, crypto, komoditas & indeks realtime lengkap dengan statistik harian",
  usage: "<simbol> [rentang], cth: BBCA | BTC 1d | TLKM 3mo",
  premiumOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();

    const { query, range } = parseMarketArgs(args, "1d");
    if (!query) {
      return reply(
        `*CEK HARGA PASAR*\n\n` +
          `• \`${currentPrefix}market BBCA\` — saham Indonesia\n` +
          `• \`${currentPrefix}market AAPL\` — saham global\n` +
          `• \`${currentPrefix}market BTC\` — crypto\n` +
          `• \`${currentPrefix}market emas\` — komoditas\n` +
          `• \`${currentPrefix}market ihsg\` — indeks\n\n` +
          `Untuk grafik: \`${currentPrefix}chart <simbol>\``
      );
    }

    try {
      const quote = await getQuote(query, { range });
      return reply(formatQuoteText(quote));
    } catch (err) {
      return reply(
        `Gagal memuat harga *${query}*: ${err.message}\n\n` +
          `Coba \`${currentPrefix}cari ${query}\` untuk melihat simbol yang tersedia.`
      );
    }
  },
};
