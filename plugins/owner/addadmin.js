import { db } from '@/src/core/database.js';

export default {
  "name": "addadmin",
  "description": "Tambahkan admin bot",
  "usage": "<nomor>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan Admin Bot hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addadmin 628xx*");
      if (!jid.endsWith("@s.whatsapp.net") || jid.split("@")[0].replace(/\D/g, "").length < 8) {
        return reply("❌ Target harus nomor WhatsApp asli! Ketik manual nomornya.");
      }
      try {
        const check = await sock.onWhatsApp(jid).catch(() => null);
        if (!(Array.isArray(check) && check.some((r) => r && r.exists))) {
          return reply(`❌ Nomor *${jid.split("@")[0]}* tidak terdaftar di WhatsApp. Pastikan nomornya benar.`);
        }
      } catch (_) {
        return reply("❌ Gagal memverifikasi nomor ke WhatsApp. Coba lagi sebentar.");
      }
      if (db.isOwner(jid)) return reply("ℹ️ Nomor tersebut sudah menjadi Owner (memiliki hak di atas Admin).");
      if (db.isAdmin(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Admin Bot.`);

      db.setAdmin(jid, true);
      reply(`🛡️ Berhasil menjadikan *${jid.split("@")[0]}* sebagai Admin Bot.`);
    },
};
