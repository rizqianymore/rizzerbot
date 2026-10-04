import { db } from '@/src/core/database.js';

export default {
  "name": "autotrxch",
  "aliases": ["autochtrx","trxchannel"],
  "description": "Aktifkan atau nonaktifkan auto forward transaksi ke saluran (on/off)",
  "usage": "<on / off>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan auto forward transaksi hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const mode = args[0]?.toLowerCase();
      if (!mode || !["on", "off", "aktif", "mati"].includes(mode)) {
        const cur = db.main().getSettings();
        return reply(
          `ℹ️ Status Auto Post TRX ke Saluran saat ini: *${cur.autoForwardTrxToChannel !== false ? "AKTIF (ON)" : "NONAKTIF (OFF)"}*\n\n` +
          `Gunakan: \`.autotrxch on\` atau \`.autotrxch off\``
        );
      }

      const enabled = mode === "on" || mode === "aktif";
      db.main().updateSettings({ autoForwardTrxToChannel: enabled });
      reply(`✅ Auto-post transaksi ke Saluran sekarang: *${enabled ? "AKTIF (ON)" : "NONAKTIF (OFF)"}*.`);
    },
};
