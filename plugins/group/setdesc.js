// plugins/group/setdesc.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
import { db } from "@/src/core/database.js";
import { getCachedGroupMeta, invalidateGroupMeta, samePhoneJid } from "@/src/utils/helper.js";

/**
 * Validates group context and checks bot/user admin permissions.
 */
async function getGroupContext(sock, msg, context, { requireUserAdmin = true, requireBotAdmin = false } = {}) {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || !remoteJid.endsWith("@g.us")) {
    await context.reply("❌ Perintah ini hanya dapat digunakan di dalam grup!");
    return null;
  }

  const meta = (await getCachedGroupMeta(sock, remoteJid)) || (await sock.groupMetadata(remoteJid).catch(() => null));
  if (!meta || !Array.isArray(meta.participants)) {
    await context.reply("❌ Gagal mengambil informasi grup WhatsApp.");
    return null;
  }

  const senderJid = context.senderJid;
  const botJid = db.normalizeJid(sock.user?.id);

  const botParticipant = meta.participants.find((p) => samePhoneJid(db.normalizeJid(p.id), botJid));
  const isBotAdmin = Boolean(
    botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin")
  );

  const userParticipant = meta.participants.find((p) => samePhoneJid(db.normalizeJid(p.id), senderJid));
  const isUserAdmin = Boolean(
    context.isOwner ||
    context.isAdmin ||
    (userParticipant && (userParticipant.admin === "admin" || userParticipant.admin === "superadmin"))
  );

  if (requireUserAdmin && !isUserAdmin) {
    await context.reply("❌ Fitur ini hanya untuk Admin Grup, Admin Bot, atau Owner Bot!");
    return null;
  }

  if (requireBotAdmin && !isBotAdmin) {
    await context.reply("❌ Jadikan bot sebagai Admin grup terlebih dahulu untuk menggunakan fitur ini!");
    return null;
  }

  return {
    remoteJid,
    meta,
    participants: meta.participants,
    isBotAdmin,
    isUserAdmin,
  };
}

export default {
  "name": "setdesc",
  "groupOnly": true,
  "groupAdminOnly": true,
  "botAdminOnly": true,
  "aliases": ["setdeskripsi","descgc"],
  "description": "Mengubah deskripsi grup",
  "usage": "<deskripsi baru>",
  "category": "Group",
  "run": async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const newDesc = args.join(" ").trim();
      if (!newDesc) {
        return context.reply("❌ Masukkan deskripsi baru untuk grup! Contoh: *.setdesc Grup diskusi seputar teknologi & bot WhatsApp*");
      }

      try {
        await sock.groupUpdateDescription(ctx.remoteJid, newDesc);
        invalidateGroupMeta(ctx.remoteJid);
        await context.reply("✅ Deskripsi grup berhasil diperbarui!");
      } catch (err) {
        await context.reply(`❌ Gagal mengubah deskripsi grup: ${err.message}`);
      }
    },
};
