import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "tomp3",
  aliases: ["toaudio", "mp3", "tomp3dl"],
  description: "Convert video/audio/sticker ke MP3 (reply media)",
  usage: "(reply video/audio/voice)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply video/audio/voice yang mau jadi MP3.\nContoh: reply video lalu `.tomp3`");
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 60 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil media: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca media.");
    await reply("Convert ke MP3...");
    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `tomp3-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.mp4`;
    const outFile = `${base}.mp3`;
    try {
      await fs.writeFile(inFile, buffer);
      await execFileAsync(getFfmpegPath(), ["-y", "-i", inFile, "-vn", "-c:a", "libmp3lame", "-q:a", "2", outFile], {
        timeout: 60000,
      });
      const out = await fs.readFile(outFile);
      await sock.sendMessage(
        msg.key.remoteJid,
        { audio: out, mimetype: "audio/mpeg", fileName: `audio-${Date.now()}.mp3` },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal convert: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
