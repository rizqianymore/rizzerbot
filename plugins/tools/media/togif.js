import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "togif",
  aliases: ["gif", "videotogif"],
  description: "Convert video ke GIF (reply video, max 10 detik)",
  usage: "(reply video)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply video yang mau jadi GIF.\nContoh: reply video lalu `.togif`");
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 40 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil media: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca media.");
    await reply("Convert ke GIF...");
    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `togif-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.mp4`;
    const outFile = `${base}.gif`;
    try {
      await fs.writeFile(inFile, buffer);
      await execFileAsync(
        getFfmpegPath(),
        [
          "-y",
          "-i",
          inFile,
          "-t",
          "10",
          "-vf",
          "fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
          "-loop",
          "0",
          outFile,
        ],
        { timeout: 60000 }
      );
      const out = await fs.readFile(outFile);
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: out, mimetype: "video/mp4", gifPlayback: true, caption: "GIF" },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal convert GIF: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
