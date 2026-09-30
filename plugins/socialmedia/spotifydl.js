// plugins/socialmedia/spotifydl.js — perintah "spotifydl" (1 file = 1 perintah).
import axios from "axios";


export default {
  "name": "spotifydl",
  "aliases": ["spdl","spotify","spotdl","spotify-dl"],
  "description": "Unduh lagu dari Spotify",
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const text = args[0]?.trim();
      const currentPrefix = prefix || ".";

      if (!text || !/open\.spotify\.com\/track/i.test(text)) {
        return reply(
          `🎵 *Spotify Downloader*\n\n` +
          `Masukkan link track Spotify yang valid.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}spdl https://open.spotify.com/track/3RY0NyQQXxuAiyk5eAS4fC\``
        );
      }

      await reply("⏳ Mengunduh lagu dari Spotify...");

      try {
        const apiUrl = `https://api.nexray.eu.cc/downloader/spotify?url=${encodeURIComponent(text)}`;
        const res = await axios.get(apiUrl, { timeout: 45000 });
        const data = res.data;

        if (!data || !data.status || !data.result || !data.result.url) {
          return reply("⚠️ Gagal mengambil lagu. Server penyedia tidak memberikan tautan unduhan yang valid.");
        }

        const { title, artist, url } = data.result;
        const filename = `${artist || "Spotify"} - ${title || "Audio"}.mp3`;
        const remoteJid = msg.key.remoteJid;

        await sock.sendMessage(
          remoteJid,
          {
            audio: { url },
            mimetype: "audio/mpeg",
            fileName: filename,
            ptt: false,
          },
          { quoted: msg }
        );
      } catch (error) {
        console.error("[Spotify DL Error]:", error.message);
        reply(`❌ Terjadi kesalahan saat memproses tautan Spotify: ${error.message}`);
      }
    },
};
