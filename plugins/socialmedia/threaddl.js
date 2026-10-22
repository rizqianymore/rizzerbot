import { downloadMediaWithProtectionHandling } from "@/src/services/fetch/webunlock-service.js";

export default {
  name: "threaddl",
  cooldownMs: 30000,
  aliases: ["thread"],
  description: "Threads Downloader - now with automatic BrightData protection handling",
  category: "Social Media",
  usage: "<url>",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `*THREADS DOWNLOADER*\n\n` +
          `Mendownload media dari Threads dengan otomatis atasi proteksi.\n\n` +
          `*Penggunaan:*\n` +
          `• \`.thread <url>\` - Unduh media Threads`
      );
    }

    try {
      const result = await downloadMediaWithProtectionHandling(url, {
        type: "video",
      });

      if (!result.buffer || result.buffer.length === 0) {
        throw new Error("Buffer media kosong");
      }

      const lines = ["*THREADS DOWNLOADER*"];
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
      await reply(`Gagal mendownload Threads: ${err.message}`);
    }
  },
};
