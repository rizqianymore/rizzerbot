import { resolveCategory, getStandings, formatStandings } from "@/src/services/sports/motogp.js";

export default {
  name: "motogpstandings",
  aliases: ["klasemenmotogp", "mgpstandings", "motogpklasemen"],
  description: "Klasemen MotoGP/Moto2/Moto3 per musim",
  usage: "[motogp|moto2|moto3] [tahun], cth: moto2 2025",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();
    try {
      const parts = (args || []).map((a) => String(a).toLowerCase());
      let category = "motogp";
      let year = null;
      for (const p of parts) {
        if (/^\d{4}$/.test(p)) year = Number(p);
        else if (resolveCategory(p)) category = resolveCategory(p);
      }
      const data = await getStandings(year, category);
      return reply(formatStandings(data));
    } catch (err) {
      return reply(
        `Gagal memuat klasemen: ${err.message}\n\nGunakan: \`${currentPrefix}motogpstandings [motogp|moto2|moto3] [tahun]\``
      );
    }
  },
};
