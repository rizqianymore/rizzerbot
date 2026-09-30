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

  {
    name: "threaddl",
    aliases: ["tdl", "threads", "threadsdl"],
    description: "Download foto dan video dari postingan Threads",
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const url = args[0]?.trim();
      const currentPrefix = prefix || ".";

      if (!url || !/threads/i.test(url)) {
        return reply(
          `🧵 *Threads Downloader*\n\n` +
          `Masukkan link postingan Threads yang ingin diunduh.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}tdl https://www.threads.net/@zuck/post/xxx\``
        );
      }

      await reply("⏳ Mengunduh media dari Threads...");

      const BASE_URL = "https://workers-playground-cool-wood-c008.accoutydusra.workers.dev";

      const decodeEntities = (str = "") => {
        return String(str || "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\r/g, "")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      };

      const uniqueByUrl = (list = []) => {
        const seen = new Set();
        const result = [];
        for (const item of list) {
          if (!item?.url || seen.has(item.url)) continue;
          seen.add(item.url);
          result.push(item);
        }
        return result;
      };

      try {
        const res = await axios.get(BASE_URL, {
          timeout: 60000,
          validateStatus: () => true,
          params: { url, action: "info" },
          headers: {
            "sec-ch-ua-platform": `"Android"`,
            "user-agent":
              "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
            "accept": "application/json",
            "content-type": "application/json",
            "origin": "https://threadsvid.com",
            "referer": "https://threadsvid.com/",
            "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        });

        const data = res.data || {};
        const info = data.data || {};

        const videoQualities = uniqueByUrl(info.video?.qualities || []);
        const images = uniqueByUrl(info.images?.urls || []);

        const mediaResults = [
          ...videoQualities.map((item) => ({ type: "video", url: item.url })),
          ...images.map((item) => ({ type: "image", url: item.url })),
        ];

        if (res.status >= 300 || data.success !== true || mediaResults.length === 0) {
          return reply(
            `⚠️ Gagal mengambil media dari Threads.\n` +
            `Postingan mungkin bersifat privat, sudah dihapus, atau link tidak valid.\n` +
            `Detail: ${data.message || data.error || "Data kosong"}`
          );
        }

        const cleanDesc = decodeEntities(info.title || info.description || "");
        const captionText =
          `🧵 *Threads Downloader*\n\n` +
          `• Author: *${info.author || "Unknown"}*\n` +
          (cleanDesc ? `• Deskripsi: ${cleanDesc}\n` : "") +
          `• Total Media: ${mediaResults.length} file`;

        const remoteJid = msg.key.remoteJid;

        if (mediaResults.length > 1) {
          await reply(captionText);
          for (const item of mediaResults) {
            if (item.type === "image") {
              await sock.sendMessage(remoteJid, { image: { url: item.url } }, { quoted: msg });
            } else if (item.type === "video") {
              await sock.sendMessage(remoteJid, { video: { url: item.url }, mimetype: "video/mp4" }, { quoted: msg });
            }
          }
        } else {
          const single = mediaResults[0];
          if (single.type === "image") {
            await sock.sendMessage(
              remoteJid,
              { image: { url: single.url }, caption: captionText },
              { quoted: msg }
            );
          } else {
            await sock.sendMessage(
              remoteJid,
              { video: { url: single.url }, caption: captionText, mimetype: "video/mp4" },
              { quoted: msg }
            );
          }
        }
      } catch (err) {
        console.error("[ThreadsDL Error]:", err.message);
        reply(`❌ Terjadi kesalahan saat mengunduh Threads: ${err.message}`);
      }
    },
  },
];
