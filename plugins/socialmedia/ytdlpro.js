import { downloadMediaWithProtectionHandling } from "@/src/services/fetch/webunlock-service.js";

export default {
  name: "ytdlpro",
  cooldownMs: 30000,
  aliases: ["ydl", "youtube-pro"],
  description: "YouTube Downloader - now with automatic BrightData protection handling",
  category: "Social Media",
  usage: "<url> [mp3]",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `*YOUTUBE DOWNLOADER*\n\n` +
          `Mendownload video/audio dari YouTube dengan otomatis atasi proteksi.\n\n` +
          `*Penggunaan:*\n` +
          `• \`.ytdlpro <url>\` (Video)\n` +
          `• \`.ytdlpro <url> mp3\` (Audio Only)`
      );
    }

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");

    try {
      const result = await downloadMediaWithProtectionHandling(url, {
        type: isAudio ? "audio" : "video",
      });

      if (!result.buffer || result.buffer.length === 0) {
        throw new Error("Buffer media kosong");
      }

      const lines = ["*YOUTUBE DOWNLOADER*"];
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
      await reply(`Gagal mendownload YouTube: ${err.message}`);
    }
  },
};
