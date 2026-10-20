import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "ytdlpro",
  cooldownMs: 30000,
  aliases: ["ytdl", "yt"],
  description: "Download video/audio YouTube menggunakan engine yt-dlp",
  usage: "<url> [mp3]",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link YouTube! Contoh: *.ytdl https://youtu.be/xxx*");

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");

    try {
      let buffer = null;
      let info = null;
      let viaKolId = false;

      if (!isAudio) {
        try {
          const { downloadYoutube } = await import("@/src/services/fetch/kolid.js");
          const { fetchBuffer } = await import("@/src/services/network/scrape.js");
          const yt = await downloadYoutube(url, { maxQuality: "720p" });
          if (yt?.videoUrl && yt.hasAudio) {
            const buf = await fetchBuffer(yt.videoUrl, {
              "User-Agent":
                "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
              Referer: "https://www.youtube.com/",
            });
            if (buf && buf.length < 90 * 1024 * 1024) {
              buffer = buf;
              viaKolId = true;
              info = {
                title: yt.title,
                uploader: yt.channelName,
                duration: yt.duration,
                quality: yt.quality,
              };
            }
          }
        } catch (_) {}
      }

      if (!buffer) {
        const [meta, dl] = await Promise.all([
          probe(url, { timeoutMs: 20000 }).catch(() => null),
          downloadMedia(url, {
            mode: isAudio ? "audio" : "video",
            quality: "720",
          }),
        ]);
        info = meta;
        buffer = dl.buffer;
      }

      const lines = ["*YOUTUBE DOWNLOADER*"];
      if (info?.title) lines.push(`Judul: ${info.title}`);
      if (info?.uploader || info?.channel) lines.push(`Channel: ${info.uploader || info.channel}`);
      if (info?.quality) lines.push(`Kualitas: ${info.quality}`);
      if (viaKolId) lines.push(`Sumber: kol.id`);
      if (info?.duration) {
        const mins = Math.floor(info.duration / 60);
        const secs = Math.floor(info.duration % 60);
        lines.push(`Durasi: ${mins}m ${secs}s`);
      }
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        isAudio ? { audio: buffer, mimetype: "audio/mpeg" } : { video: buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal mendownload: ${err.message}`);
    }
  },
};
