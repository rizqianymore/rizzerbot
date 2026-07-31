import { db } from "@/lib/database.js";
import { settings } from "@/config/settings.js";

export default {
  name: "register",
  description: "Mendaftarkan pengguna baru ke sistem bot.",
  usage: "[nama]",
  aliases: ["daftar"],
  category: "User",
  run: async (
    sock,
    msg,
    args,
    { sendTyping, senderJid, userProfile, activePrefix, isOwner }
  ) => {
    const isRegOpen = db.data.settings.registrationOpen !== false;
    if (!isRegOpen && !isOwner) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Pendaftaran pengguna baru sedang ditutup sementara oleh Owner!",
        },
        { quoted: msg }
      );
      return;
    }

    const quotedJid =
      msg.message.extendedTextMessage?.contextInfo?.participant;
    const targetJid = quotedJid || senderJid;

    if (quotedJid && !isOwner) {
      const remoteJid = msg.key.remoteJid;
      let isSenderAdmin = false;
      if (remoteJid.endsWith("@g.us")) {
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) =>
              p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@")
          );
          isSenderAdmin =
            sender?.admin === "admin" || sender?.admin === "superadmin";
        } catch (_) {}
      }
      if (!isSenderAdmin) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: "⚠️ Hanya admin grup atau owner bot yang dapat mendaftarkan orang lain!",
          },
          { quoted: msg }
        );
        return;
      }
    }

    const targetProfile = db.getUser(targetJid);
    if (targetProfile.registered) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⚠️ @${targetJid.split("@")[0]} sudah terdaftar!`,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
      return;
    }

    let regName = args.join(" ");
    if (!regName) {
      if (quotedJid) {
        regName = targetJid.split("@")[0];
      } else {
        regName = msg.pushName || senderJid.split("@")[0];
      }
    }

    if (regName.length > 20) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap masukkan nama yang valid (maksimal 20 karakter).",
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();
    db.updateUser(targetJid, { registered: true, name: regName });
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: `✅ *Pendaftaran Berhasil!*\n\n*Nama:* ${regName}\n*User JID:* @${targetJid.split("@")[0]}\n\nAnda sekarang dapat menggunakan perintah bot. Ketik *${activePrefix}help* untuk melihat daftar perintah!`,
        mentions: [targetJid],
      },
      { quoted: msg }
    );
  },
};
