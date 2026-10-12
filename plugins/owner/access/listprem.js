import { db } from '@/src/core/database.js';

export default {
  "name": "listprem",
  "aliases": ["prems","premiums"],
  "description": "Lihat daftar semua user Premium",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      const allPrems = db.getAllPremiumUsers();

      if (allPrems.length === 0) {
        return reply("ℹ️ Belum ada user Premium khusus yang terdaftar.");
      }

      let text = `⭐ *DAFTAR PENGGUNA PREMIUM*\n\n`;
      allPrems.forEach((u, i) => {
        const num = u.jid.split("@")[0];
        const status = u.isPermanent ? "Permanen" : `Hingga ${new Date(u.premiumUntil).toLocaleDateString("id-ID")}`;
        text += `${i + 1}. +${num} _(${status})_\n`;
      });
      text += `\nTotal: ${allPrems.length} premium`;
      reply(text);
    },
};
