import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "compress",
  aliases: ["kecilkan", "kempes", "shrink"],
  description: "Kompres video/biar <8MB untuk WhatsApp",
  usage: "(reply video)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply video yang mau dikompres.\nContoh: reply video lalu `.compress`");
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 100 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil media: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca media.");
    await reply("Kompres video...");
    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `compress-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.mp4`;
    const outFile = `${base}-out.mp4`;
    try {
      await fs.writeFile(inFile, buffer);
      await execFileAsync(
        getFfmpegPath(),
        [
          "-y",
          "-i",
          inFile,
          "-vf",
          "scale=iw*0.6:ih*0.6",
          "-c:v",
          "libx264",
          "-crf",
          "28",
          "-preset",
          "veryfast",
          "-c:a",
          "aac",
          "-b:a",
          "64k",
          outFile,
        ],
        { timeout: 90000 }
      );
      const out = await fs.readFile(outFile);
      const before = (buffer.length / 1024 / 1024).toFixed(2);
      const after = (out.length / 1024 / 1024).toFixed(2);
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: out, mimetype: "video/mp4", caption: `COMPRESS: ${before}MB → ${after}MB` },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal kompres: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
