import axios from "axios";
import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "spotifydl",
  cooldownMs: 30000,
  aliases: ["spdl", "spotify", "spotdl", "spotify-dl"],
  description: "Unduh lagu dari Spotify (via direct API & YouTube Music engine)",
  usage: "<url>",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const text = args[0]?.trim();
    const currentPrefix = prefix || ".";

    if (!text || !/open\.spotify\.com\/track/i.test(text)) {
      return reply(
        `*SPOTIFY DOWNLOADER*\n\n` +
          `Masukkan link track Spotify yang valid.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}spdl https://open.spotify.com/track/3RY0NyQQXxuAiyk5eAS4fC\``
      );
    }

    try {
      let audioBuffer = null;
      let title = "";
      let artist = "";

      // 1. Coba via API Nexray
      try {
        const apiUrl = `https://api.nexray.eu.cc/downloader/spotify?url=${encodeURIComponent(text)}`;
        const res = await axios.get(apiUrl, { timeout: 15000 });
        if (res.data?.status && res.data?.result?.url) {
          const downloadUrl = res.data.result.url;
          title = res.data.result.title || "";
          artist = res.data.result.artist || "";
          const dlRes = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 30000 });
          if (dlRes.data && dlRes.data.length > 0) {
            audioBuffer = Buffer.from(dlRes.data);
          }
        }
      } catch (err) {
        logger?.warn?.(`[spotifydl api] ${err?.message || err}`);
      }

      // 2. Fallback via engine yt-dlp search jika API direct down
      if (!audioBuffer) {
        try {
          const info = await probe(text, { timeoutMs: 25000 }).catch(() => null);
          const trackTitle = info?.title || "Spotify Track";
          const dl = await downloadMedia(text, { mode: "audio" });
          if (dl?.buffer?.length > 0) {
            audioBuffer = dl.buffer;
            title = trackTitle;
            artist = info?.uploader || "Spotify";
          }
        } catch (ytdlErr) {
          logger?.warn?.(`[spotifydl ytdlp] ${ytdlErr?.message || ytdlErr}`);
        }
      }

      if (!audioBuffer) {
        throw new Error("Gagal mengambil audio Spotify dari semua engine.");
      }

      const filename = `${artist || "Spotify"} - ${title || "Audio"}.mp3`;
      const remoteJid = msg.key.remoteJid;

      await sock.sendMessage(
        remoteJid,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: filename.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80),
          ptt: false,
        },
        { quoted: msg }
      );
    } catch (error) {
      logger?.warn?.(`[spotifydl] ${error.message}`);
      await reply(`Terjadi kesalahan saat memproses tautan Spotify: ${error.message}`);
    }
  },
};
