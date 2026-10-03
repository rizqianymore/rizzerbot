// plugins/socialmedia/ytdlpro.js — perintah "ytdlpro" (1 file = 1 perintah).
import axios from "axios";

export default {
  "name": "ytdlpro",
  "aliases": ["ytdl","yt"],
  "description": "Download video/audio YouTube",
  "usage": "<url> [mp3]",
  "premiumOnly": true,
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link YouTube! Contoh: *.ytdlpro https://youtu.be/xxx*");
      const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
      const { ytToolkitDownload, cobaltDownload, fetchBuffer } = await import("@/src/services/scrape.js");
      try {
        let result;
        try {
          result = await ytToolkitDownload(url, isAudio ? { type: "audio" } : { type: "video", quality: "720" });
        } catch (ytErr) {
          result = await cobaltDownload(url, isAudio ? { mode: "audio", audioFormat: "mp3" } : { mode: "video" });
        }
        const downloadUrl = result?.url;
        if (!downloadUrl) throw new Error("Gagal mendapatkan link unduhan.");
        const buffer = await fetchBuffer(downloadUrl);
        const lines = ["*YOUTUBE DOWNLOADER*"];
        if (result?.title) lines.push(`Judul: ${result.title}`);
        if (result?.channel) lines.push(`Channel: ${result.channel}`);
        if (result?.duration) lines.push(`Durasi: ${result.duration}`);
        const caption = lines.join("\n");
        await sock.sendMessage(
          msg.key.remoteJid,
          isAudio
            ? { audio: buffer, mimetype: "audio/mpeg" }
            : { video: buffer, caption, mimetype: "video/mp4" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mendownload: ${err.message}`);
      }
    },
};
