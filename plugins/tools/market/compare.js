import { getQuote, formatPrice, formatSignedPercent, trendIcon } from "@/src/services/finance/market/index.js";
import { parseMarketArgs } from "./_args.js";

export default {
  name: "banding",
  aliases: ["compare", "vs", "bandingsaham", "comparesaham"],
  description: "Bandingkan 2 simbol pasar (harga, perubahan, rentang)",
  usage: "<simbol1> <simbol2> [rentang], cth: BBCA TLKM 1mo | BTC ETH 1d",
  premiumOnly: true,
  cooldownMs: 5000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();

    // Pisahkan 2 simbol pertama, sisanya rentang
    const symbols = [];
    const rest = [];
    for (const token of args || []) {
      if (symbols.length < 2) symbols.push(token);
      else rest.push(token);
    }

    if (symbols.length < 2) {
      return reply(
        `*BANDINGKAN PASAR*\n\n` +
          `• \`${currentPrefix}banding BBCA TLKM\`\n` +
          `• \`${currentPrefix}banding BTC ETH 1d\`\n` +
          `• \`${currentPrefix}banding AAPL MSFT 3mo\``
      );
    }

    const { range } = parseMarketArgs(rest, "1mo");

    try {
      const [q1, q2] = await Promise.all([
        getQuote(symbols[0], { range }),
        getQuote(symbols[1], { range }),
      ]);

      const lines = [
        `*⚖️ PERBANDINGAN PASAR*`,
        "",
        `${trendIcon(q1.changePercent)} *${q1.name || q1.symbol}* (\`${q1.symbol}\`)`,
        `💵 Harga: ${formatPrice(q1.price, q1)}`,
        `📈 Perubahan: ${formatSignedPercent(q1.changePercent)}`,
        `• Rentang: ${q1.rangeLabel}`,
        "",
        `${trendIcon(q2.changePercent)} *${q2.name || q2.symbol}* (\`${q2.symbol}\`)`,
        `💵 Harga: ${formatPrice(q2.price, q2)}`,
        `📈 Perubahan: ${formatSignedPercent(q2.changePercent)}`,
        `• Rentang: ${q2.rangeLabel}`,
        "",
        `_Sumber: Yahoo Finance_`,
      ];

      return reply(lines.join("\n"));
    } catch (err) {
      return reply(`Gagal membandingkan: ${err.message}`);
    }
  },
};