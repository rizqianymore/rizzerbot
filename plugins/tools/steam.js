import { parseSteamKind, getSteamDeals, fmtSteamDeals, getSteamDealImage } from "@/src/services/steam.js";

export default {
  "name": "steam",
  "aliases": ["steamdeal", "steamdeals", "steamsale", "promosteam"],
  "description": "Promo terbaru Steam (IDR): diskon, terlaris, rilisan baru + gambar",
  "usage": "[promo|top|new]",
  "premiumOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const currentPrefix = prefix || ".";
      const kind = parseSteamKind(args[0]);
      if (!kind) {
        return reply(
          `❌ Kategori tidak dikenal.\n*Gunakan:* \`${currentPrefix}steam promo|top|new\``
        );
      }
      await sendTyping();
      try {
        const deals = await getSteamDeals(kind.key, 8);
        if (!deals.length) return reply("❌ Belum ada data promo saat ini, coba lagi nanti.");
        const text = fmtSteamDeals(kind.title, deals).trim();
        const img = await getSteamDealImage(deals).catch(() => null);
        if (img) {
          if (text.length > 1000) {
            await sock.sendMessage(msg.key.remoteJid, { image: img }, { quoted: msg });
            return reply(text);
          }
          return sock.sendMessage(msg.key.remoteJid, { image: img, caption: text }, { quoted: msg });
        }
        return reply(text);
      } catch (err) {
        return reply(`❌ Gagal memuat promo Steam: ${err.message}`);
      }
    },
};
