// plugins/group/add.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
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
  "name": "add",
  "aliases": ["tambah","invite"],
  "description": "Menambahkan / mengundang member ke grup",
  "usage": "628xxx",
  "category": "Group",
  "run": async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const targetJid = context.getTargetJid(args);
      if (!targetJid) {
        return context.reply("❌ Masukkan nomor WhatsApp yang ingin ditambahkan! Contoh: *.add 62812345678*");
      }

      try {
        const response = await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "add");
        invalidateGroupMeta(ctx.remoteJid);

        const status = response?.[0]?.status;
        if (status === "403" || status === "408") {
          // User mengatur privasi grup ke 'Kontak Saya'
          const code = await sock.groupInviteCode(ctx.remoteJid);
          const inviteUrl = `https://chat.whatsapp.com/${code}`;
          await context.reply(
            `⚠️ Tidak dapat menambahkan @${targetJid.split("@")[0]} secara langsung karena pengaturan privasinya.\n\nSilakan bagikan link undangan ini ke user:\n🔗 ${inviteUrl}`
          );
        } else if (status === "409") {
          await context.reply(`ℹ️ User @${targetJid.split("@")[0]} sudah berada di dalam grup.`);
        } else {
          await sock.sendMessage(
            ctx.remoteJid,
            {
              text: `✅ Berhasil menambahkan @${targetJid.split("@")[0]} ke dalam grup.`,
              mentions: [targetJid],
            },
            { quoted: msg }
          );
        }
      } catch (err) {
        await context.reply(`❌ Gagal menambahkan member: ${err.message}`);
      }
    },
};
