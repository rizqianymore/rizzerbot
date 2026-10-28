import { clean, cleanText } from "@/src/services/fetch/igdl/utils.js";
import { downloadFromKolId } from "@/src/services/fetch/igdl/providers.js";
import { sendImage, sendVideo } from "@/src/services/fetch/igdl/sender.js";

export default {
  name: "igdl",
  cooldownMs: 30000,
  aliases: ["ig", "instagram", "instagramdl", "ig3", "igdl3", "instagram3"],
  description: "Download video/foto Instagram",
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
      let res = null;

      // 1. Coba kol.id
      try {
        res = await downloadFromKolId(input, { timeoutMs: 25000 });
      } catch (kolErr) {
        logger?.warn?.(`[igdl kol.id] ${kolErr?.message || kolErr}`);
      }

      // 2. Fallback ke engine yt-dlp
      if (!res || !res.media?.length) {
        try {
          const { downloadMedia, probe } = await import("@/src/services/fetch/ytdlp.js");
          const info = await probe(input, { timeoutMs: 20000 }).catch(() => null);
          const dl = await downloadMedia(input, { mode: "video" });
          if (dl?.buffer?.length) {
            res = {
              username: info?.uploader || "",
              likes: 0,
              title: info?.title || "",
              media: [{ type: "mp4", buffer: dl.buffer }],
            };
          }
        } catch (ytdlpErr) {
          logger?.warn?.(`[igdl ytdlp fallback] ${ytdlpErr?.message || ytdlpErr}`);
        }
      }

      if (!res || !res.media?.length) {
        throw new Error("Media tidak ditemukan atau akun di-private.");
      }

      const lines = ["*INSTAGRAM DOWNLOADER*"];
      if (res.username) lines.push(`Author: ${cleanText(res.username)}`);
      if (res.likes) lines.push(`Likes: ${res.likes.toLocaleString()}`);
      if (res.title) lines.push(`Judul: ${cleanText(res.title)}`);
      const caption = lines.join("\n");

      const images = [];
      const videos = [];

      for (const item of res.media) {
        if (item.buffer && Buffer.isBuffer(item.buffer)) {
          if (item.type === "mp4") videos.push({ buffer: item.buffer });
          else images.push({ buffer: item.buffer });
          continue;
        }
        const mediaUrl = clean(item.url || item.video || item.image || item.thumbnail || "");
        if (!mediaUrl) continue;
        const isVideo = item.type === "mp4" || /\.mp4(\?|$)/i.test(mediaUrl) || Boolean(item.video);
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
    } catch (e) {
      logger?.warn?.(`[igdl] ${e?.message || e}`);
      return reply(`Gagal mengunduh Instagram: ${e?.message || "Media tidak ditemukan atau akun privat."}`);
    }
  },
};
