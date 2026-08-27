import { runningBots, addSecondaryBot, stopSecondaryBot } from "../../src/core/secondary.js";
import { cleanNumber } from "@/src/utils/helper.js";

export default {
  name: "bot",
  description: "Manajemen multi-session bot sekunder (sub-bot).",
  usage: "<add/stop/del/list/status> [nomor]",
  example: "bot add 628123456789",
  aliases: ["subbot", "jadibot"],
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `🤖 *MANAJEMEN MULTI-BOT (SUB-BOT)*\n\n` +
                `│ .bot add <nomor> - Pasangkan bot sekunder baru\n` +
                `│ .bot stop <nomor> - Hentikan bot sekunder tanpa hapus sesi\n` +
                `│ .bot del <nomor> - Hentikan dan hapus permanen data sesi\n` +
                `│ .bot list - Daftar semua bot sekunder aktif\n` +
                `│ .bot status - Cek status konektivitas multi-bot`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "add") {
      const targetNumber = cleanNumber(args[1]);
      if (!targetNumber || targetNumber.length < 7) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Harap tentukan nomor telepon bot sekunder yang valid (min 7 digit).\nContoh: *.bot add 628123456789*" },
          { quoted: msg }
        );
        return;
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⏳ Sedang menginisialisasi sesi & meminta Pairing Code untuk nomor *${targetNumber}*...` },
        { quoted: msg }
      );

      try {
        const code = await addSecondaryBot(targetNumber);
        if (code) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `🔑 *PAIRING CODE SUB-BOT BARU*\n\n` +
                    `• Nomor: *${targetNumber}*\n` +
                    `• Pairing Code: \`${code}\`\n\n` +
                    `_Buka WhatsApp di nomor tersebut > Perangkat Tertaut > Tautkan dengan nomor telepon > Masukkan kode di atas._`,
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `✅ Sesi untuk nomor *${targetNumber}* sudah terhubung dan sedang aktif!` },
            { quoted: msg }
          );
        }
      } catch (err) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `❌ Gagal menambahkan sub-bot: ${err.message || err}` },
          { quoted: msg }
        );
      }
    } else if (action === "stop" || action === "del") {
      const targetNumber = cleanNumber(args[1]);
      if (!targetNumber) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Harap tentukan nomor telepon bot sekunder.\nContoh: *.bot ${action} 628123456789*` },
          { quoted: msg }
        );
        return;
      }

      const authDirName = `session_${targetNumber}`;
      const isRunning = runningBots.has(authDirName);

      if (!isRunning && action === "stop") {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Bot dengan nomor ${targetNumber} tidak ditemukan sedang berjalan.` },
          { quoted: msg }
        );
        return;
      }

      try {
        const deleteSession = action === "del";
        await stopSecondaryBot(targetNumber, deleteSession);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `✅ Berhasil ${deleteSession ? "menghentikan dan menghapus sesi" : "menghentikan"} bot sekunder *${targetNumber}*.` },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `❌ Gagal memproses: ${err.message || err}` },
          { quoted: msg }
        );
      }
    } else if (action === "list" || action === "status") {
      if (runningBots.size === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "ℹ️ Tidak ada bot sekunder yang sedang berjalan saat ini." },
          { quoted: msg }
        );
        return;
      }

      let textList = `🤖 *DAFTAR BOT SEKUNDER AKTIF (${runningBots.size})*\n\n`;
      const mentions = [];
      let i = 1;

      for (const [key, botSock] of runningBots.entries()) {
        const num = key.replace("session_", "");
        const isOnline = Boolean(botSock?.user?.id);
        const jid = `${num}@s.whatsapp.net`;
        mentions.push(jid);
        textList += `${i++}. @${num} - Status: ${isOnline ? "🟢 *Connected*" : "🟡 *Connecting*"}\n`;
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList.trim(), mentions },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Aksi tidak valid! Gunakan: *add*, *stop*, *del*, *list*, atau *status*." },
        { quoted: msg }
      );
    }
  },
};
