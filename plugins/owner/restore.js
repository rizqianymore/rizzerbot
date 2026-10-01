// plugins/owner/restore.js — perintah "restore" (1 file = 1 perintah).
import fs from "fs";
import path from "path";
import { restoreBackup } from "@/src/services/backup.js";
import { findDownloadableTarget, getMediaBuffer } from "@/src/services/media.js";

export default {
  "name": "restore",
  "description": "Restore sesi + database dari file backup (reply file)",
  "usage": "(reply file backup)",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner, logger }) => {
      logger?.warn?.(`[OwnerCmd] restore oleh ${msg.key.participant || msg.key.remoteJid}`);
      if (!isPrimarySuperOwner) {
        return reply("Perintah restore hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      const target = findDownloadableTarget(msg);
      if (!target) {
        return reply(
          "Reply file backup (.tar.gz) dari perintah backup.\nGunakan: reply file lalu ketik `.restore`"
        );
      }
      await sendTyping();
      await reply("Mengunduh + mengekstrak backup...");
      const tmpFile = path.join(process.cwd(), "temp", `restore-${Date.now()}.tar.gz`);
      try {
        const buf = await getMediaBuffer(sock, target);
        if (!buf?.length) return reply("Gagal mengunduh file backup.");
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
        fs.writeFileSync(tmpFile, buf);
        const { entries } = await restoreBackup(tmpFile);
        fs.rmSync(tmpFile, { force: true });
        await reply(
          `Restore selesai (${entries} entry).\nRestart bot sekarang: ketik \`.restart\``
        );
      } catch (err) {
        try { fs.rmSync(tmpFile, { force: true }); } catch (_) {}
        logger?.warn?.(`[restore] gagal: ${err.message}`);
        return reply(`Restore gagal: ${err.message}`);
      }
    },
};
