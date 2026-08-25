import { db } from "@/src/core/database.js";

export default {
  name: "user",
  description: "Manajemen pendaftaran dan pemblokiran pengguna.",
  usage: "<ban/unban/register/unregister/list> <tag/balas/nomor> [nama]",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, getTargetJid }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👥 *MANAJEMEN PENGGUNA*\n\n` +
                `• *.user ban <tag/balas/nomor>* - Blokir pengguna\n` +
                `• *.user unban <tag/balas/nomor>* - Buka blokir pengguna\n` +
                `• *.user register <tag/balas/nomor> [nama]* - Daftarkan pengguna secara manual\n` +
                `• *.user unregister <tag/balas/nomor>* - Hapus pendaftaran pengguna\n` +
                `• *.user list* - Statistik pengguna`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "list") {
      const allUsers = Object.keys(db.data.users);
      const registered = allUsers.filter(u => db.data.users[u].registered).length;
      const banned = allUsers.filter(u => db.data.users[u].banned).length;
      const premium = allUsers.filter(u => db.data.users[u].premium).length;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👥 *STATISTIK DATABASE PENGGUNA*\n\n` +
                `• Total Terdaftar: ${registered} pengguna\n` +
                `• Total Premium: ${premium} pengguna\n` +
                `• Total Banned: ${banned} pengguna\n` +
                `• Total Entitas DB: ${allUsers.length} entitas`
        },
        { quoted: msg }
      );
      return;
    }

    // Other actions require a target user
    const target = getTargetJid(args.slice(1));
    if (!target) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⚠️ Harap tentukan pengguna dengan tag, balas pesannya, atau masukkan nomor telepon.` },
        { quoted: msg }
      );
      return;
    }

    const targetNumber = target.split("@")[0];

    if (action === "ban") {
      if (db.isPrivilegedJid(target)) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Tidak dapat memblokir owner atau admin bot!" },
          { quoted: msg }
        );
        return;
      }
      db.updateUser(target, { banned: true });
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `🚫 Berhasil memblokir @${targetNumber} dari akses penggunaan bot.`,
          mentions: [target]
        },
        { quoted: msg }
      );
    } else if (action === "unban") {
      db.updateUser(target, { banned: false });
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ Berhasil membuka blokir untuk @${targetNumber}.`,
          mentions: [target]
        },
        { quoted: msg }
      );
    } else if (action === "register") {
      const name = args.slice(2).join(" ") || `User_${targetNumber}`;
      db.updateUser(target, { registered: true, name });
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ Berhasil mendaftarkan @${targetNumber} dengan nama "${name}".`,
          mentions: [target]
        },
        { quoted: msg }
      );
    } else if (action === "unregister") {
      db.updateUser(target, { registered: false });
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ Pendaftaran untuk @${targetNumber} telah dihapus.`,
          mentions: [target]
        },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Aksi tidak valid! Gunakan: ban, unban, register, unregister, atau list." },
        { quoted: msg }
      );
    }
  }
};
