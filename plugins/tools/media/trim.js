import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";
import { resolveFfmpegPath } from "@/src/utils/termux.js";

const execFileAsync = promisify(execFile);

function parseTime(str) {
  if (!str) return NaN;
  const s = String(str).trim();
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const parts = s.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return NaN;
}

function isImageBuffer(buf) {
  if (!buf || buf.length < 4) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // BMP
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  // WEBP still image (RIFF + WEBP without ANIM)
  if (buf.length >= 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") {
    const hasAnim = buf.includes(Buffer.from("ANIM")) || buf.includes(Buffer.from("ANMF"));
    if (!hasAnim) return true;
  }
  return false;
}

function formatSec(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default {
  name: "trim",
  aliases: ["cut", "potong"],
  description: "Potong audio/video durasi tertentu",
  usage: "<00:00-00:10> | reply media",
  category: "Tools",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();

    const raw = args.join(" ").trim();
    if (!raw) {
      return reply(
        "Format: `.trim 00:10-00:20` atau `.trim 10-20` atau `.trim 00:10 00:20`\nContoh single: `.trim 00:10` = 0 sampai 00:10\nReply audio/video yang mau dipotong."
      );
    }

    let parts;
    if (raw.includes("-")) {
      parts = raw
        .split("-")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      parts = raw
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    let start, end;
    if (parts.length === 1) {
      end = parseTime(parts[0]);
      start = 0;
    } else if (parts.length === 2) {
      start = parseTime(parts[0]);
      end = parseTime(parts[1]);
    } else {
      return reply("Format waktu salah. Contoh: `.trim 00:05-00:15` atau `.trim 5-15` atau `.trim 00:10`");
    }

    if (Number.isNaN(start) || Number.isNaN(end) || end <= 0 || end <= start || start < 0) {
      return reply("Waktu tidak valid. Contoh: `.trim 00:05-00:15` (start < end)\nSingle: `.trim 10` = potong 0-10 detik");
    }

    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply audio/video yang mau dipotong.\nContoh: reply video lalu `.trim 00:05-00:15`");

    // detect image via message type early
    const targetType = Object.keys(target.message || {})[0] || "";
    if (targetType === "imageMessage") return reply("Hanya audio/video yang bisa dipotong.");

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 80 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil media: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca media.");

    if (isImageBuffer(buffer)) return reply("Hanya audio/video");

    // determine video vs audio
    let isVideo = false;
    if (targetType === "videoMessage") isVideo = true;
    else if (targetType === "audioMessage") isVideo = false;
    else if (targetType === "documentMessage") {
      const mtype = target.message?.documentMessage?.mimetype || "";
      if (mtype.startsWith("video")) isVideo = true;
      else if (mtype.startsWith("audio")) isVideo = false;
      else {
        // fallback by buffer ftyp
        const ftyp = buffer.slice(4, 8).toString();
        isVideo = ftyp === "ftyp" || ftyp === "moov";
      }
    } else if (targetType === "stickerMessage") {
      // sticker is not supported for trim, treat as image/video check already
      // fallback to buffer check
      const ftyp = buffer.slice(4, 8).toString();
      isVideo = ftyp === "ftyp" || ftyp === "moov" || buffer.slice(0, 3).toString() === "GIF";
      if (!isVideo) return reply("Hanya audio/video");
    } else {
      const ftyp = buffer.slice(4, 8).toString();
      if (ftyp === "ftyp" || ftyp === "moov") isVideo = true;
      else isVideo = false;
    }

    await reply(`Memotong ${formatSec(start)} → ${formatSec(end)}...`);

    // resolve ffmpeg path (support both helpers)
    const ffmpegPath = typeof getFfmpegPath === "function" ? getFfmpegPath() : resolveFfmpegPath();

    const tmpDir = path.join(os.tmpdir(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `trim-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.${isVideo ? "mp4" : "mp3"}`;
    const outFile = `${base}-out.${isVideo ? "mp4" : "mp3"}`;

    try {
      await fs.writeFile(inFile, buffer);

      try {
        await execFileAsync(
          ffmpegPath,
          ["-y", "-i", inFile, "-ss", String(start), "-to", String(end), "-c", "copy", outFile],
          { timeout: 60000 }
        );
      } catch (_) {
        // fallback re-encode
        const reEncodeArgs = isVideo
          ? ["-y", "-i", inFile, "-ss", String(start), "-to", String(end), "-c:v", "libx264", "-c:a", "aac", outFile]
          : ["-y", "-i", inFile, "-ss", String(start), "-to", String(end), "-c:a", "aac", outFile];
        await execFileAsync(ffmpegPath, reEncodeArgs, { timeout: 60000 });
      }

      const out = await fs.readFile(outFile);
      if (!out?.length) return reply("Gagal potong: output kosong.");

      if (isVideo) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { video: out, mimetype: "video/mp4", caption: `Trim ${formatSec(start)} - ${formatSec(end)}` },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { audio: out, mimetype: "audio/mpeg", fileName: `trim-${Date.now()}.mp3` },
          { quoted: msg }
        );
      }
    } catch (err) {
      return reply(`Gagal potong: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
