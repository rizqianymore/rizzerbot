// plugins/owner/listbot.js — perintah "listbot" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "listbot",
  "aliases": ["bots","subbots"],
  "description": "Melihat daftar bot yang aktif",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, isPrimarySuperOwner, isSubBot, botJid, senderJid }) => {
      const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const list = getSubBotsList();

      if (!list || list.length === 0) {
        return reply("ℹ️ Belum ada sub-bot yang aktif.\nGunakan *.addbot <nomor>* untuk menambahkan bot baru.");
      }

      // Jika yang meminta adalah Owner SubBot (bukan SuperOwner), hanya tampilkan bot yang dia miliki
      const filteredList = isPrimarySuperOwner
        ? list
        : list.filter((b) => {
            const bJid = `${b.number}@s.whatsapp.net`;
            return db.isBotOwner(bJid, senderJid);
          });

      if (filteredList.length === 0) {
        return reply("ℹ️ Tidak ada sub-bot yang terdaftar atas kepemilikan nomor Anda.");
      }

      const lines = [
        `🤖 *DAFTAR BOT AKTIF (${filteredList.length})*\n`
      ];

      for (let i = 0; i < filteredList.length; i++) {
        const b = filteredList[i];
        const statusEmoji = b.status === "online" ? "🟢 Online" : b.status === "connecting" ? "🟡 Menghubungkan" : "🔴 " + b.status;
        const bJid = `${b.number}@s.whatsapp.net`;
        const bSettings = db.getBotSettings(bJid);
        const ownerNum = bSettings.ownerNumber ? bSettings.ownerNumber.split("@")[0] : b.number;
        const mode = bSettings.public === false ? "🔒 Self" : "🌐 Public";

        lines.push(`*${i + 1}. +${b.number}*`);
        lines.push(`   • Status: ${statusEmoji} | Mode: ${mode}`);
        lines.push(`   • Owner: +${ownerNum} | Prefix: \`${bSettings.prefix || "."}\``);
        lines.push(`   • Uptime: ${Math.floor(b.uptime / 60)} menit\n`);
      }

      lines.push(`_Gunakan \`.delbot <nomor>\` untuk mematikan dan menghapus bot._`);
      reply(lines.join("\n"));
    },
};
