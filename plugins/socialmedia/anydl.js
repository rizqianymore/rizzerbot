import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "anydl",
  cooldownMs: 30000,
  aliases: ["yoink", "dl", "down", "get"],
  description: "Universal Downloader — auto deteksi platform & auto convert biar kebuka",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `*UNIVERSAL DOWNLOADER*\n\n` +
          `Mendukung: YouTube, Instagram, TikTok, X (Twitter), Facebook, Threads, Reddit, Vimeo, dll.\n\n` +
          `*Penggunaan:*\n` +
          `• \`${prefix || "."}dl <url>\` (Video)\n` +
          `• \`${prefix || "."}dl <url> mp3\` (Audio Only)`
      );
    }

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");

    try {
      const { buffer, info, source } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh media.");

      const lines = ["*DOWNLOADER*"];
      if (info?.extractor_key || info?.platform) lines.push(`Platform: ${info.extractor_key || info.platform}`);
      if (info?.title) lines.push(`Judul: ${String(info.title).slice(0, 150)}`);
      if (info?.uploader || info?.channel || info?.author) lines.push(`Author: ${info.uploader || info.channel || info.author}`);
      if (info?.duration) {
        const d = Number(info.duration);
        if (Number.isFinite(d) && d > 0) {
          const mins = Math.floor(d / 60);
          const secs = Math.floor(d % 60);
          lines.push(`Durasi: ${mins}m ${secs}s`);
        }
      }
      if (source) lines.push(`Engine: ${source}`);
      const caption = lines.join("\n");
      const mimetype = sniffMime(buffer, isAudio ? "audio/mpeg" : "video/mp4");

      await sock.sendMessage(
        msg.key.remoteJid,
        isAudio
          ? { audio: buffer, mimetype: "audio/mpeg" }
          : mimetype.startsWith("image/")
            ? { image: buffer, caption }
            : mimetype.startsWith("audio/")
              ? { audio: buffer, mimetype: "audio/mpeg" }
              : { video: buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal mengunduh media: ${err.message}`);
    }
  },
};
