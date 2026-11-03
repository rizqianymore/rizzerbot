import { getMediaBuffer, findDownloadableTarget, isVideoOrAnimated } from "@/src/services/fetch/media.js";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export default {
  name: "volume",
  aliases: ["vol", "bass", "boost"],
  description: "Atur volume audio/video (0.5-3x)",
  usage: "[level 0.5-3] | reply media",
  category: "Tools",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, commandName }) => {
    await sendTyping();

    const target = findDownloadableTarget(msg);
    if (!target) {
      return reply(
        "Reply audio/video/voice yang mau diatur volumenya.\n" +
          "Contoh: reply audio lalu `.volume 2` (boost 2x)\n" +
          "Range: 0.5 - 3 | default 2x\n" +
          "Bass boost: `.bass` atau `.volume bass`"
      );
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 60 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil media: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca media.");

    // parse alias / arg
    const invoked = String(commandName || "").toLowerCase();
    const firstArg = String(args?.[0] ?? "").toLowerCase().trim();

    const isBassAlias = invoked === "bass";
    const isBassArg = firstArg === "bass";
    const isBass = isBassAlias || isBassArg;

    let level = 2.0;
    let audioFilter;

    if (isBass) {
      // bass boost filter
      audioFilter = "bass=g=10:d=0.7";
    } else {
      // volume mode: parse numeric arg
      if (args.length > 0 && firstArg) {
        const parsed = parseFloat(firstArg);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          level = parsed;
        } else {
          // invalid arg -> default 2x for boost
          level = 2.0;
        }
      } else {
        level = 2.0;
      }
      // clamp 0.5 - 3
      if (level < 0.5) level = 0.5;
      if (level > 3) level = 3;
      audioFilter = `volume=${level}`;
    }

    // detect video vs audio
    let isVideo = false;
    try {
      if (target?.message?.videoMessage) isVideo = true;
      else if (isVideoOrAnimated(buffer)) isVideo = true;
    } catch (_) {}

    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `volume-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    // ext based on detect (mp4 vs mp3)
    const inFile = isVideo ? `${base}.mp4` : `${base}.mp3`;
    const outFile = isVideo ? `${base}-out.mp4` : `${base}-out.mp3`;

    const statusLabel = isBass ? "bass boost (bass=g=10)" : `volume ${level}x`;
    await reply(`Proses ${statusLabel}...`);

    try {
      await fs.writeFile(inFile, buffer);

      if (isVideo) {
        // Try keep video codec copy if possible: -c:v copy -c:a aac
        try {
          await execFileAsync(
            getFfmpegPath(),
            ["-y", "-i", inFile, "-af", audioFilter, "-c:v", "copy", "-c:a", "aac", outFile],
            { timeout: 90000 }
          );
        } catch (_) {
          // fallback re-encode video if copy fails
          await execFileAsync(
            getFfmpegPath(),
            ["-y", "-i", inFile, "-af", audioFilter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", outFile],
            { timeout: 90000 }
          );
        }
      } else {
        // audio only
        await execFileAsync(
          getFfmpegPath(),
          ["-y", "-i", inFile, "-af", audioFilter, "-vn", "-c:a", "libmp3lame", "-q:a", "2", outFile],
          { timeout: 90000 }
        );
      }

      const out = await fs.readFile(outFile);
      if (!out?.length) return reply("Gagal proses volume: output kosong.");

      if (isVideo) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { video: out, mimetype: "video/mp4", caption: `Volume ${isBass ? "bass boost" : `${level}x`} done` },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { audio: out, mimetype: "audio/mpeg", fileName: `volume-${Date.now()}.mp3` },
          { quoted: msg }
        );
      }
    } catch (err) {
      return reply(`Gagal atur volume: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
