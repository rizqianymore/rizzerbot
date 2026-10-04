import { addRental } from "@/src/services/expiry.js";
import { db } from "@/src/core/database.js";

async function resolveGroupJid(sock, input) {
  const t = String(input || "").trim();
  if (!t) return null;
  if (t.endsWith("@g.us")) return t;
  const m = t.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  if (m) {
    try {
      const info = await sock.groupGetInviteInfo(m[1]);
      if (info?.id?.endsWith("@g.us")) return info.id;
    } catch (_) {}
    return null;
  }
  const digits = t.replace(/[^0-9]/g, "");
  if (digits.length >= 10) return `${digits}@g.us`;
  return null;
}

export default {
  "name": "addsewa",
  "aliases": ["sewaadd", "tambahsewa"],
  "description": "Tambah masa sewa bot di grup",
  "usage": "<link/id grup> <hari>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid }) => {
      const groupJid = await resolveGroupJid(sock, args[0]);
      const days = Number(args[1]);
      if (!groupJid || !Number.isFinite(days) || days <= 0) {
        return reply(
          "Format salah!\nGunakan: `.addsewa <link/id grup> <hari>`\nContoh: `.addsewa https://chat.whatsapp.com/xxxx 30`"
        );
      }
      await sendTyping();
      try {
        const r = addRental(groupJid, days, db.normalizeJid(senderJid));
        await reply(
          `Sewa dicatat.\nGrup: ${groupJid}\nBerakhir: ${new Date(r.until).toLocaleString("id-ID")}`
        );
      } catch (err) {
        return reply(`Gagal: ${err.message}`);
      }
    },
};
