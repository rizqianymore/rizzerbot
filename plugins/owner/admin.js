import { db } from "@/src/core/database.js";
import { settings } from "@/config/settings.js";

export default {
  name: "admin",
  description: "Manajemen Admin Bot.",
  usage: "<add/remove/list> <tag/balas/nomor>",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, getTargetJid }) => {
    const normalizedSender = msg.key.participant || msg.key.remoteJid;
    const normalizedOwner = settings.ownerNumber.replace(/:.*@/, "@");
    const isMainOwner =
      msg.key.fromMe ||
      normalizedSender.replace(/:.*@/, "@").split("@")[0] ===
        normalizedOwner.split("@")[0];

    if (!isMainOwner) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "👑 Perintah ini hanya dapat digunakan oleh Owner Utama!" },
        { quoted: msg }
      );
      return;
    }

    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👑 *MANAJEMEN ADMIN BOT*\n\n` +
                `• *.admin add <tag/balas/nomor>* - Tambah Admin Bot\n` +
                `• *.admin remove <tag/balas/nomor>* - Hapus Admin Bot\n` +
                `• *.admin list* - List Admin Bot aktif`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "list") {
      const admins = db.data.settings.admins || [];
      if (admins.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "👑 Belum ada Admin Bot tambahan yang terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `👑 *DAFTAR ADMIN BOT AKTIF (${admins.length})*\n\n`;
      admins.forEach((admin, i) => {
        textList += `${i + 1}. @${admin.split("@")[0]}\n`;
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList, mentions: admins },
        { quoted: msg }
      );
      return;
    }

    const target = getTargetJid(args.slice(1));
    if (!target) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna." },
        { quoted: msg }
      );
      return;
    }

    if (!db.data.settings.admins) {
      db.data.settings.admins = [];
    }

    const targetNum = target.split("@")[0];

    if (action === "add") {
      if (db.data.settings.admins.includes(target)) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⚠️ @${targetNum} sudah menjadi Admin Bot.`,
            mentions: [target],
          },
          { quoted: msg }
        );
        return;
      }

      db.data.settings.admins.push(target);
      db.updatePrivilegedCache();
      db.save();

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👑 Berhasil menambahkan @${targetNum} sebagai Admin Bot.`,
          mentions: [target],
        },
        { quoted: msg }
      );
    } else if (action === "remove" || action === "del") {
      const index = db.data.settings.admins.indexOf(target);
      if (index === -1) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⚠️ @${targetNum} tidak ditemukan di daftar Admin Bot.`,
            mentions: [target],
          },
          { quoted: msg }
        );
        return;
      }

      db.data.settings.admins.splice(index, 1);
      db.updatePrivilegedCache();
      db.save();

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👑 Berhasil menghapus @${targetNum} dari daftar Admin Bot.`,
          mentions: [target],
        },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Aksi tidak valid! Gunakan: add, remove, atau list." },
        { quoted: msg }
      );
    }
  },
};
