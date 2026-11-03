import { unifiedDownload } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "spotifydl",
  cooldownMs: 30000,
  aliases: ["spdl", "spotify", "spotdl", "spotify-dl"],
  description: "Unduh lagu dari Spotify — via yt-dlp audio engine (tanpa API sulit)",
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
      // HAPUS api.nexray yang sering down — langsung yt-dlp (support spotify -> youtube search)
      const { buffer, info } = await unifiedDownload(text, { mode: "audio", logger });
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
