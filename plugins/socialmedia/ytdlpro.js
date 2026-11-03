import { unifiedDownload, buildCaption, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "ytdlpro",
  cooldownMs: 30000,
  aliases: ["ytdl", "yt"],
  description: "Download video/audio YouTube — auto convert mp4/mp3",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link YouTube! Contoh: *.ytdl https://youtu.be/xxx*");

    const isAudio = args.some((a) => a.toLowerCase() === "mp3" || a.toLowerCase() === "audio");

    try {
      const { buffer, info, source } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mendownload YouTube.");

      const caption = buildCaption("YOUTUBE", {
        title: info?.title || "",
        author: info?.uploader || info?.channel || "",
        duration: info?.duration || 0,
      });
      const extra = source ? `\nEngine: ${source}` : "";
      const mimetype = sniffMime(buffer, isAudio ? "audio/mpeg" : "video/mp4");
      await sock.sendMessage(
        msg.key.remoteJid,
        isAudio ? { audio: buffer, mimetype: "audio/mpeg" } : mimetype.startsWith("image/") ? { image: buffer, caption: caption + extra } : { video: buffer, caption: caption + extra, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal mendownload: ${err.message}`);
    }
  },
};
