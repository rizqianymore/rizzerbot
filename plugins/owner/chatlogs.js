import fs from "fs";
import { getChatLogsList, getChatLogContent } from "@/src/services/chatlogger.js";
import { formatBytes } from "@/src/services/backup.js";

export default {
  "name": "chatlogs",
  "aliases": ["chatlog", "listlogs", "getlogs"],
  "description": "Melihat dan mendownload rekaman log pesan WhatsApp (Hanya Bot Utama)",
  "usage": "[opsional: tanggal / download]",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner, isSubBot, logger }) => {

    if (isSubBot || sock?.isSubBot) {
      return reply("❌ *Akses Ditolak!*\n\nLog pesan chat hanya dapat dibuka dan diakses melalui *Bot Utama*.");
    }

    if (!isPrimarySuperOwner) {
      return reply("❌ Fitur riwayat log pesan hanya dapat diakses oleh *SuperOwner* Bot Utama.");
    }

    await sendTyping();
    const subCmd = (args[0] || "").toLowerCase();

    if (subCmd === "get" || subCmd === "download" || subCmd === "file") {
      const targetDate = args[1];
      const logs = getChatLogsList();
      if (logs.length === 0) {
        return reply("ℹ️ Belum ada log pesan yang tersimpan.");
      }

      const target = targetDate ? getChatLogContent(targetDate) : getChatLogContent(logs[0].file);
      if (!target || !fs.existsSync(target.filePath)) {
        return reply(`❌ File log untuk tanggal/nama \`${targetDate}\` tidak ditemukan.\n\nGunakan \`.chatlogs\` untuk melihat daftar file.`);
      }

      await reply(`Mengirimkan file log \`${target.file}\` (${target.data.length} pesan)...`);
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          document: fs.readFileSync(target.filePath),
          mimetype: "application/json",
          fileName: target.file,
          caption: `*Chat Log WhatsApp*\n• File: ${target.file}\n• Total Pesan: ${target.data.length}\n• Retensi: Otomatis dihapus setelah 3 hari.`,
        },
        { quoted: msg }
      );
    }

    if (subCmd === "read" || subCmd === "view") {
      const targetDate = args[1];
      const logs = getChatLogsList();
      if (logs.length === 0) {
        return reply("Belum ada log pesan yang tersimpan.");
      }

      const target = targetDate ? getChatLogContent(targetDate) : getChatLogContent(logs[0].file);
      if (!target || !target.data) {
        return reply(`File log \`${targetDate || ""}\` tidak ditemukan.`);
      }

      const list = target.data.slice(-15);
      if (list.length === 0) {
        return reply(`File \`${target.file}\` masih kosong.`);
      }

      let text = `*PREVIEW 15 PESAN TERAKHIR (${target.file})*\n\n`;
      list.forEach((item, idx) => {
        const from = item.fromMe ? "Bot" : (item.pushName || item.sender.split("@")[0]);
        const loc = item.isGroup ? "Group" : "Private";
        const content = item.text ? item.text.slice(0, 70) : `[Media: ${item.mediaType || "Unknown"}]`;
        text += `${idx + 1}. [${item.time}] *${from}* (${loc}):\n   ${content}\n\n`;
      });
      text += `_Ketik \`.chatlogs download ${target.file}\` untuk mengambil full file JSON._`;
      return reply(text);
    }

    const logs = getChatLogsList();
    if (logs.length === 0) {
      return reply("ℹ️ Belum ada catatan pesan WhatsApp yang tersimpan saat ini.");
    }

    let message = `📋 *DAFTAR LOG PESAN WHATSAPP (3 HARI TERAKHIR)*\n`;
    message += `_Hanya SuperOwner di Bot Utama yang dapat membuka log ini._\n\n`;

    let totalBytes = 0;
    logs.forEach((item, idx) => {
      totalBytes += item.size;
      message += `*${idx + 1}. ${item.file}*\n`;
      message += `   📅 Tanggal: \`${item.date}\`\n`;
      message += `   📦 Ukuran: ${formatBytes(item.size)}\n\n`;
    });

    message += `📊 *Total Ukuran:* ${formatBytes(totalBytes)}\n\n`;
    message += `*💡 Panduan Perintah:*\n`;
    message += `• \`.chatlogs download <tanggal/file>\` : Kirim file log JSON ke chat ini\n`;
    message += `• \`.chatlogs view <tanggal/file>\` : Intip 15 pesan terakhir langsung di WhatsApp\n`;
    message += `• Contoh: \`.chatlogs download ${logs[0].date}\``;

    return reply(message);
  },
};
