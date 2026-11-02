import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "soundcloud",
  aliases: ["scdl", "sc", "soundclouddl"],
  description: "Download audio SoundCloud (free via yt-dlp)",
  usage: "<url soundcloud>, cth: soundcloud https://soundcloud.com/artist/track",
  category: "Downloader & Media",
  cooldownMs: 15000,
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    const url = (args[0] || "").trim();
    if (!url || !/soundcloud\.com/i.test(url)) {
      return reply("Kirim link SoundCloud!\nContoh: `.soundcloud https://soundcloud.com/xxx/yyy`");
    }
    await sendTyping();
    try {
      const info = await probe(url, { timeoutMs: 30000 }).catch(() => null);
      const dl = await downloadMedia(url, { mode: "audio" });
      if (!dl?.buffer?.length) throw new Error("Gagal download audio.");
      const title = (info?.title || "soundcloud").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
      await sock.sendMessage(
        msg.key.remoteJid,
        { audio: dl.buffer, mimetype: "audio/mpeg", fileName: `${title}.mp3` },
        { quoted: msg }
      );
      if (info?.title) await reply(`*SOUNDCLOUD*\nJudul: ${info.title}\nUploader: ${info.uploader || "-"}`);
    } catch (err) {
      logger?.warn?.(`[soundcloud] ${err?.message || err}`);
      return reply(`Gagal SoundCloud: ${err?.message || err}`);
    }
  },
};
