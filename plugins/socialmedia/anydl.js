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
        `┌── UNIVERSAL DOWNLOADER\n` +
          `│ Format: ${prefix || "."}dl <url> [mp3]\n` +
          `│ Dukungan: YouTube, IG, TikTok, X, FB, dll\n` +
          `└─\n\n` +
          `Contoh: ${prefix || "."}dl https://vt.tiktok.com/xxxx`
      );
    }

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");

    try {
      const { buffer, info, source } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh media.");

      let caption = `┌── UNIVERSAL DOWNLOADER\n`;
      if (info?.extractor_key || info?.platform) caption += `│ Platform: ${info.extractor_key || info.platform}\n`;
      if (info?.title) caption += `│ Judul: ${String(info.title).slice(0, 150)}\n`;
      if (info?.uploader || info?.channel || info?.author)
        caption += `│ Author: ${info.uploader || info.channel || info.author}\n`;
      if (info?.duration) {
        const d = Number(info.duration);
        if (Number.isFinite(d) && d > 0) {
          const mins = Math.floor(d / 60);
          const secs = Math.floor(d % 60);
          caption += `│ Durasi: ${mins}m ${secs}s\n`;
        }
      }
      if (source) caption += `│ Engine: ${source}\n`;
      caption += `└─`;
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
