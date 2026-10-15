import axios from "axios";

// Mapping koin umum agar user bisa ketik btc, eth, sol, doge, xrp, dll
const COIN_ALIASES = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  bnb: "binancecoin",
  binance: "binancecoin",
  xrp: "ripple",
  ripple: "ripple",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  ada: "cardano",
  cardano: "cardano",
  trx: "tron",
  tron: "tron",
  ton: "the-open-network",
  shib: "shiba-inu",
  pepe: "pepe",
  sui: "sui",
  near: "near",
  avax: "avalanche-2",
  dot: "polkadot",
  link: "chainlink",
  usdt: "tether",
  usdc: "usd-coin",
};

export default {
  name: "crypto",
  aliases: ["kripto", "harga-crypto", "coingecko", "cointicker"],
  description: "Cek harga realtime cryptocurrency (USD & IDR) serta perubahan 24 jam",
  usage: "[simbol/nama koin] (contoh: .crypto btc atau .crypto sol)",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const currentPrefix = prefix || ".";
    const query = (args[0] || "").toLowerCase().trim();

    // Jika tidak ada argumen, tampilkan ringkasan top coins
    if (!query) {
      try {
        const topCoins = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple", "dogecoin"];
        const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
          params: {
            ids: topCoins.join(","),
            vs_currencies: "usd,idr",
            include_24hr_change: "true",
          },
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });

        const data = res.data;
        let out = `*📊 MARKET CRYPTO TERKINI*\n`;
        out += `_Gunakan \`${currentPrefix}crypto <koin>\` untuk koin spesifik (misal: \`${currentPrefix}crypto btc\`)_\n\n`;

        for (const coin of topCoins) {
          const item = data[coin];
          if (!item) continue;
          const change24 = item.usd_24h_change ?? 0;
          const sign = change24 >= 0 ? "+" : "";
          const icon = change24 >= 0 ? "🟢" : "🔴";
          const formattedUsd = Number(item.usd).toLocaleString("en-US", { maximumFractionDigits: 4 });
          const formattedIdr = Number(item.idr).toLocaleString("id-ID");

          out += `${icon} *${coin.toUpperCase()}*\n`;
          out += `  • USD : $${formattedUsd} (${sign}${change24.toFixed(2)}%)\n`;
          out += `  • IDR : Rp ${formattedIdr}\n\n`;
        }

        return reply(out.trim());
      } catch (err) {
        return reply(`Gagal mengambil data market: ${err.response?.data?.error || err.message}`);
      }
    }

    const coinId = COIN_ALIASES[query] || query;

    try {
      // Fetch data koin spesifik
      const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
        params: {
          ids: coinId,
          vs_currencies: "usd,idr",
          include_24hr_change: "true",
          include_24hr_vol: "true",
          include_last_updated_at: "true",
        },
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });

      const coinData = res.data[coinId];
      if (!coinData) {
        return reply(
          `❌ Koin *"${query}"* tidak ditemukan di CoinGecko.\n` +
            `Coba gunakan alias seperti: \`btc\`, \`eth\`, \`sol\`, \`bnb\`, \`doge\`, \`xrp\`, dsb.`
        );
      }

      const change24 = coinData.usd_24h_change ?? 0;
      const sign = change24 >= 0 ? "+" : "";
      const icon = change24 >= 0 ? "🟢" : "🔴";
      const formattedUsd = Number(coinData.usd).toLocaleString("en-US", { maximumFractionDigits: 6 });
      const formattedIdr = Number(coinData.idr).toLocaleString("id-ID");
      const volUsd = coinData.usd_24h_vol ? Number(coinData.usd_24h_vol).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-";

      let out = `*${icon} CRYPTO PRICE: ${coinId.toUpperCase()}*\n\n`;
      out += `• *Harga USD* : $${formattedUsd}\n`;
      out += `• *Harga IDR* : Rp ${formattedIdr}\n`;
      out += `• *24 Jam*     : ${sign}${change24.toFixed(2)}%\n`;
      out += `• *Volume 24j* : $${volUsd}\n`;
      out += `\n_Sumber: CoinGecko API_`;

      return reply(out);
    } catch (err) {
      return reply(`Gagal mengambil harga crypto: ${err.response?.data?.error || err.message}`);
    }
  },
};
