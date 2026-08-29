import { db } from "@/src/core/database.js";

const pendingConfirmations = new Map();

export default {
  name: "resetdb",
  aliases: ["dbreset", "wipedb"],
  description: "Mereset total database sistem dengan auto-backup dan preservasi otomatis Owner/Bot.",
  usage: "[confirm]",
  example: "resetdb confirm",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { isSuperOwner, senderJid, sendTyping }) => {
    if (!isSuperOwner) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⛔ Perintah ini hanya dapat dieksekusi oleh Super Owner (Utama)!" },
        { quoted: msg }
      );
      return;
    }

    const isConfirmed = args[0]?.toLowerCase() === "confirm";
    const now = Date.now();

    if (!isConfirmed) {
      pendingConfirmations.set(senderJid, now + 30000); // 30 detik TTL

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `⚠️ *PERINGATAN SISTEM: RESET DATABASE TOTAL*\n\n` +
            `Tindakan ini akan:\n` +
            `• Mengosongkan data seluruh user biasa dan histori percakapan.\n` +
            `• Mengosongkan pengaturan grup lama.\n` +
            `• Otomatis mencadangkan (*snapshot backup*) data saat ini ke folder \`database/backups/\`.\n` +
            `• *Menjaga nomor Owner & nomor Bot tetap AKTIF, Terdaftar, dan berstatus Premium.*\n\n` +
            `Ketik: *.resetdb confirm* dalam 30 detik untuk mengeksekusi.`
        },
        { quoted: msg }
      );
      return;
    }

    const expiry = pendingConfirmations.get(senderJid);
    if (!expiry || now > expiry) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⏳ Sesi konfirmasi kedaluwarsa. Silakan ketik *.resetdb* kembali." },
        { quoted: msg }
      );
      return;
    }

    pendingConfirmations.delete(senderJid);
    await sendTyping();

    const botJid = sock.user?.id || null;
    const result = db.resetDatabase(botJid);

    const preservedMentions = result.preservedUsers || [];

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text:
          `✅ *DATABASE SYSTEM BERHASIL DI-RESET*\n\n` +
          `• *Snapshot Backup:* \`${result.backupFile.split("/").pop()}\`\n` +
          `• *Integritas:* Atomic Clean State (Default Enterprise Schema)\n` +
          `• *Akun Terpreservasi & Auto-Aktif:*\n` +
          preservedMentions.map((j) => `  - @${j.split("@")[0]} (Role: Owner/Bot)`).join("\n") +
          `\n\nSeluruh user non-owner telah dihapus dan database siap digunakan kembali.`,
        mentions: preservedMentions,
      },
      { quoted: msg }
    );
  },
};
