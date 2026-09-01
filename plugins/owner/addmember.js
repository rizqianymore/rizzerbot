import { db } from "@/src/core/database.js";
import { cleanNumber } from "@/src/utils/helper.js";

export default {
  name: "add",
  description: "Menambahkan nomor baru ke dalam grup.",
  usage: "<nomor hp>",
  category: "Owner",
  groupOnly: true,
  run: async (sock, msg, args, { isOwner, senderJid, sendUsage }) => {
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
        { quoted: msg }
      );
      return;
    }
    try {
      const groupMetadata = await sock.groupMetadata(remoteJid);
      const participants = groupMetadata.participants || [];
      const sender = participants.find(
        (p) => db.normalizeJid(p.id) === senderJid
      );
      const isSenderAdmin =
        sender?.admin === "admin" || sender?.admin === "superadmin" || isOwner;

      if (!isSenderAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!" },
          { quoted: msg }
        );
        return;
      }

      const botJid = sock.user?.id ? db.normalizeJid(sock.user.id) : "";
      const botParticipant = participants.find(
        (p) => db.normalizeJid(p.id) === botJid
      );
      const isBotAdmin =
        botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      let targetNumber = cleanNumber(args[0]);
      if (!targetNumber) {
        await sendUsage();
        return;
      }
      const target = targetNumber + "@s.whatsapp.net";

      await sock.groupParticipantsUpdate(remoteJid, [target], "add");
      await sock.sendMessage(
        remoteJid,
        {
          text: `✅ Berhasil menambahkan @${targetNumber}`,
          mentions: [target],
        },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        { text: "❌ Gagal menambahkan anggota. Pastikan nomor valid atau setelan privasi mereka mengizinkan." },
        { quoted: msg }
      );
    }
  },
};
