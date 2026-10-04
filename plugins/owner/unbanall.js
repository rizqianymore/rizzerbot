import { db } from '@/src/core/database.js';

export default {
  "name": "unbanall",
  "aliases": ["unblockall", "bukaall"],
  "description": "Unban semua user yang dibanned",
  "usage": "[confirm]",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] unbanall oleh ${senderJid}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Unban massal hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      const banned = Object.entries(db.data.users || {})
        .filter(([jid, u]) => jid.endsWith("@s.whatsapp.net") && u?.banned && !u?.owner)
        .map(([jid]) => jid);
      const confirm = args.some((a) => ["confirm", "ya", "yes"].includes(String(a).toLowerCase()));
      if (!confirm) {
        return reply(
          `⚠️ *UNBAN SEMUA (${banned.length} user)*\n\n` +
          (banned.length ? `Akan di-unban: ${banned.slice(0, 10).map((j) => `+${j.split("@")[0]}`).join(", ")}${banned.length > 10 ? ` (+${banned.length - 10} lagi)` : ""}\n\n` : `Tidak ada user banned.\n\n`) +
          `_Ketik *.unbanall confirm* untuk lanjut._`
        );
      }
      await sendTyping();
      let ok = 0;
      for (const jid of banned) {
        try {
          await sock.updateBlockStatus(jid, "unblock").catch(() => {});
          db.setBanned(jid, false);
          ok++;
        } catch (_) {}
      }
      logger?.warn?.(`[OwnerCmd] unbanall DIEKSEKUSI oleh ${senderJid}: ${ok}/${banned.length}`);
      reply(`✅ *Unban massal selesai:* ${ok} user dibuka blokirnya.`);
    },
};
