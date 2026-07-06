import { fetchBuffer } from "@/lib/scraping.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch dengan timeout protection
const fetchWithTimeout = async (url, options, timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

export default {
  premiumOnly: true,
  description: "Mengunduh video TikTok tanpa watermark (via Kyros-MD API).",
  usage: "<link TikTok>",
  example: ".tiktok https://www.tiktok.com/@user/video/123",
  name: "tiktok",
  aliases: ["tt", "ttdl", "tiktokdl"],
  category: "Downloader",
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping }) => {
    const url = args[0];

    if (!url) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap sertakan link video TikTok!\nContoh: *.tiktok https://www.tiktok.com/@user/video/123456789",
        },
        { quoted: msg },
      );
      return;
    }

    if (!/tiktok\.com|douyin\.com/i.test(url)) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "❌ Tautan tidak valid.",
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    const loadingMsg = await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "⏳ Sedang memproses download TikTok...",
      },
      { quoted: msg },
    );

    let videoData = null;

    try {
      // 1. Submit Request ke Vgasoft API (GET)
      const apiUrl = `https://download.vgasoft.vn/web/c/tiktok/getVideo?link=${encodeURIComponent(url)}`;
      const res = await fetchWithTimeout(
        apiUrl,
        {
          headers: {
            Referer: "https://downloadvideo.vn/",
            Origin: "https://downloadvideo.vn",
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36",
            os: "webSite",
          },
        },
        15000,
      );

      if (!res.ok) throw new Error("Gagal menghubungi server Vgasoft.");

      const data = await res.json();
      if (!data.success || !data.result || data.result.length === 0) {
        throw new Error("Video tidak ditemukan atau link tidak valid.");
      }

      const item = data.result[0];
      const targetVideoUrl = item.video?.url || item.video?.urlWatermark;
      if (!targetVideoUrl)
        throw new Error("URL Video tidak ditemukan dalam response.");

      videoData = {
        url: targetVideoUrl,
        author: item.author?.unique_id || "unknown",
        desc: item.title || "",
        audio: item.video?.music || null,
        thumbnail: item.thumbnail || null,
      };

      if (!videoData) throw new Error("Data video kosong.");

      // 4. Download Buffer
      await sock.sendMessage(msg.key.remoteJid, {
        text: "📥 Sedang mengunduh file...",
        edit: loadingMsg.key,
      });

      const videoBuffer = await fetchBuffer(videoData.url);

      if (!videoBuffer || videoBuffer.length === 0) {
        throw new Error("Gagal mendownload buffer video.");
      }

      // 5. Kirim Video
      const caption =
        `📥 *TikTok Downloader*\n\n` +
        `👤 *Username:* @${videoData.author}\n` +
        `📝 *Desc:* ${videoData.desc.substring(0, 100)}${videoData.desc.length > 100 ? "..." : ""}\n` +
        `⚡ _Via Kyros-MD API_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          video: videoBuffer,
          caption: caption,
          mimetype: "video/mp4",
        },
        { quoted: msg },
      );

      // Opsional: Kirim Audio terpisah jika ingin
      /*
            if (videoData.audio) {
                await delay(2000);
                const audioBuf = await fetchBuffer(videoData.audio);
                if (audioBuf) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        audio: audioBuf,
                        mimetype: 'audio/mpeg',
                        ptt: false
                    }, { quoted: msg });
                }
            }
            */
    } catch (err) {
      console.error("TikTok Downloader Error:", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
