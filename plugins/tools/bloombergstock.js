import { getStockTicker } from "@/src/services/stock.js";

export default [
  {
    name: "bloombergstock",
    aliases: ["bloomberg", "stock", "saham", "ticker", "bbg"],
    description: "Pantau harga saham, komoditas emas/minyak, dan crypto secara realtime",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      const input = args.join(" ").trim();
      if (!input) {
        return reply("Contoh: *.bloombergstock GC1:COM* atau *.saham BBCA*");
      }

      try {
        const data = await getStockTicker(input);

        const isPositive = data.priceChange >= 0;
        const trend = isPositive ? "▲" : "▼";
        const sign = isPositive ? "+" : "";

        const formattedPrice =
          typeof data.price === "number"
            ? data.price.toLocaleString("id-ID", { maximumFractionDigits: 2 })
            : data.price;

        const formattedChange =
          typeof data.priceChange === "number"
            ? `${sign}${data.priceChange.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`
            : data.priceChange;

        const formattedPercent =
          typeof data.percentChange === "number"
            ? `${sign}${data.percentChange.toFixed(2)}%`
            : data.percentChange;

        const output =
          `📊 *${data.name}* (\`${data.symbol || data.id}\`)\n` +
          `💰 *${formattedPrice} ${data.currency}*\n` +
          `📈 ${trend} ${formattedChange} (${formattedPercent})`;

        await reply(output);
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
  },
];
