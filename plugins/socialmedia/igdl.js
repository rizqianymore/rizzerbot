import { downloadMediaWithProtectionHandling } from "@/src/services/fetch/webunlock-service.js";

export default {
  name: "igdl",
  cooldownMs: 30000,
  aliases: ["ig", "instagram"],
  description: "Instagram Downloader with automatic BrightData protection handling",
  category: "Social Media",
  usage: "<url>",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `*INSTAGRAM DOWNLOADER*\n\n` +
          `Mendownload media dari Instagram dengan otomatis atasi proteksi.\n\n` +
          `*Penggunaan:*\n` +
          `• \`.ig <url>\` - Unduh media Instagram`
      );
    }

    try {
      const result = await downloadMediaWithProtectionHandling(url, {
        type: "video",
      });

      if (!result.buffer || result.buffer.length === 0) {
        throw new Error("Buffer media kosong");
      }

      const lines = ["*INSTAGRAM DOWNLOADER*"];
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
        { video: result.buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal mendownload Instagram: ${err.message}`);
    }
  },
};