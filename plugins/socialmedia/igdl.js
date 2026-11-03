import { clean, cleanText } from "@/src/services/fetch/igdl/utils.js";
import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";
import { sendImage, sendVideo } from "@/src/services/fetch/igdl/sender.js";

export default {
  name: "igdl",
  cooldownMs: 30000,
  aliases: ["ig", "instagram", "instagramdl", "ig3", "igdl3", "instagram3"],
  description: "Download video/foto Instagram — auto deteksi & convert biar kebuka di WA",
  usage: "<url>",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const remoteJid = msg.key.remoteJid;
    const currentPrefix = prefix || ".";

    const input = clean(args.join(" ") || args?.[0] || "");

    if (!input) {
      return reply(`Contoh:\n${currentPrefix}igdl https://instagram.com/...`);
    }
    await sendTyping();

    try {
      // coba unified (socialdownloader + ytdlp) dengan auto-convert
      let res = null;
      try {
        // untuk carousel, coba fallback manual: ytdlp kadang balikin single file, jadi tetap pakai unified untuk single
        const { buffer, info } = await unifiedDownload(input, { mode: "video", logger });
        if (buffer?.length) {
          const mime = sniffMime(buffer);
          res = {
            username: info?.uploader || info?.author || "",
            title: info?.title || "",
            likes: 0,
            media: [{ type: mime.startsWith("image/") ? "image" : "mp4", buffer }],
          };
        }
      } catch (uniErr) {
        logger?.warn?.(`[igdl unified] ${uniErr?.message || uniErr}`);
      }

      if (!res || !res.media?.length) {
        throw new Error("Media tidak ditemukan atau akun di-private. Coba link publik lain.");
      }

      const lines = ["*INSTAGRAM DOWNLOADER*"];
      if (res.username) lines.push(`Author: ${cleanText(res.username)}`);
      if (res.likes) lines.push(`Likes: ${res.likes.toLocaleString()}`);
      if (res.title) lines.push(`Judul: ${cleanText(res.title.slice(0, 150))}`);
      const caption = lines.join("\n");

      // auto deteksi via buffer mime, bukan cuma url
      const images = [];
      const videos = [];
      for (const item of res.media) {
        if (item.buffer && Buffer.isBuffer(item.buffer)) {
          const mime = sniffMime(item.buffer);
          if (mime.startsWith("image/")) images.push({ buffer: item.buffer });
          else videos.push({ buffer: item.buffer });
          continue;
        }
        const mediaUrl = clean(item.url || item.video || item.image || item.thumbnail || "");
        if (!mediaUrl) continue;
        const isVideo = item.type === "mp4" || /\.mp4(\?|$)/i.test(mediaUrl);
        if (isVideo) videos.push({ url: mediaUrl });
        else images.push({ url: mediaUrl });
      }

      if (images.length === 1 && videos.length === 0) {
        await sendImage(sock, remoteJid, msg, images[0], caption);
      } else if (images.length > 1 && videos.length === 0) {
        for (let i = 0; i < images.length; i++) {
          await sendImage(sock, remoteJid, msg, images[i], i === 0 ? caption : "");
        }
      }
      for (let i = 0; i < videos.length; i++) {
        await sendVideo(sock, remoteJid, msg, videos[i], images.length === 0 && i === 0 ? caption : "");
      }
      if (images.length === 0 && videos.length === 0) {
        throw new Error("Media Instagram kosong setelah deteksi.");
      }
    } catch (e) {
      logger?.warn?.(`[igdl] ${e?.message || e}`);
      return reply(`Gagal mengunduh Instagram: ${e?.message || "Media tidak ditemukan atau akun privat."}`);
    }
  },
};
