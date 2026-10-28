import { downloadSocialMedia } from "@/src/services/fetch/socialdownloader.js";
import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "anydl",
  cooldownMs: 30000,
  aliases: ["yoink", "dl", "down", "get"],
  description: "Universal Downloader (YouTube, IG, TikTok, X/Twitter, FB, Threads, Reddit) dengan bypass Cloudflare & BrightData",
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
      let buffer = null;
      let info = null;
      let sourceName = "";

      // 1. Coba lewat SocialDownloader (Didukung bypass Cloudflare & BrightData Web Unlocker)
      try {
        const sd = await downloadSocialMedia(url, { isAudio, logger });
        if (sd?.buffer?.length > 0) {
          buffer = sd.buffer;
          info = {
            title: sd.info.title,
            uploader: sd.info.author,
            duration: sd.info.duration,
            extractor_key: sd.info.platform,
          };
          sourceName = "SocialDownloader";
        }
      } catch (sdErr) {
        logger?.warn?.(`[anydl socialdownloader] ${sdErr?.message || sdErr}`);
      }

      // 2. Fallback otomatis ke engine yt-dlp jika gagal/diblokir
      if (!buffer) {
        try {
          const [meta, dl] = await Promise.all([
            probe(url, { timeoutMs: 20000 }).catch((err) => {
              logger?.warn?.(`[anydl probe] ${err?.message || err}`);
              return null;
            }),
            downloadMedia(url, {
              mode: isAudio ? "audio" : "video",
              quality: "720",
            }),
          ]);
          if (dl?.buffer && dl.buffer.length > 0) {
            buffer = dl.buffer;
            info = meta;
            sourceName = "yt-dlp";
          }
        } catch (ytdlErr) {
          logger?.warn?.(`[anydl ytdlp] ${ytdlErr?.message || ytdlErr}`);
        }
      }

      if (!buffer) {
        throw new Error("Gagal mengunduh media dari semua provider (SocialDownloader & yt-dlp).");
      }

      const lines = ["*DOWNLOADER*"];
      if (info?.extractor_key) lines.push(`Platform: ${info.extractor_key}`);
      if (info?.title) lines.push(`Judul: ${info.title}`);
      if (info?.uploader || info?.channel) lines.push(`Author: ${info.uploader || info.channel}`);
      if (info?.duration) {
        const mins = Math.floor(info.duration / 60);
        const secs = Math.floor(info.duration % 60);
        lines.push(`Durasi: ${mins}m ${secs}s`);
      }
      if (sourceName) lines.push(`Engine: ${sourceName}`);
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        isAudio ? { audio: buffer, mimetype: "audio/mpeg" } : { video: buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal mengunduh media: ${err.message}`);
    }
  },
};
