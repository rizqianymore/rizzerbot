import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "reverse",
  aliases: ["videoreverse", "putarbalik"],
  description: "Putar balik video dan audio secara bersamaan (reverse playback)",
  usage: "(reply video pendek)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    const target = findDownloadableTarget(msg);

    if (!target) {
      return reply(
        `*REVERSE VIDEO & AUDIO*\n\n` +
          `Balas (reply) video pendek dengan *${p}reverse* untuk memutar mundur adegan dan audio.`
      );
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 25 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal mengambil media: ${err?.message || err}`);
    }

    if (!buffer?.length) return reply("Gagal membaca buffer video.");

    await reply("Memproses putar mundur video...");

    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `rev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.mp4`;
    const outFile = `${base}-reversed.mp4`;

    try {
      await fs.writeFile(inFile, buffer);

      // reverse video & areverse audio
      await execFileAsync(
        getFfmpegPath(),
        [
          "-y",
          "-i",
          inFile,
          "-vf",
          "reverse",
          "-af",
          "areverse",
          "-preset",
          "ultrafast",
          outFile,
        ],
        { timeout: 75000 }
      );

      const out = await fs.readFile(outFile);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          video: out,
          mimetype: "video/mp4",
          caption: "Hasil video putar mundur (reverse).",
        },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal me-reverse video: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
