import axios from "axios";
import { fetchBuffer } from "@/src/utils/scraping.js";

const BASE_URL = "https://workers-playground-cool-wood-c008.accoutydusra.workers.dev";

function cleanText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueByUrl(list = []) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

function normalizeResult(data = {}) {
  const result = [];

  const videoQualities = uniqueByUrl(data.video?.qualities || []);
  for (const item of videoQualities) {
    result.push({
      type: "video",
      quality: item.quality || null,
      url: item.url,
    });
  }

  const images = uniqueByUrl(data.images?.urls || []);
  for (const item of images) {
    result.push({
      type: "image",
      url: item.url,
    });
  }

  return result;
}

export default {
  name: "threads",
  aliases: ["tdl", "threaddl", "threadsdl"],
  description: "Mengunduh foto dan video dari postingan Threads secara instan.",
  usage: "<link postingan Threads>",
  example: "threads https://www.threads.net/@zuck/post/xxx",
  category: "Downloader",
  premiumOnly: true,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping }) => {
    const url = args[0];

    if (!url || !/threads\.(net|com)/i.test(url)) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `⚠️ *Format Perintah Threads Downloader*\n\n` +
            `Masukkan tautan/link postingan Threads yang valid.\n\n` +
            `*Contoh:* \`.threads https://www.threads.net/@zuck/post/xxx\``,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const loadingMsg = await sock.sendMessage(
      msg.key.remoteJid,
      { text: "⏳ Sedang memproses dan mengunduh media dari Threads..." },
      { quoted: msg }
    );

    try {
      const res = await axios.get(BASE_URL, {
        timeout: 45000,
        validateStatus: () => true,
        params: { url: url, action: "info" },
        headers: {
          "sec-ch-ua-platform": `"Android"`,
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
          accept: "application/json",
          "content-type": "application/json",
          origin: "https://threadsvid.com",
          referer: "https://threadsvid.com/",
        },
      });

      const data = res.data || {};
      const info = data.data || {};
      const result = normalizeResult(info);

      if (res.status >= 300 || data.success !== true || result.length === 0) {
        const errMsg =
          data.message || data.error || "Postingan privat, tidak ditemukan, atau media tidak tersedia.";
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Gagal mengambil media Threads: ${errMsg}`,
          edit: loadingMsg.key,
        });
        return;
      }

      const description = cleanText(info.title) || cleanText(info.description) || "-";
      const author = info.author || "Threads User";

      const captionText =
        `🧵 *Threads Media Downloader*\n\n` +
        `├─ 👤 *Pembuat:* ${author}\n` +
        `├─ 📝 *Teks:* ${description}\n` +
        `└─ 📊 *Total Media:* ${result.length} file\n\n` +
        `⚡ _Via Kyros-MD Downloader_`;

      if (result.length === 1) {
        const item = result[0];
        const mediaBuffer = await fetchBuffer(item.url);

        if (item.type === "video") {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              video: mediaBuffer,
              caption: captionText,
              mimetype: "video/mp4",
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: mediaBuffer,
              caption: captionText,
            },
            { quoted: msg }
          );
        }
      } else {
        // Multi-media post (carousel / album)
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: captionText },
          { quoted: msg }
        );

        for (let i = 0; i < result.length; i++) {
          const item = result[i];
          const mediaBuffer = await fetchBuffer(item.url);

          if (item.type === "video") {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                video: mediaBuffer,
                caption: `🎬 Media [${i + 1}/${result.length}]`,
                mimetype: "video/mp4",
              },
              { quoted: msg }
            );
          } else {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                image: mediaBuffer,
                caption: `📸 Media [${i + 1}/${result.length}]`,
              },
              { quoted: msg }
            );
          }
        }
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: "✅ Selesai mengunduh media Threads!",
        edit: loadingMsg.key,
      });
    } catch (err) {
      console.error("[Threads Downloader Error]", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Terjadi kesalahan saat memproses link Threads: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
