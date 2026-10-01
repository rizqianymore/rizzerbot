// plugins/group/infogrup.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
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
  "name": "infogrup",
  "aliases": ["gcinfo","groupinfo"],
  "description": "Menampilkan informasi detail grup WhatsApp saat ini",
  "usage": "",
  "category": "Group",
  "run": async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: false,
        requireBotAdmin: false,
      });
      if (!ctx) return;

      const meta = ctx.meta;
      const totalMembers = ctx.participants.length;
      const adminCount = ctx.participants.filter((p) => p.admin).length;
      const creator = meta.owner ? `@${meta.owner.split("@")[0]}` : "-";
      const creationDate = meta.creation
        ? new Date(meta.creation * 1000).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "-";

      let text = `📋 *INFORMASI GRUP*\n\n`;
      text += `📌 *Nama Grup:* ${meta.subject}\n`;
      text += `🆔 *ID Grup:* ${meta.id}\n`;
      text += `👑 *Pembuat Grup:* ${creator}\n`;
      text += `📅 *Dibuat Pada:* ${creationDate}\n`;
      text += `👥 *Total Member:* ${totalMembers}\n`;
      text += `⭐ *Jumlah Admin:* ${adminCount}\n`;
      text += `🔒 *Izin Kirim Pesan:* ${meta.announce ? "Hanya Admin" : "Semua Member"}\n`;
      text += `✏️ *Izin Edit Info:* ${meta.restrict ? "Hanya Admin" : "Semua Member"}\n\n`;
      text += `📝 *Deskripsi Grup:*\n${meta.desc || "(Tidak ada deskripsi)"}`;

      const mentions = meta.owner ? [meta.owner] : [];

      try {
        const ppUrl = await sock.profilePictureUrl(ctx.remoteJid, "image").catch(() => null);
        if (ppUrl) {
          await sock.sendMessage(
            ctx.remoteJid,
            { image: { url: ppUrl }, caption: text, mentions },
            { quoted: msg }
          );
          return;
        }
      } catch (_) { }

      await sock.sendMessage(
        ctx.remoteJid,
        { text, mentions },
        { quoted: msg }
      );
    },
};
