// plugins/group/revoke.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
import { db } from "@/src/core/database.js";
import { getCachedGroupMeta, invalidateGroupMeta } from "@/src/utils/helper.js";

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

  const botParticipant = meta.participants.find((p) => db.normalizeJid(p.id) === botJid);
  const isBotAdmin = Boolean(
    botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin")
  );

  const userParticipant = meta.participants.find((p) => db.normalizeJid(p.id) === senderJid);
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
  "name": "revoke",
  "aliases": ["resetlink","revokelink"],
  "description": "Mereset link undangan grup dan membuat link baru",
  "usage": "",
  "category": "Group",
  "run": async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      try {
        const newCode = await sock.groupRevokeInvite(ctx.remoteJid);
        const newLink = `https://chat.whatsapp.com/${newCode}`;
        await context.reply(`🔄 *Link undangan grup berhasil di-reset!*\n\nLink baru:\n🔗 ${newLink}`);
      } catch (err) {
        await context.reply(`❌ Gagal mereset link grup: ${err.message}`);
      }
    },
};
