import axios from "axios";

export default {
  "name": "spotifydl",
  "aliases": ["spdl","spotify","spotdl","spotify-dl"],
  "description": "Unduh lagu dari Spotify",
  "usage": "<url>",
  "premiumOnly": true,
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const text = args[0]?.trim();
      const currentPrefix = prefix || ".";

      if (!text || !/open\.spotify\.com\/track/i.test(text)) {
        return reply(
          `🎵 *SPOTIFY DOWNLOADER*\n\n` +
          `Masukkan link track Spotify yang valid.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}spdl https://open.spotify.com/track/3RY0NyQQXxuAiyk5eAS4fC\``
        );
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      try {
        let data = null;
        try {
          const res = await axios.get(apiUrl, { timeout: 25000 });
          data = res.data;
        } catch (_) {
          // Fallback via Bright Data Web Unlocker
          try {
            const { brightDataRequest, getBrightDataConfig } = await import("@/src/services/brightdata.js");
            if (getBrightDataConfig().apiKey) {
              data = await brightDataRequest(apiUrl, { format: "json", timeout: 35000 });
            }
          } catch (_) {}
        }

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
