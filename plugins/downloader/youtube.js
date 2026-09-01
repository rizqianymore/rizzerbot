import { customRequest, postJson, fetchBuffer } from "@/src/utils/scraping.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  premiumOnly: true,
  description: "Mengunduh video YouTube (via ytmp3.gg API).",
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
      const headers = {
        "Origin": "https://media.ytmp3.gg",
        "Referer": "https://media.ytmp3.gg/",
        "User-Agent": "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36"
      };

      
      const checkRes = await customRequest(`https://dmca.ytmp3.gg/api/check?url=${encodeURIComponent(url)}`, {
        method: "GET",
        headers
      });

      if (checkRes.data && checkRes.data.blocked) {
        throw new Error("Video ini diblokir karena permintaan DMCA.");
      }

      // 2. Request download
      const payload = {
        url: url,
        os: "android",
        output: {
          type: "video",
          format: "mp4",
          quality: "480p" // Default ke 480p untuk keseimbangan kualitas & ukuran file agar tidak melebihi limit WA
        },
        audio: {
          bitrate: "128k"
        }
      };

      const dlRes = await postJson("https://hub.convert1s.com/api/download", payload, { headers });

      if (!dlRes || !dlRes.statusUrl) {
        throw new Error("Gagal menginisiasi download dari API.");
      }

      const statusUrl = dlRes.statusUrl;
      let downloadUrl = null;
      let title = dlRes.title || "YouTube Video";

      // 3. Polling status
      const maxAttempts = 15;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await delay(3000);

        const statusRes = await customRequest(statusUrl, {
          method: "GET",
          headers
        });

        const statusData = statusRes.data;

        if (statusData.status === "completed") {
          downloadUrl = statusData.downloadUrl;
          title = statusData.title || title;
          break;
        } else if (statusData.status === "failed") {
          throw new Error("Proses download di server API gagal.");
        }
      }

      if (!downloadUrl) {
        throw new Error("Proses download timeout (server terlalu sibuk).");
      }

      // 4. Download file & send
      await sock.sendMessage(msg.key.remoteJid, {
        text: `📥 Mengunduh video: *${title}*...`,
        edit: loadingMsg.key,
      });

      let videoBuffer = await fetchBuffer(downloadUrl, { headers });
      try {
        const { transcodeToWhatsappVideo } = await import("@/src/utils/media.js");
        videoBuffer = await transcodeToWhatsappVideo(videoBuffer);
      } catch (err) {
        console.error("YouTube transcoding failed:", err);
      }

      const caption =
        `📥 *YouTube Downloader*\n\n` +
        `📝 *Title:* ${title}\n` +
        `⚡ *Quality:* 480p\n\n` +
        `⚡ _Via ytmp3.gg API_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          video: videoBuffer,
          caption: caption,
          mimetype: "video/mp4",
        },
        { quoted: msg }
      );

      // Edit loading message to success
      await sock.sendMessage(msg.key.remoteJid, {
        text: "✅ Selesai mengunduh video YouTube!",
        edit: loadingMsg.key,
      });

    } catch (err) {
      console.error("YouTube Downloader Error:", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
