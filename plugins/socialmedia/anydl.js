import { downloadMedia, probe } from "@/src/services/ytdlp.js";

export default {
  name: "anydl",
  aliases: ["yoink", "dl", "down", "get"],
  description: "Universal Downloader (YouTube, IG, TikTok, X/Twitter, FB, Reddit, dll) via engine Yoinks (yt-dlp)",
  usage: "<url> [mp3]",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `⚡ *UNIVERSAL DOWNLOADER (YOINKS)*\n\n` +
        `Mendukung: YouTube, Instagram, TikTok, X (Twitter), Facebook, Threads, Reddit, Vimeo, dll.\n\n` +
        `*Penggunaan:*\n` +
        `• \`${prefix || "."}dl <url>\` (Video)\n` +
        `• \`${prefix || "."}dl <url> mp3\` (Audio Only)`
      );
    }

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");
    await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let info = null;
      try {
        info = await probe(url);
      } catch (e) {
        // jika gagal probe, lanjut coba download langsung
      }

      const { buffer } = await downloadMedia(url, {
        mode: isAudio ? "audio" : "video",
        quality: "720",
      });

      const lines = ["📥 *DOWNLOADER*"];
      if (info?.extractor_key) lines.push(`Platform: ${info.extractor_key}`);
      if (info?.title) lines.push(`Judul: ${info.title}`);
      if (info?.uploader || info?.channel) lines.push(`Author: ${info.uploader || info.channel}`);
      if (info?.duration) {
        const mins = Math.floor(info.duration / 60);
        const secs = Math.floor(info.duration % 60);
        lines.push(`Durasi: ${mins}m ${secs}s`);
      }
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        isAudio
          ? { audio: buffer, mimetype: "audio/mpeg" }
          : { video: buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Gagal mengunduh media: ${err.message}`);
    }
  },
};
