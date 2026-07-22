import { postJson, fetchBuffer } from "@/lib/scraping.js";

export default {
  premiumOnly: true,
  description: "Mengunduh media Instagram (Foto/Video/Reels).",
  usage: "<link Instagram>",
  example: ".instagram https://www.instagram.com/p/C-hHwAoS1wB/",
  name: "instagram",
  aliases: ["ig", "igdl", "instadl"],
  category: "Downloader",
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping }) => {
    const url = args[0];

    if (!url) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap sertakan link Instagram!\nContoh: *.instagram https://www.instagram.com/p/xxxxxx*",
        },
        { quoted: msg }
      );
      return;
    }

    if (!/instagram\.com/i.test(url)) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "❌ Tautan Instagram tidak valid.",
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const loadingMsg = await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "⏳ Sedang memproses download Instagram...",
      },
      { quoted: msg }
    );

    try {
      const apiEndpoint = "https://api.zoraahub.com/fetch.php";
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "Origin": "https://downreels.com",
        "Referer": "https://downreels.com/",
      };

      const resData = await postJson(apiEndpoint, { url }, { headers });

      if (!resData || resData.status === "error") {
        throw new Error(resData?.message || "Gagal mengambil data dari API.");
      }

      // Cari media url dari response
      let mediaUrls = [];
      
      // Response format downreels biasanya mengembalikan array of media atau object data dengan array links/urls
      if (resData.videos && Array.isArray(resData.videos)) {
        mediaUrls = resData.videos.map(item => ({
          url: item.url,
          isVideo: item.isVideo === true || /mp4|video|mov/i.test(item.url)
        })).filter(item => item.url);
      } else if (Array.isArray(resData)) {
        mediaUrls = resData.map(item => ({
          url: item.url || item.download_url || item,
          isVideo: /mp4|video|mov/i.test(item.url || item.download_url || item)
        })).filter(item => item.url);
      } else if (resData.data) {
        if (Array.isArray(resData.data)) {
          mediaUrls = resData.data.map(item => ({
            url: item.url || item.download_url || item,
            isVideo: /mp4|video|mov/i.test(item.url || item.download_url || item)
          })).filter(item => item.url);
        } else if (typeof resData.data === "string") {
          mediaUrls = [{ url: resData.data, isVideo: /mp4|video|mov/i.test(resData.data) }];
        } else if (resData.data.url) {
          mediaUrls = [{ url: resData.data.url, isVideo: /mp4|video|mov/i.test(resData.data.url) }];
        }
      } else if (resData.url) {
        mediaUrls = [{ url: resData.url, isVideo: /mp4|video|mov/i.test(resData.url) }];
      } else if (resData.download_url) {
        mediaUrls = [{ url: resData.download_url, isVideo: /mp4|video|mov/i.test(resData.download_url) }];
      } else if (resData.links && Array.isArray(resData.links)) {
        mediaUrls = resData.links.map(item => ({
          url: item.url || item,
          isVideo: /mp4|video|mov/i.test(item.url || item)
        })).filter(item => item.url);
      }

      if (mediaUrls.length === 0) {
        throw new Error("Tidak menemukan URL unduhan media.");
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: `📥 Mengunduh ${mediaUrls.length} file media...`,
        edit: loadingMsg.key,
      });

      for (let i = 0; i < mediaUrls.length; i++) {
        const media = mediaUrls[i];
        const buffer = await fetchBuffer(media.url);
        
        if (media.isVideo) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              video: buffer,
              caption: `✅ Instagram Downloader (Part ${i + 1}/${mediaUrls.length})\n⚡ _Via Kyros-MD API_`,
              mimetype: "video/mp4",
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: buffer,
              caption: `✅ Instagram Downloader (Part ${i + 1}/${mediaUrls.length})\n⚡ _Via Kyros-MD API_`,
            },
            { quoted: msg }
          );
        }
      }

      // Delete loading message
      await sock.sendMessage(msg.key.remoteJid, { delete: loadingMsg.key });

    } catch (err) {
      console.error("Instagram Downloader Error:", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
