// plugins/owner/backup.js — perintah "backup" (1 file = 1 perintah).
import fs from "fs";
import { createBackup, formatBytes } from "@/src/services/backup.js";

export default {
  "name": "backup",
  "description": "Backup sesi + database bot ke file arsip",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner, logger }) => {
      logger?.warn?.(`[OwnerCmd] backup oleh ${msg.key.participant || msg.key.remoteJid}`);
      if (!isPrimarySuperOwner) {
        return reply("Perintah backup hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      await reply("Menyiapkan arsip backup...");
      try {
        const { file, size } = await createBackup();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            document: fs.readFileSync(file),
            mimetype: "application/gzip",
            fileName: file.split("/").pop(),
            caption: `Backup Rizzer Bot (${formatBytes(size)})\nIsi: sesi + database.\nJaga file ini baik-baik, berisi kunci login WhatsApp. Hapus setelah disimpan aman.`,
          },
          { quoted: msg }
        );
        fs.rmSync(file, { force: true });
      } catch (err) {
        logger?.warn?.(`[backup] gagal: ${err.message}`);
        return reply(`Gagal membuat backup: ${err.message}`);
      }
    },
};
