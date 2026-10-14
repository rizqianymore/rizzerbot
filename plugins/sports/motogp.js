import { getEvents, formatSchedule } from "@/src/services/sports/motogp.js";

export default {
  name: "motogp",
  aliases: ["jadwalmotogp", "gp", "motogpschedule"],
  description: "Jadwal MotoGP (berikutnya/terakhir atau semua seri)",
  usage: "[next|all|tahun], cth: all | 2025",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    await sendTyping();
    try {
      const a0 = String(args?.[0] || "").toLowerCase();
      let mode = "next";
      let year = null;
      if (a0 === "all" || a0 === "semua") mode = "all";
      else if (/^\d{4}$/.test(a0)) {
        year = Number(a0);
        mode = "all";
      }
      const data = await getEvents(year);
      return reply(formatSchedule(data, mode));
    } catch (err) {
      return reply(`Gagal memuat jadwal: ${err.message}\n\nGunakan: \`${currentPrefix}motogp [next|all|tahun]\``);
    }
  },
};
