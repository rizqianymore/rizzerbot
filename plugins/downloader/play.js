import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

const MAX_QUERY_LENGTH = 120;

export default {
  name: "play",
  cooldownMs: 30000,
  aliases: ["spotifysearch", "music", "musik", "lagu", "searchplay"],
  description: "Cari lagu dari judul lalu kirim langsung sebagai MP3 (tanpa perlu copy-paste link).",
  usage: "<judul lagu>",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();

    const query = args.join(" ").trim().slice(0, MAX_QUERY_LENGTH);
    const currentPrefix = prefix || ".";
    const remoteJid = msg.key.remoteJid;

    if (!query) {
      return reply(
        `*MUSIC PLAYER*\n\n` +
          `Ketik judul lagu, bot akan mencarinya lalu mengirim audionya sebagai MP3.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}play Justin Bieber Peaches\`\n` +
          `\`${currentPrefix}play Sheila On 7 Dan\`\n\n` +
          `_Untuk link Spotify langsung, gunakan perintah \`${currentPrefix}spotifydl <url>\`._`
      );
    }

    try {
      // Pencarian otomatis via YouTube (yt-dlp ytsearch)
      const searchUrl = `ytsearch5:${query}`;
      const search = await probe(searchUrl, { timeoutMs: 45000 }).catch((err) => {
        logger?.warn?.(`[play search] ${err?.message || err}`);
        return null;
      });

      const entries = Array.isArray(search?.entries) ? search.entries.filter(Boolean) : [];
      if (entries.length === 0) {
        throw new Error("Lagu tidak ditemukan. Coba judul atau nama penyanyi yang lebih spesifik.");
      }

      const entry = entries[0];
      const videoUrl = entry.webpage_url || entry.original_url || entry.url;
      if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
        throw new Error("Hasil pencarian tidak memiliki link yang valid.");
      }

      const title = (entry.title || query).toString().trim();
      const channel = (entry.uploader || entry.channel || "").toString().trim();
      const durationSec = Number(entry.duration) || 0;

      await sendTyping();
      const dl = await downloadMedia(videoUrl, { mode: "audio" });
      if (!dl?.buffer?.length) throw new Error("Audio kosong / gagal diunduh.");

      const lines = ["*MUSIC PLAYER*"];
      if (title) lines.push(`Judul: ${title}`);
      if (channel) lines.push(`Channel: ${channel}`);
      if (durationSec > 0) {
        const minutes = Math.floor(durationSec / 60);
        const seconds = String(durationSec % 60).padStart(2, "0");
        lines.push(`Durasi: ${minutes}:${seconds}`);
      }
      lines.push(`Sumber: YouTube (pencarian judul)`);

      await sock.sendMessage(
        remoteJid,
        {
          audio: dl.buffer,
          mimetype: "audio/mpeg",
          fileName: `${title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80)}.mp3`,
          ptt: false,
        },
        { quoted: msg }
      );

      // Kirim info sebagai teks terpisah agar audio tetap bersih tanpa caption.
      await reply(lines.join("\n"));
    } catch (err) {
      logger?.warn?.(`[play] ${err?.message || err}`);
      await reply(`Gagal mencari/mengirim lagu: ${err?.message || "Lagu tidak ditemukan."}`);
    }
  },
};
