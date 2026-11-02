import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "toptt",
  aliases: ["tovn", "ptt", "voicenote"],
  description: "Convert video/audio ke voice note (PTT opus)",
  usage: "(reply video/audio)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply video/audio yang mau jadi VN.\nContoh: reply audio lalu `.toptt`");
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 40 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil media: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca media.");
    await reply("Convert ke VN...");
    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `toptt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.mp4`;
    const outFile = `${base}.ogg`;
    try {
      await fs.writeFile(inFile, buffer);
      await execFileAsync(
        getFfmpegPath(),
        ["-y", "-i", inFile, "-vn", "-c:a", "libopus", "-b:a", "96k", "-vbr", "on", outFile],
        { timeout: 60000 }
      );
      const out = await fs.readFile(outFile);
      await sock.sendMessage(
        msg.key.remoteJid,
        { audio: out, mimetype: "audio/ogg; codecs=opus", ptt: true },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal convert VN: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
