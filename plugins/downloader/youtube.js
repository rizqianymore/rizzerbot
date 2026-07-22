import { customRequest, fetchBuffer } from "@/lib/scraping.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  premiumOnly: true,
  description: "Mengunduh video YouTube (via kol.id API).",
  usage: "<link YouTube>",
  example: ".youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  name: "youtube",
  aliases: ["yt", "ytdl", "youtubedl"],
  category: "Downloader",
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping }) => {
    const url = args[0];

    if (!url) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap sertakan link video YouTube!\nContoh: *.youtube https://www.youtube.com/watch?v=xxxx*",
        },
        { quoted: msg }
      );
      return;
    }

    if (!/youtube\.com|youtu\.be/i.test(url)) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "❌ Tautan YouTube tidak valid.",
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const loadingMsg = await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "⏳ Sedang memproses download YouTube...",
      },
      { quoted: msg }
    );

    try {
      // 1. Dapatkan cookies & CSRF token
      const pageRes = await customRequest("https://kol.id/download-video/youtube", {
        method: "GET"
      });

      const setCookies = pageRes.headers["set-cookie"] || [];
      const cookieHeader = setCookies.map(c => c.split(";")[0]).join("; ");

      const tokenMatch = pageRes.data.match(/name="_token"\s+value="([^"]+)"/);
      if (!tokenMatch) {
        throw new Error("Gagal mengekstrak token CSRF dari halaman kol.id.");
      }
      const csrfToken = tokenMatch[1];

      // 2. Submit request ke Downloader API
      const postUrl = "https://kol.id/api/v2/downloader/youtube";
      
      // Menggunakan URLSearchParams untuk format application/x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append("url", url);
      params.append("_token", csrfToken);

      const submitRes = await customRequest(postUrl, {
        method: "POST",
        data: params.toString(),
        headers: {
          "Cookie": cookieHeader,
          "Referer": "https://kol.id/download-video/youtube",
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      const submitResult = submitRes.data;
      const meta = submitResult.meta || {};
      let data = submitResult.data || {};

      const parseCompletedData = (completedData) => {
        const title = completedData.title || "YouTube Video";
        const videos = completedData.video || [];
        
        if (videos.length === 0) {
          throw new Error("Tidak ada media download yang tersedia.");
        }

        // Cari format video terbaik yang memiliki audio bawaan (audio === true)
        let bestCombined = videos.find(item => item.format === "video" && item.audio === true);
        if (!bestCombined) {
          bestCombined = videos.find(item => item.format === "video");
        }

        return {
          title,
          thumbnail: completedData.thumbnail,
          downloadUrl: bestCombined ? bestCombined.url : null,
          quality: bestCombined ? bestCombined.quality : null
        };
      };

      let downloadInfo = null;

      // Jika langsung selesai/completed
      if (meta.status === "ok" && data.status === "completed") {
        downloadInfo = parseCompletedData(data);
      } else {
        if (meta.status !== "accepted" || !data.status_url) {
          throw new Error(meta.message || "Request ditolak oleh API.");
        }

        const statusUrl = data.status_url;
        let pollAfter = parseInt(data.poll_after || 5) * 1000;

        // 3. Polling status
        const maxAttempts = 12;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await delay(pollAfter);

          const statusRes = await customRequest(statusUrl, {
            method: "GET",
            headers: {
              "Cookie": cookieHeader
            }
          });

          const statusResult = statusRes.data;
          const currentData = statusResult.data || {};
          const currentStatus = currentData.status;

          if (currentStatus === "completed") {
            downloadInfo = parseCompletedData(currentData);
            break;
          } else if (currentStatus === "failed") {
            throw new Error("Proses download video di server kol.id gagal.");
          }

          pollAfter = parseInt(currentData.poll_after || 5) * 1000;
        }
      }

      if (!downloadInfo || !downloadInfo.downloadUrl) {
        throw new Error("Proses download timeout atau tidak dapat menemukan link download.");
      }

      // 4. Download file & send
      await sock.sendMessage(msg.key.remoteJid, {
        text: `📥 Mengunduh video: *${downloadInfo.title}* (${downloadInfo.quality || "Default"})...`,
        edit: loadingMsg.key,
      });

      const videoBuffer = await fetchBuffer(downloadInfo.downloadUrl, {
        headers: {
          "Referer": "https://kol.id/",
          "Cookie": cookieHeader
        }
      });

      const caption =
        `📥 *YouTube Downloader*\n\n` +
        `📝 *Title:* ${downloadInfo.title}\n` +
        `⚡ *Quality:* ${downloadInfo.quality || "Default"}\n\n` +
        `⚡ _Via kol.id API_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          video: videoBuffer,
          caption: caption,
          mimetype: "video/mp4",
        },
        { quoted: msg }
      );

      // Hapus pesan loading
      await sock.sendMessage(msg.key.remoteJid, { delete: loadingMsg.key });

    } catch (err) {
      console.error("YouTube Downloader Error:", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
