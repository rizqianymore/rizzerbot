// plugins/socialmedia/igdl.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
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

export default {
  "name": "igdl",
  "aliases": ["ig","instagram","instagramdl"],
  "description": "Download video/foto Instagram",
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
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
};
