// plugins/socialmedia/threaddl.js — perintah "threaddl" (1 file = 1 perintah).
import axios from "axios";


export default {
  "name": "threaddl",
  "aliases": ["tdl","threads","threadsdl"],
  "description": "Download foto dan video dari postingan Threads",
  "usage": "<url>",
  "premiumOnly": true,
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const url = args[0]?.trim();
      const currentPrefix = prefix || ".";

      if (!url || !/threads/i.test(url)) {
        return reply(
          `🧵 *THREADS DOWNLOADER*\n\n` +
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
          `🧵 *THREADS DOWNLOADER*\n\n` +
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
};
