// plugins/owner/addbot.js — perintah "addbot" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "addbot",
  "aliases": ["jadibot","pairbot"],
  "description": "Tambahkan bot baru (sub-bot) via pairing code",
  "usage": "<nomor whatsapp>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, logger, getTargetJid }) => {
      logger?.warn?.(`[OwnerCmd] addbot oleh ${senderJid} via ${db.normalizeJid(sock.user?.id)}`);
      await sendTyping();

      // Pengecekan: Akun Sub-Bot atau nomor sub-bot dilarang menambahkan bot lagi
      const { isSubBotSocket, isSubBotNumber } = await import("@/src/services/subbot/subbot.js");
      if (isSubBotSocket(sock) || isSubBotNumber(senderJid)) {
        return reply(
          "❌ *Akses Ditolak!*\n\n" +
          "Akun Sub-Bot tidak diizinkan untuk menambahkan bot baru (*.addbot*). Fitur ini hanya dapat digunakan oleh Bot Utama."
        );
      }

      const number = args[0]?.replace(/[^0-9]/g, "");
      if (!number || number.length < 8) {
        return reply("❌ Masukkan nomor WhatsApp untuk dijadikan bot! Contoh: *.addbot 6281234567890 [nomor_owner]*");
      }

      // Tentukan owner untuk bot ini (jika ada argumen kedua atau default ke pemanggil perintah)
      const targetOwner = args[1] ? db.normalizeJid(args[1]) : senderJid;

      await reply(
        `⏳ Menyiapkan sesi bot untuk *${number}*...\n` +
        `👤 *Owner Bot:* +${targetOwner.split("@")[0]}\n` +
        `⚙️ *Mode:* Pengaturan Mandiri (1 Bot 1 Owner, Self/Public & Prefix Terpisah)\n` +
        `Kode pairing akan dikirimkan sebentar lagi.`
      );

      try {
        const { createSubBot } = await import("@/src/services/subbot/subbot.js");
        await createSubBot(number, async (code) => {
          const message =
            `🔑 *KODE PAIRING BOT BARU*\n\n` +
            `📱 *Nomor Bot:* +${number}\n` +
            `👑 *Owner:* +${targetOwner.split("@")[0]}\n` +
            `⚙️ *Mode:* Pengaturan Mandiri (Self/Public/Prefix Terpisah)\n` +
            `⚠️ *Batasan:* Sub-bot tidak dapat menggunakan fitur .addbot\n` +
            `🔐 *Kode Pairing:* *\`${code}\`*\n\n` +
            `_Buka WhatsApp di nomor tersebut > Perangkat Tertaut > Tautkan dengan nomor telepon, lalu masukkan kode di atas._`;
          await reply(message);
        }, targetOwner);
      } catch (err) {
        await reply(`❌ Gagal membuat sub bot: ${err.message}`);
      }
    },
};
