import { unifiedDownload } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "spotifydl",
  cooldownMs: 15000,
  aliases: ["spdl", "spotify", "spotdl", "spotify-dl"],
  description: "Unduh lagu dari Spotify via pure link engine.",
  usage: "<url>",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    sendTyping();
    const text = args[0]?.trim();
    const currentPrefix = prefix || ".";

    if (!text || !/open\.spotify\.com\/track/i.test(text)) {
      return reply(
        `┌── SPOTIFY DOWNLOADER\n` +
          `│ Format: ${currentPrefix}spdl <url track>\n` +
          `└─\n\n` +
          `Contoh: ${currentPrefix}spdl https://open.spotify.com/track/xxxx`
      );
    }

    try {
      const { buffer, info } = await unifiedDownload(text, { mode: "audio", logger, timeoutMs: 15000 });
      if (!buffer?.length) throw new Error("Gagal mengambil audio Spotify.");
      const title = info?.title || "Spotify Track";
      const artist = info?.uploader || "Spotify";
      const filename = `${artist} - ${title}.mp3`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          audio: buffer,
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
