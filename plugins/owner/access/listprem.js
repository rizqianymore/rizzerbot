import { db } from "@/src/core/database.js";

export default {
  name: "listprem",
  aliases: ["prems", "premiums"],
  description: "Lihat daftar semua user Premium",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply }) => {
    const allPrems = db.getAllPremiumUsers();

    if (allPrems.length === 0) {
      return reply("Belum ada user Premium khusus yang terdaftar.");
    }

    let text =
      `┌── DAFTAR PENGGUNA PREMIUM\n` +
      `│ Total: ${allPrems.length} Pengguna\n` +
      `└──\n\n`;
    allPrems.forEach((u, i) => {
      const num = u.jid.split("@")[0];
      const status = u.isPermanent ? "Permanen" : `Hingga ${new Date(u.premiumUntil).toLocaleDateString("id-ID")}`;
      const isLast = i === allPrems.length - 1;
      const branch = isLast ? "└──" : "├──";
      text += `${branch} +${num} (${status})\n`;
    });
    reply(text.trim());
  },
};
