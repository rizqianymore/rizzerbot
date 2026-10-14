export default {
  name: "xdl",
  aliases: ["twitterdl", "twtdl", "xdown", "twdl"],
  description: "Download video/music dari X/Twitter",
  usage: "<url> [mp3]",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link X/Twitter! Contoh: *.xdl https://x.com/user/status/xxxx*");
    if (!/(^|\.)(twitter\.com|x\.com)\//i.test(url)) {
      return reply("Link harus dari Twitter/X (twitter.com atau x.com).");
    }
    try {
      const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
      const { downloadMedia, probe } = await import("@/src/services/fetch/ytdlp.js");
      const pInfo = await probe(url).catch(() => null);
      const dl = await downloadMedia(url, { mode: isAudio ? "audio" : "video" });
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
