import { downloadMediaWithProtectionHandling } from "@/src/services/fetch/webunlock-service.js";

export default {
  name: "webunlock",
  cooldownMs: 30000,
  aliases: ["wu", "unlock", "bdl"],
  description: "Downloader media sosial dengan penanganan proteksi otomatis (Bright Data Web Unlocker + Browser Stealth)",
  category: "Social Media",
  usage: "<url>",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `*WEBUNLOCK DOWNLOADER*\n\n` +
          `Mendukung unduhan media dari berbagai platform sosial dengan otomatis atasi proteksi.\n\n` +
          `*Penggunaan:*\n` +
          `• \`${prefix || "."}webunlock <url>\` - Unduh media (video/audio otomatis)\n` +
          `• \`${prefix || "."}wu <url>\` - Alias pendek`
      );
    }

    try {
      // Proses dengan status menunggu
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⏳ Sedang mengunduh media..." },
        { quoted: msg }
      );

      const result = await downloadMediaWithProtectionHandling(url, {
        type: "video",
      });

      if (!result.buffer || result.buffer.length === 0) {
        throw new Error("Buffer media kosong");
      }

      // Hapus pesan menunggu dan kirim hasil
      await sock.sendMessage(
        msg.key.remoteJid,
        { delete: msg.key },
        { quoted: msg }
      );

      const lines = ["*DOWNLOADER WEBUNLOCK*"];
      if (result.info?.title) lines.push(`Judul: ${result.info.title}`);
      if (result.info?.author) lines.push(`Author: ${result.info.author}`);
      if (result.info?.duration) {
        const mins = Math.floor(result.info.duration / 60);
        const secs = Math.floor(result.info.duration % 60);
        lines.push(`Durasi: ${mins}m ${secs}s`);
      }
      lines.push(`Engine: ${result.source}`);
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        result.isAudio
          ? { audio: result.buffer, mimetype: "audio/mpeg" }
          : { video: result.buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal mendownload: ${err.message}`);
    }
  },
};
