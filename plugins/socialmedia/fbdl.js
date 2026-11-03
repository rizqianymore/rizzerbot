import { unifiedDownload, buildCaption, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "fbdl",
  cooldownMs: 30000,
  aliases: ["facebookdl", "fbdown", "fbvideo"],
  description: "Download video dari Facebook — auto convert biar kebuka di WA",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link Facebook! Contoh: *.fbdl https://www.facebook.com/reel/xxxx*");
    if (!/(?:^|\.|\/\/)(facebook\.com|fb\.com|fb\.watch)\//i.test(url)) {
      return reply("Link harus dari Facebook (facebook.com, fb.com, atau fb.watch).");
    }
    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      const { buffer, info } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh media Facebook.");

      const caption = buildCaption("FACEBOOK", {
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
