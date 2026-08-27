import { db } from "@/src/core/database.js";

export default {
  name: "admin",
  description: "Manajemen Admin Bot resmi.",
  usage: "<add/remove/list> <tag/balas/nomor>",
  example: "admin add @user",
  category: "Owner",
  superOwnerOnly: true,
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping, getTargetJid, activePrefix }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `👑 *MANAJEMEN ADMIN BOT*\n\n` +
            `• *${activePrefix}admin add <tag/nomor>* — Tambah Admin Bot\n` +
            `• *${activePrefix}admin remove <tag/nomor>* — Hapus Admin Bot\n` +
            `• *${activePrefix}admin list* — Daftar Admin Bot aktif`,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "list") {
      const admins = db.data?.settings?.admins || [];
      if (admins.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "👑 Belum ada Admin Bot tambahan yang terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `👑 *DAFTAR ADMIN BOT (${admins.length})*\n\n`;
      admins.forEach((admin, i) => {
        textList += `${i + 1}. @${admin.split("@")[0]}\n`;
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList.trim(), mentions: admins },
        { quoted: msg }
      );
      return;
    }

    const target = getTargetJid(args.slice(1));
    if (!target) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tag, balas pesan, atau tentukan nomor pengguna." },
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
            text: `⚠️ @${targetNum} sudah terdaftar sebagai Admin Bot.`,
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
          text: `👑 Berhasil mengangkat @${targetNum} sebagai Admin Bot.`,
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
            text: `⚠️ @${targetNum} tidak ada di dalam daftar Admin Bot.`,
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
          text: `👑 Berhasil mencabut status Admin Bot dari @${targetNum}.`,
          mentions: [target],
        },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Aksi tidak valid! Gunakan: *add*, *remove*, atau *list*." },
        { quoted: msg }
      );
    }
  },
};
