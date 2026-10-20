export default {
  name: "xdl",
  cooldownMs: 30000,
  aliases: ["twitterdl", "twtdl", "xdown", "twdl"],
  description: "Download video/music dari X/Twitter",
  usage: "<url> [mp3]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link X/Twitter! Contoh: *.xdl https://x.com/user/status/xxxx*");
    if (!/(?:^|\.|\/\/)(twitter\.com|x\.com)\//i.test(url)) {
      return reply("Link harus dari Twitter/X (twitter.com atau x.com).");
    }
    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      const { downloadMedia, probe } = await import("@/src/services/fetch/ytdlp.js");
      const [pInfo, dl] = await Promise.all([
        probe(url, { timeoutMs: 20000 }).catch(() => null),
        downloadMedia(url, { mode: isAudio ? "audio" : "video" }),
      ]);
      const lines = ["*X/TWITTER DOWNLOADER*"];
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
