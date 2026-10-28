import { downloadSocialMedia } from "@/src/services/fetch/socialdownloader.js";
import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "tiktok",
  cooldownMs: 30000,
  aliases: ["tt", "tikdl", "ttdl"],
  description: "Download TikTok video/music (tanpa watermark)",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url) return reply("Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");

    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      let buffer = null;
      let title = "";
      let author = "";
      let duration = "";

      // 1. Coba lewat SocialDownloader (Bypass Cloudflare / BrightData Web Unlocker)
      try {
        const sd = await downloadSocialMedia(url, { isAudio, logger });
        if (sd?.buffer?.length > 0) {
          buffer = sd.buffer;
          title = sd.info.title || "";
          author = sd.info.author || "";
          duration = sd.info.duration ? `${sd.info.duration}s` : "";
        }
      } catch (sdErr) {
        logger?.warn?.(`[tiktok socialdownloader] ${sdErr?.message || sdErr}`);
      }

      // 2. Coba kol.id sebagai secondary fallback
      if (!buffer) {
        try {
          const { downloadTiktok } = await import("@/src/services/fetch/kolid.js");
          const { fetchBuffer } = await import("@/src/services/network/scrape.js");
          const info = await downloadTiktok(url);
          const dlUrl = isAudio ? info?.mp3 : info?.noWatermark || info?.watermark;
          if (dlUrl) {
            buffer = await fetchBuffer(dlUrl, {
              "User-Agent":
                "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
              Referer: "https://kol.id/",
            });
            title = info.title || "";
            author = info.author ? `${info.author}${info.uniqueId ? ` (@${info.uniqueId})` : ""}` : "";
            duration = info.duration ? `${info.duration}s` : "";
          }
        } catch (kolErr) {
          logger?.warn?.(`[tiktok kol.id] ${kolErr?.message || kolErr}`);
        }
      }

      // 3. Fallback ke engine yt-dlp
      if (!buffer) {
        const [pInfo, dl] = await Promise.all([
          probe(url, { timeoutMs: 20000 }).catch(() => null),
          downloadMedia(url, { mode: isAudio ? "audio" : "video" }),
        ]);
        if (!dl?.buffer?.length) throw new Error("Gagal mengunduh media TikTok.");
        buffer = dl.buffer;
        title = pInfo?.title || "";
        author = pInfo?.uploader || "";
        if (pInfo?.duration) duration = `${pInfo.duration}s`;
      }

      const lines = ["*TIKTOK DOWNLOADER*"];
      if (title) lines.push(`Judul: ${title}`);
      if (author) lines.push(`Author: ${author}`);
      if (duration) lines.push(`Durasi: ${duration}`);
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        !isAudio
          ? { video: buffer, caption, mimetype: "video/mp4" }
          : { audio: buffer, mimetype: "audio/mpeg", ptt: false },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal: ${err.message}`);
    }
  },
};
