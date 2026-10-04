import { removeRental } from "@/src/services/expiry.js";

export default {
  "name": "delsewa",
  "aliases": ["sewadel", "hapussewa"],
  "description": "Hapus data sewa grup",
  "usage": "<link/id grup>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      const input = String(args[0] || "").trim();
      if (!input) return reply("Gunakan: `.delsewa <link/id grup>`");
      const m = input.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
      let gid = input;
      if (m) {
        try {
          const info = await sock.groupGetInviteInfo(m[1]);
          gid = info?.id || input;
        } catch (_) {}
      } else if (!gid.endsWith("@g.us")) {
        const digits = gid.replace(/[^0-9]/g, "");
        if (digits.length >= 10) gid = `${digits}@g.us`;
      }
      await sendTyping();
      const ok = removeRental(gid);
      await reply(ok ? `Data sewa ${gid} dihapus.` : `Tidak ada data sewa untuk ${gid}.`);
    },
};
