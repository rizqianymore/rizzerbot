import { db } from "@/src/core/database.js";

export default {
  name: "premium",
  aliases: ["prem"],
  description: "Manajemen Pengguna Premium.",
  usage: "<add/remove/list> <tag/balas/nomor>",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, getTargetJid }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⭐ *MANAJEMEN PENGGUNA PREMIUM*\n\n` +
                `• *.premium add <tag/balas/nomor>* - Tambah Premium\n` +
                `• *.premium remove <tag/balas/nomor>* - Hapus Premium\n` +
                `• *.premium list* - List Pengguna Premium aktif`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "list") {
      const allUsers = Object.keys(db.data.users);
      const premiumUsers = allUsers.filter(u => db.data.users[u].premium);

      if (premiumUsers.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⭐ Belum ada Pengguna Premium tambahan yang terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `⭐ *DAFTAR PENGGUNA PREMIUM (${premiumUsers.length})*\n\n`;
      premiumUsers.forEach((prem, i) => {
        textList += `${i + 1}. @${prem.split("@")[0]}\n`;
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList, mentions: premiumUsers },
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

    const targetNum = target.split("@")[0];

    if (action === "add") {
      const targetProfile = db.getUser(target);
      if (targetProfile.premium) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⚠️ @${targetNum} sudah berstatus Premium.`,
            mentions: [target],
          },
          { quoted: msg }
        );
        return;
      }

      const defaultName = targetProfile.name || targetNum;
      db.updateUser(target, {
        premium: true,
        registered: true,
        name: defaultName,
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⭐ Berhasil menambahkan @${targetNum} ke daftar Premium & otomatis Terdaftar.`,
          mentions: [target],
        },
        { quoted: msg }
      );
    } else if (action === "remove" || action === "del") {
      const targetProfile = db.getUser(target);
      if (!targetProfile.premium) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⚠️ @${targetNum} tidak berada dalam daftar Premium.`,
            mentions: [target],
          },
          { quoted: msg }
        );
        return;
      }

      db.updateUser(target, { premium: false });

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⭐ Berhasil menghapus @${targetNum} dari daftar Premium.`,
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
