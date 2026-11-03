import { unifiedDownload, buildCaption, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "tiktok",
  cooldownMs: 30000,
  aliases: ["tt", "tikdl", "ttdl"],
  description: "Download TikTok video/music (tanpa watermark) — auto convert biar kebuka di WA",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    if (!url) return reply("Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");

    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      const { buffer, info } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh media TikTok.");

      const caption = buildCaption("TIKTOK", {
        title: info?.title || "",
        author: info?.uploader || info?.author || "",
        duration: info?.duration || 0,
      });

      const mimetype = sniffMime(buffer, isAudio ? "audio/mpeg" : "video/mp4");
      await sock.sendMessage(
        msg.key.remoteJid,
        !isAudio
          ? mimetype.startsWith("image/")
            ? { image: buffer, caption }
            : { video: buffer, caption, mimetype: "video/mp4" }
          : { audio: buffer, mimetype: "audio/mpeg", ptt: false },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal: ${err.message}`);
    }
  },
};
