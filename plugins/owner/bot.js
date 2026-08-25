import { runningBots } from "@/src/core/secondary.js";

export default {
  name: "bot",
  description: "Manajemen bot sekunder (sub-bot).",
  usage: "<add/stop/del/list/status> [nomor]",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `🤖 *MANAJEMEN SUB-BOT*\n\n` +
                `• *.bot add <nomor>* - Tambah/pasangkan bot sekunder baru\n` +
                `• *.bot stop <nomor>* - Hentikan bot sekunder aktif\n` +
                `• *.bot del <nomor>* - Hentikan dan hapus data sesi bot sekunder\n` +
                `• *.bot list* - List semua nomor bot sekunder aktif\n` +
                `• *.bot status* - Status bot sekunder aktif`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (action === "add") {
      const targetNumber = args[1]?.replace(/[^0-9]/g, "");
      if (!targetNumber) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.bot add 628xxx*" },
          { quoted: msg }
        );
        return;
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⏳ Sedang menginisialisasi sesi baru untuk ${targetNumber}...` },
        { quoted: msg }
      );

      try {
        const { addSecondaryBot } = await import("@/index.js");
        const code = await addSecondaryBot(targetNumber);
        if (code) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `🔑 *PAIRING CODE BOT BARU (${targetNumber}):*\n\n*Code:* \`${code}\`\n\nMasukkan kode di atas pada WhatsApp di nomor tersebut (Perangkat Tertaut > Tautkan dengan nomor telepon).`,
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `✅ Sesi untuk nomor ${targetNumber} sudah terhubung sebelumnya dan aktif!` },
            { quoted: msg }
          );
        }
      } catch (err) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `❌ Gagal menambahkan bot sekunder: ${err.message}` },
          { quoted: msg }
        );
      }
    } else if (action === "stop" || action === "del") {
      const targetNumber = args[1]?.replace(/[^0-9]/g, "");
      if (!targetNumber) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.bot ${action} 628xxx*` },
          { quoted: msg }
        );
        return;
      }

      const authDirName = `session_${targetNumber}`;
      if (!runningBots.has(authDirName) && action === "stop") {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Bot dengan nomor ${targetNumber} tidak ditemukan sedang berjalan.` },
          { quoted: msg }
        );
        return;
      }

      try {
        const { stopSecondaryBot } = await import("@/index.js");
        await stopSecondaryBot(targetNumber);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `✅ Berhasil menghentikan ${action === "del" ? "dan menghapus sesi " : ""}bot sekunder nomor ${targetNumber}.` },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `❌ Gagal memproses: ${err.message}` },
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
      let i = 1;
      for (const [key] of runningBots.entries()) {
        const num = key.replace("session_", "");
        textList += `${i++}. @${num}\n`;
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList, mentions: Array.from(runningBots.keys()).map(k => k.replace("session_", "") + "@s.whatsapp.net") },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Aksi tidak valid! Gunakan: add, stop, del, list, atau status." },
        { quoted: msg }
      );
    }
  },
};
