import { searchSymbols, formatSearchResults } from "@/src/services/finance/market/index.js";

export default {
  name: "cari",
  aliases: ["carisaham", "cariticker", "stocksearch", "marketsymbol", "ceksimbol"],
  description: "Cari simbol/kode saham, crypto, komoditas, dan indeks yang valid",
  usage: "<kata kunci>, cth: bank bca | nvidia | bitcoin",
  premiumOnly: true,
  cooldownMs: 3000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const query = args.join(" ").trim();
    await sendTyping();

    if (!query) {
      return reply(`Masukkan kata kunci. Contoh: \`${currentPrefix}cari bank bca\``);
    }

    try {
      const results = await searchSymbols(query, { limit: 8 });
      return reply(formatSearchResults(query, results));
    } catch (err) {
      return reply(`Gagal mencari simbol *${query}*: ${err.message}`);
    }
  },
};
