// plugins/owner/addprem.js — perintah "addprem" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "addprem",
  "description": "Tambahkan pengguna premium",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid }) => {
      let jid = null;
      let durationDays = null;

      // 1. Cek quoted message atau mentions terlebih dahulu
      const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid;
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      if (quotedJid && !quotedJid.endsWith("@g.us")) {
        jid = db.normalizeJid(quotedJid);
        const days = parseFloat(args[0]);
        if (!isNaN(days) && days > 0) durationDays = days;
      } else if (mentionedJid) {
        jid = db.normalizeJid(mentionedJid);
        // Cari angka durasi setelah mention
        for (const arg of args) {
          const val = parseFloat(arg);
          if (!isNaN(val) && val > 0 && !arg.includes("@") && arg.replace(/\D/g, "").length < 7) {
            durationDays = val;
            break;
          }
        }
      } else if (args.length > 0) {
        // Mode input via teks: contoh: .addprem 6281234567890 30
        const firstDigits = args[0].replace(/\D/g, "");
        if (firstDigits.length >= 7) {
          jid = db.normalizeJid(args[0]);
          if (args[1]) {
            const days = parseFloat(args[1]);
            if (!isNaN(days) && days > 0) durationDays = days;
          }
        } else {
          // Fallback ke getTargetJid jika ada
          jid = getTargetJid(args);
          const lastArg = args[args.length - 1];
          const days = parseFloat(lastArg);
          if (!isNaN(days) && days > 0 && lastArg.replace(/\D/g, "").length < 7) {
            durationDays = days;
          }
        }
      }

      if (!jid) {
        return reply("❌ Balas pesan user atau masukkan nomor! Contoh:\n• *.addprem 628xxx 30* (30 hari)\n• *.addprem 628xxx* (Permanen)");
      }

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
      if (db.isOwner(jid)) return reply("ℹ️ Owner otomatis memiliki akses Premium selamanya.");
      if (db.isAdmin(jid)) return reply("ℹ️ Admin Bot otomatis memiliki akses Premium selamanya.");

      db.setPremium(jid, true, durationDays);
      reply(`⭐ Berhasil menambahkan *${jid.split("@")[0]}* ke Premium${durationDays ? ` selama ${durationDays} hari` : " (Permanen)"}.`);
    },
};
