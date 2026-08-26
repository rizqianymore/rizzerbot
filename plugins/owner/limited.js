import { db } from "@/src/core/database.js";

export default {
  name: "limited",
  aliases: ["limitrole", "addlimited", "dellimited"],
  description: "Manajemen Akses Khusus / Role Limited (CCTV & Fitur Sensitif).",
  usage: "<add/remove/list> <tag/balas/nomor>",
  example: "limited add @user",
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping, getTargetJid, activePrefix }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `🔒 *MANAJEMEN ROLE LIMITED (CCTV & PRIVILEGED)*\n\n` +
            `• *${activePrefix}limited add <tag/nomor>* — Beri akses CCTV & fitur khusus\n` +
            `• *${activePrefix}limited remove <tag/nomor>* — Cabut akses\n` +
            `• *${activePrefix}limited list* — Lihat daftar pengguna Limited aktif`,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "list") {
      const limitedArr = db.data.settings.limited || [];
      const userLimited = Object.keys(db.data.users).filter(
        (u) => db.data.users[u].limited
      );
      const allLimited = Array.from(new Set([...limitedArr, ...userLimited]));

      if (allLimited.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "🔒 Belum ada pengguna dengan role *Limited* terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `🔒 *DAFTAR PENGGUNA LIMITED (${allLimited.length})*\n\n`;
      allLimited.forEach((lim, i) => {
        textList += `${i + 1}. @${lim.split("@")[0]}\n`;
      });
      textList += `\n_Pengguna di atas memiliki izin akses monitoring CCTV & fitur khusus._`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList, mentions: allLimited },
        { quoted: msg }
      );
      return;
    }

    const target = getTargetJid(args.slice(1));
    if (!target) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor pengguna." },
        { quoted: msg }
      );
      return;
    }

    const targetNum = target.split("@")[0];

    if (!Array.isArray(db.data.settings.limited)) {
      db.data.settings.limited = [];
    }

    if (action === "add") {
      if (db.data.settings.limited.includes(target) || db.getUser(target).limited) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⚠️ @${targetNum} sudah memiliki role *Limited*.`,
            mentions: [target],
          },
          { quoted: msg }
        );
        return;
      }

      db.data.settings.limited.push(target);
      db.updateUser(target, { limited: true, registered: true });
      db.save();

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `🔒 Berhasil menambahkan @${targetNum} ke dalam *Role Limited* (Akses CCTV & Fitur Sensitif Aktif).`,
          mentions: [target],
        },
        { quoted: msg }
      );
    } else if (action === "remove" || action === "del") {
      const idx = db.data.settings.limited.indexOf(target);
      if (idx > -1) {
        db.data.settings.limited.splice(idx, 1);
      }
      db.updateUser(target, { limited: false });
      db.save();

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `🔒 Berhasil mencabut role *Limited* dari @${targetNum}.`,
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
