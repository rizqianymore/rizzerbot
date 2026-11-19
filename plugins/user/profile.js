import { db } from "@/src/core/database.js";

export default {
  name: "profile",
  aliases: ["cekuser", "userinfo"],
  description: "Cek informasi profil WhatsApp dan status data bot pengguna",
  usage: "[@user / nomor / reply]",
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping, senderJid, getTargetJid, prefix }) => {
    await sendTyping();

    let targetJid = getTargetJid(args) || senderJid;
    targetJid = db.normalizeJid(targetJid);

    const isSelf = targetJid === senderJid;
    const targetUser = db.getUser(targetJid);
    if (!targetUser) return reply("Nomor target tidak valid.");

    const targetAccess = db.getAccess(targetJid);
    const targetIsOwner = targetAccess.owner;
    const targetIsPremium = targetAccess.premium;

    let ppUrl = null;
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, "image");
    } catch (_) {
      ppUrl = null;
    }

    let waStatus = "-";
    let waStatusSetAt = null;
    try {
      const statusRes = await sock.fetchStatus(targetJid);
      if (statusRes?.status) {
        waStatus = statusRes.status;
        waStatusSetAt = statusRes.setAt ? new Date(statusRes.setAt).toLocaleDateString("id-ID") : null;
      }
    } catch (_) {}

    const phoneNum = targetJid.split("@")[0];

    const displayName = targetUser.name || (isSelf ? msg.pushName || "Pengguna" : "Pengguna");

    const regDate = targetUser.createdAt
      ? new Date(targetUser.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";

    const roleText = targetIsOwner ? "Owner" : targetAccess.admin ? "Admin" : targetIsPremium ? "Premium" : "User";
    const statusText = targetUser.banned ? "Banned" : "Aktif";

    let text =
      `┌── PROFIL PENGGUNA\n` +
      `│ Nama: ${displayName}\n` +
      `│ Nomor: +${phoneNum}\n` +
      `│ Role: ${roleText}\n` +
      `│ Status: ${statusText}\n` +
      `│ Terdaftar: ${regDate}\n` +
      `│ Bio: ${waStatus}\n`;

    if (targetUser.profile) {
      text += `│ Catatan: ${targetUser.profile}\n`;
    }
    text += `└──\n\n` +
      `Tautan: wa.me/${phoneNum}\n` +
      `Ketik ${prefix}profile @tag untuk melihat info pengguna lain.`;

    const captionText = text;

    if (ppUrl) {
      try {
        const { fetchBuffer } = await import("@/src/services/network/scrape.js");
        const imgBuffer = await fetchBuffer(ppUrl);
        return await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: imgBuffer,
            caption: captionText,
            mentions: [targetJid],
          },
          { quoted: msg }
        );
      } catch (_) {}
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: captionText,
        mentions: [targetJid],
      },
      { quoted: msg }
    );
  },
};
