import { unifiedDownload, buildCaption, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "xdl",
  cooldownMs: 30000,
  aliases: ["twitterdl", "twtdl", "xdown", "twdl"],
  description: "Download video/music dari X/Twitter — auto convert",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link X/Twitter! Contoh: *.xdl https://x.com/user/status/xxxx*");
    if (!/(?:^|\.|\/\/)(twitter\.com|x\.com)\//i.test(url)) {
      return reply("Link harus dari Twitter/X (twitter.com atau x.com).");
    }
    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      const { buffer, info } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh media X/Twitter.");
      const caption = buildCaption("X/TWITTER", {
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
