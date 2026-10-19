export default {
  name: "fbdl",
  cooldownMs: 30000,
  aliases: ["facebookdl", "fbdown", "fbvideo"],
  description: "Download video dari Facebook (postingan, reels, watch)",
  usage: "<url> [mp3]",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link Facebook! Contoh: *.fbdl https://www.facebook.com/reel/xxxx*");
    if (!/(?:^|\.|\/\/)(facebook\.com|fb\.com|fb\.watch)\//i.test(url)) {
      return reply("Link harus dari Facebook (facebook.com, fb.com, atau fb.watch).");
    }
    try {
      const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
      const { downloadMedia, probe } = await import("@/src/services/fetch/ytdlp.js");
      const [pInfo, dl] = await Promise.all([
        probe(url, { timeoutMs: 20000 }).catch(() => null),
        downloadMedia(url, { mode: isAudio ? "audio" : "video" }),
      ]);
      const lines = ["*FACEBOOK DOWNLOADER*"];
      const title = pInfo?.title || "";
      const author = pInfo?.uploader || "";
      if (title) lines.push(`Judul: ${title}`);
      if (author) lines.push(`Author: ${author}`);
      if (pInfo?.duration) lines.push(`Durasi: ${pInfo.duration}s`);

      await sock.sendMessage(
        msg.key.remoteJid,
        !isAudio
          ? { video: dl.buffer, caption: lines.join("\n"), mimetype: "video/mp4" }
          : { audio: dl.buffer, mimetype: "audio/mpeg", ptt: false },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal: ${err.message}`);
    }
  },
};
