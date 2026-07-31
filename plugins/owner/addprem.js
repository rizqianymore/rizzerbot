import { db } from "@/lib/database.js";

export default {
  name: "addprem",
  description: "Menambahkan pengguna ke daftar Premium.",
  usage: "<tag/balas/nomor>",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { getTargetJid }) => {
    const target = getTargetJid(args);
    if (!target) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna." },
        { quoted: msg }
      );
      return;
    }
    const targetProfile = db.getUser(target);
    const defaultName = targetProfile.name || target.split("@")[0];
    db.updateUser(target, {
      premium: true,
      registered: true,
      name: defaultName,
    });
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: `👑 Berhasil menambahkan @${target.split("@")[0]} ke daftar Premium & otomatis Terdaftar`,
        mentions: [target],
      },
      { quoted: msg }
    );
  },
};
