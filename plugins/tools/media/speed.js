import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "speed",
  aliases: ["fast", "tempo", "speeds"],
  description: "Ubah kecepatan video atau audio (0.5x sampai 2.0x)",
  usage: "<angka multiplier 0.5 - 2.0> (reply video atau audio)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    const multiplierStr = (args[0] || "").replace("x", "").trim();
    const multiplier = parseFloat(multiplierStr);

    if (isNaN(multiplier) || multiplier < 0.5 || multiplier > 2.0) {
      return reply(
        `*MEDIA SPEED CHANGER*\n\n` +
          `Format: *${p}speed <0.5 - 2.0>*\n\n` +
          `Contoh:\n` +
          `• Reply video/audio: *${p}speed 1.5* (Percepat 1.5x)\n` +
          `• Reply video/audio: *${p}speed 0.75* (Perlambat 0.75x)`
      );
    }

    const target = findDownloadableTarget(msg);
    if (!target) {
      return reply(`Balas (reply) video atau audio yang ingin diubah kecepatannya.`);
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 40 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal mengunduh media: ${err?.message || err}`);
    }

    if (!buffer?.length) return reply("Gagal membaca buffer media.");

    await reply(`Mengubah kecepatan menjadi *${multiplier}x*...`);

    const isVideo = Boolean(
      msg.message?.videoMessage ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
    );

    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `spd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.tmp`;
    const outFile = isVideo ? `${base}.mp4` : `${base}.mp3`;

    try {
      await fs.writeFile(inFile, buffer);

      if (isVideo) {
        // pts multiplier = 1 / speed
        const videoPts = (1 / multiplier).toFixed(4);
        const ffmpegArgs = [
          "-y",
          "-i",
          inFile,
          "-filter_complex",
          `[0:v]setpts=${videoPts}*PTS[v];[0:a]atempo=${multiplier}[a]`,
          "-map",
          "[v]",
          "-map",
          "[a]",
          "-preset",
          "ultrafast",
          outFile,
        ];
        await execFileAsync(getFfmpegPath(), ffmpegArgs, { timeout: 60000 });
        const out = await fs.readFile(outFile);
        await sock.sendMessage(
          msg.key.remoteJid,
          { video: out, mimetype: "video/mp4", caption: `Video kecepatan *${multiplier}x*` },
          { quoted: msg }
        );
      } else {
        const ffmpegArgs = [
          "-y",
          "-i",
          inFile,
          "-vn",
          "-filter:a",
          `atempo=${multiplier}`,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "128k",
          outFile,
        ];
        await execFileAsync(getFfmpegPath(), ffmpegArgs, { timeout: 60000 });
        const out = await fs.readFile(outFile);
        await sock.sendMessage(
          msg.key.remoteJid,
          { audio: out, mimetype: "audio/mp4", ptt: false },
          { quoted: msg }
        );
      }
    } catch (err) {
      return reply(`Gagal mengubah kecepatan: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
