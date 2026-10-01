// plugins/owner/listsewa.js — perintah "listsewa" (1 file = 1 perintah).
import { listRentals } from "@/src/services/expiry.js";

export default {
  "name": "listsewa",
  "aliases": ["sewalist", "dafarsewa"],
  "description": "Lihat daftar sewa grup aktif",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const groups = listRentals();
      const ids = Object.keys(groups);
      if (!ids.length) return reply("Belum ada data sewa grup.");
      let text = `*Daftar Sewa Grup (${ids.length})*\n\n`;
      for (const gid of ids) {
        const r = groups[gid];
        const sisa = Math.max(0, Math.ceil((r.until - Date.now()) / (24 * 60 * 60 * 1000)));
        text += `• ${gid}\n  Berakhir: ${new Date(r.until).toLocaleString("id-ID")} (sisa ${sisa} hari)\n`;
      }
      await reply(text.trim());
    },
};
