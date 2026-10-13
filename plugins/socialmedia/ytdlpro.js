import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "ytdlpro",
  aliases: ["ytdl", "yt"],
  description: "Download video/audio YouTube menggunakan engine yt-dlp",
  usage: "<url> [mp3]",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("❌ Masukkan link YouTube! Contoh: *.ytdl https://youtu.be/xxx*");

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");
    await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let buffer = null;
      let info = null;
      let viaKolId = false;

      // 1. Coba kol.id dulu (cepat, tanpa dependensi lokal) untuk mode video
      if (!isAudio) {
        try {
          const { downloadYoutube } = await import("@/src/services/fetch/kolid.js");
          const { fetchBuffer } = await import("@/src/services/network/scrape.js");
          const yt = await downloadYoutube(url, { maxQuality: "720" });
          if (yt?.videoUrl && yt.hasAudio) {
            const buf = await fetchBuffer(yt.videoUrl, {
              "User-Agent": "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
              "Referer": "https://www.youtube.com/",
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

      // 2. Fallback engine yt-dlp
      if (!buffer) {
        // Ambil metadata video
        try {
          info = await probe(url);
        } catch (_e) {
          // jika gagal probe, tetap lanjut coba download langsung
        }

        // Download menggunakan engine yt-dlp
        const dl = await downloadMedia(url, {
          mode: isAudio ? "audio" : "video",
          quality: "720",
        });
        buffer = dl.buffer;
      }

      const lines = ["*YOUTUBE DOWNLOADER*"];
      if (info?.title) lines.push(`Judul: ${info.title}`);
      if (info?.uploader || info?.channel) lines.push(`Channel: ${info.uploader || info.channel}`);
      if (info?.quality) lines.push(`Kualitas: ${info.quality}`);
      if (viaKolId) lines.push(`Sumber: kol.id`);
      if (info?.duration) {
        const mins = Math.floor(info.duration / 60);
        const secs = info.duration % 60;
        lines.push(`Durasi: ${mins}m ${secs}s`);
      }
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        isAudio
          ? { audio: buffer, mimetype: "audio/mpeg" }
          : { video: buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );

      await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Gagal mendownload: ${err.message}`);
    }
  },
};
