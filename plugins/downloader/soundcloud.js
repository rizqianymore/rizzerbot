import { unifiedDownload } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "soundcloud",
  aliases: ["scdl", "sc", "soundclouddl"],
  description: "Download audio SoundCloud langsung via link downloader",
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
      const dl = await unifiedDownload(url, { mode: "audio", logger, timeoutMs: 15000 });
      if (!dl?.buffer?.length) throw new Error("Gagal download audio SoundCloud.");
      const title = (dl.info?.title || "soundcloud").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
      await sock.sendMessage(
        msg.key.remoteJid,
        { audio: dl.buffer, mimetype: "audio/mpeg", fileName: `${title}.mp3` },
        { quoted: msg }
      );
      if (dl.info?.title) await reply(`*SOUNDCLOUD*\nJudul: ${dl.info.title}\nUploader: ${dl.info.uploader || "-"}`);
    } catch (err) {
      logger?.warn?.(`[soundcloud] ${err?.message || err}`);
      return reply(`Gagal SoundCloud: ${err?.message || err}`);
    }
  },
};
