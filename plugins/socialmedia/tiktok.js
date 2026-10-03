// plugins/socialmedia/tiktok.js — perintah "tiktok" (1 file = 1 perintah).
import axios from "axios";


export default {
  "name": "tiktok",
  "aliases": ["tt","tikdl","ttdl"],
  "description": "Download TikTok video/music (tanpa watermark)",
  "usage": "<url> [mp3]",
  "premiumOnly": true,
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      try {
        const { tiktokDownload, fetchBuffer } = await import("@/src/services/scrape.js");
        const info = await tiktokDownload(url);
        const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
        const dlUrl = isAudio ? info.mp3 : info.noWatermark;
        if (!dlUrl) throw new Error("Gagal menemukan link download media TikTok.");
        const isVideo = !isAudio;
        const buffer = await fetchBuffer(dlUrl, {
          "User-Agent": "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
          "Referer": "https://snaptik.fi/",
        });
        const lines = ["*TIKTOK DOWNLOADER*"];
        if (info.title) lines.push(`Judul: ${info.title}`);
        if (info.author) lines.push(`Author: ${info.author}${info.uniqueId ? ` (@${info.uniqueId})` : ""}`);
        if (info.duration) lines.push(`Durasi: ${info.duration}s`);
        if (info.playCount) lines.push(`Views: ${info.playCount.toLocaleString()}`);
        if (info.diggCount) lines.push(`Likes: ${info.diggCount.toLocaleString()}`);
        const caption = lines.join("\n");
        await sock.sendMessage(
          msg.key.remoteJid,
          isVideo
            ? { video: buffer, caption, mimetype: "video/mp4" }
            : { audio: buffer, mimetype: "audio/mpeg", ptt: false },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
};
