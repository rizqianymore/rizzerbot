import axios from "axios";

const IG_REGEX = /instagram\.com\/(p|reel|reels|stories|tv)\//i;

/**
 * Scraper Instagram menggunakan API azbry v2
 */
async function instagramDownloader(url) {
  const endpoint = "https://api.azbry.com/api/download/instagramv2";
  const response = await axios.get(endpoint, {
    params: { url: url },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    timeout: 30000,
  });

  const data = response.data;
  if (!data || !data.status || !Array.isArray(data.links) || data.links.length === 0) {
    throw new Error(data?.message || "Gagal mengambil media dari API Instagram");
  }

  const media = data.links.map((item) => {
    const itemType = String(item.type || "").toLowerCase();
    const itemUrl = String(item.url || "").toLowerCase();
    const isVideo = itemType === "video" || itemType === "mp4" || itemUrl.includes(".mp4");
    return {
      type: isVideo ? "video" : "image",
      url: item.url,
      thumbnail: item.thumbnail || "",
    };
  });

  const firstLink = data.links[0] || {};
  const captionText = firstLink.text && firstLink.text !== "null" ? firstLink.text.trim() : "";
  const authorName = data.author && data.author !== "Unknown" ? data.author : "-";

  return {
    username: authorName,
    caption: captionText,
    media,
  };
}

export default [
  {
    name: "igdl",
    aliases: ["ig", "instagram", "instagramdl"],
    description: "Download video/foto Instagram",
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const url = args[0]?.trim();
      const currentPrefix = prefix || ".";

      if (!url) {
        return reply(
          `📸 *Instagram Downloader*\n\n` +
          `Gunakan: \`${currentPrefix}igdl <url>\`\n\n` +
          `*Contoh:*\n` +
          `> \`${currentPrefix}igdl https://www.instagram.com/reel/xxx\`\n` +
          `> \`${currentPrefix}igdl https://www.instagram.com/p/xxx\``
        );
      }

      if (!IG_REGEX.test(url)) {
        return reply("❌ URL tidak valid. Gunakan link Instagram (reel/post/story/tv).");
      }

      await sendTyping();
      await reply("⏳ Mengunduh media Instagram...");

      try {
        const result = await instagramDownloader(url);

        if (!result?.media?.length) {
          return reply("❌ Gagal mengambil media dari Instagram.");
        }

        const remoteJid = msg.key.remoteJid;
        const author = result.username && result.username !== "-" ? `@${result.username}` : "";
        const title = result.caption ? result.caption.slice(0, 100) : "";

        let caption = `📸 *Instagram Downloader*`;
        if (author) caption += `\n👤 *Author:* ${author}`;
        if (title) caption += `\n📝 *Caption:* ${title}${result.caption.length > 100 ? "..." : ""}`;

        for (const item of result.media) {
          const isVideo = item.type === "video";
          if (isVideo) {
            await sock.sendMessage(
              remoteJid,
              { video: { url: item.url }, caption },
              { quoted: msg }
            );
          } else {
            await sock.sendMessage(
              remoteJid,
              { image: { url: item.url }, caption },
              { quoted: msg }
            );
          }
          caption = "";
        }
      } catch (err) {
        return reply(`❌ *Gagal mengunduh:*\n> ${err.message}`);
      }
    },
  },

  {
    name: "tiktok",
    aliases: ["tt", "tikdl", "ttdl"],
    description: "Download TikTok video/music (tanpa watermark)",
    premiumOnly: true,
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");
      await reply("🎬 Mengunduh video TikTok...");
      try {
        const { tiktokDownload, fetchBuffer } = await import("@/src/services/scrape.js");
        const info = await tiktokDownload(url);
        const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
        const dlUrl = isAudio ? info.mp3 : info.noWatermark;
        if (!dlUrl) throw new Error("Gagal menemukan link download media TikTok.");
        const isVideo = !isAudio;
        const buffer = await fetchBuffer(dlUrl);
        const caption =
          `🎬 *TikTok Download*\n\n` +
          `*Author:* ${info.author} (@${info.uniqueId})\n` +
          (info.title ? `*Judul:* ${info.title}\n` : "") +
          `*Durasi:* ${info.duration}s\n` +
          `*Views:* ${info.playCount.toLocaleString()} | *Likes:* ${info.diggCount.toLocaleString()}`;
        await sock.sendMessage(
          msg.key.remoteJid,
          isVideo
            ? { video: buffer, caption, mimetype: "video/mp4" }
            : { audio: buffer, mimetype: "audio/mpeg", ptt: true },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
  },

  {
    name: "ytdlpro",
    aliases: ["ytdl", "yt"],
    description: "Download video/audio YouTube",
    premiumOnly: true,
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link YouTube! Contoh: *.ytdlpro https://youtu.be/xxx*");
      await reply("🚀 Mendownload video...");
      const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
      const { ytToolkitDownload, cobaltDownload, fetchBuffer } = await import("@/src/services/scrape.js");
      try {
        let result;
        try {
          result = await ytToolkitDownload(url, isAudio ? { type: "audio" } : { type: "video", quality: "720" });
        } catch (ytErr) {
          await reply(`⚠️ youtubetoolkit tidak bisa (${ytErr.message}). Coba via Cobalt...`);
          result = await cobaltDownload(url, isAudio ? { mode: "audio", audioFormat: "mp3" } : { mode: "video" });
        }
        const downloadUrl = result?.url;
        if (!downloadUrl) throw new Error("Gagal mendapatkan link unduhan.");
        const buffer = await fetchBuffer(downloadUrl);
        await sock.sendMessage(
          msg.key.remoteJid,
          isAudio
            ? { audio: buffer, mimetype: "audio/mpeg" }
            : { video: buffer, mimetype: "video/mp4" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mendownload: ${err.message}`);
      }
    },
  },
];
