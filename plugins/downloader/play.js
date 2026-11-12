import { unifiedDownload } from "@/src/services/fetch/downloaderCompat.js";
import { request } from "@/src/utils/request.js";

const MAX_QUERY_LENGTH = 120;

async function searchYoutube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const html = await request.text(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "id,en;q=0.9",
    },
    timeout: 10000,
  });

  const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (!videoIdMatch) return null;

  const videoId = videoIdMatch[1];
  const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
  const uploaderMatch = html.match(/"ownerText":\{"runs":\[\{"text":"([^"]+)"/);

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: titleMatch ? titleMatch[1] : query,
    channel: uploaderMatch ? uploaderMatch[1] : "",
  };
}

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
      const result = await searchYoutube(query).catch((err) => {
        logger?.warn?.(`[play search] ${err?.message || err}`);
        return null;
      });

      if (!result?.url) {
        throw new Error("Lagu tidak ditemukan. Coba judul atau nama penyanyi yang lebih spesifik.");
      }

      const title = (result.title || query).toString().trim();
      const channel = (result.channel || "").toString().trim();

      await sendTyping();
      const dl = await unifiedDownload(result.url, { mode: "audio", logger, timeoutMs: 15000 });
      if (!dl?.buffer?.length) throw new Error("Audio kosong / gagal diunduh.");

      const lines = ["*MUSIC PLAYER*"];
      if (title) lines.push(`Judul: ${title}`);
      if (channel) lines.push(`Channel: ${channel}`);
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

      await reply(lines.join("\n"));
    } catch (err) {
      logger?.warn?.(`[play] ${err?.message || err}`);
      await reply(`Gagal mencari/mengirim lagu: ${err?.message || "Lagu tidak ditemukan."}`);
    }
  },
};
