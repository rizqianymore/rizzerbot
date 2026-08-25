import { fetchJson, fetchBuffer } from "@/src/utils/scraping.js";

export default {
  premiumOnly: true,
  description: "Mengunduh video TikTok tanpa watermark / slideshow foto (via TikWM API).",
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
          text: "⚠️ Harap sertakan link video TikTok!\nContoh: *.tiktok https://www.tiktok.com/@user/video/123456789*",
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

    try {
      const apiUrl = "https://www.tikwm.com/api/";
      const response = await fetchJson(apiUrl, {
        params: {
          url: url,
          hd: 1
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      });

      const resData = response.data;

      if (!resData || resData.code !== 0) {
        throw new Error(resData?.msg || "Gagal mengambil data dari TikWM API.");
      }

      const data = resData.data;
      const author = data.author?.nickname || "Unknown";
      const title = data.title || "";
      const images = data.images || [];
      const isVideo = images.length === 0;

      if (isVideo) {
        const downloadUrl = data.hdplay || data.play || data.wmplay;
        if (!downloadUrl) {
          throw new Error("URL download video tidak ditemukan.");
        }

        await sock.sendMessage(msg.key.remoteJid, {
          text: "📥 Mengunduh file video...",
          edit: loadingMsg.key,
        });

        const videoBuffer = await fetchBuffer(downloadUrl);

        const caption =
          `📥 *TikTok Downloader*\n\n` +
          `👤 *Username:* ${author}\n` +
          `📝 *Desc:* ${title.substring(0, 150)}${title.length > 150 ? "..." : ""}\n\n` +
          `⚡ _Via TikWM API_`;

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            video: videoBuffer,
            caption: caption,
            mimetype: "video/mp4",
          },
          { quoted: msg },
        );

        // Edit loading message to success
        await sock.sendMessage(msg.key.remoteJid, {
          text: "✅ Selesai mengunduh video TikTok!",
          edit: loadingMsg.key,
        });
      } else {
        // Slideshow / kumpulan foto
        await sock.sendMessage(msg.key.remoteJid, {
          text: `📥 Mengunduh slideshow (${images.length} foto)...`,
          edit: loadingMsg.key,
        });

        for (let i = 0; i < images.length; i++) {
          const imgUrl = images[i];
          const imgBuffer = await fetchBuffer(imgUrl);

          await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: imgBuffer,
              caption: `📸 TikTok Slideshow (Part ${i + 1}/${images.length})\n👤 *Username:* ${author}\n⚡ _Via TikWM API_`,
            },
            { quoted: msg }
          );
        }

        // Edit loading message to success
        await sock.sendMessage(msg.key.remoteJid, {
          text: "✅ Selesai mengunduh slideshow TikTok!",
          edit: loadingMsg.key,
        });
      }
    } catch (err) {
      console.error("TikTok Downloader Error:", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
