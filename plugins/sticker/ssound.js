import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { getMediaBuffer, createSticker, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { resolveFfmpegPath } from "@/src/utils/termux.js";

const execFileAsync = promisify(execFile);

export default {
  name: "ssound",
  aliases: ["stikersuara", "stickersound", "svoice", "sv"],
  description: "Convert video to animated sticker + ekstrak suara audio otomatis (VN pairing)",
  usage: "(reply/kirim video dengan caption .ssound)",
  category: "Sticker",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();

    const targetMsg = findDownloadableTarget(msg);
    if (!targetMsg) {
      return reply(
        "Kirim atau balas video dengan perintah:\n" +
          "│ *.ssound* — Ubah video menjadi Stiker Animasi + Audio Voice Note bersuara!"
      );
    }

    let buffer = null;
    try {
      buffer = await getMediaBuffer(sock, targetMsg);
    } catch (err) {
      return reply(`${err?.message || "Gagal membaca media video."}`);
    }

    if (!buffer || buffer.length < 100) {
      return reply("Gagal membaca video. Pastikan format video valid.");
    }

    const tmpDir = path.join(os.tmpdir(), `ssound-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsp.mkdir(tmpDir, { recursive: true });
    const inVideo = path.join(tmpDir, "input_video.mp4");
    const outAudio = path.join(tmpDir, "output_audio.mp3");

    try {
      await fsp.writeFile(inVideo, buffer);

      // 1. Buat Stiker Animasi WebP
      const stickerBuffer = await createSticker(buffer, {
        pack: "RizzerBot",
        author: "Sound Sticker",
        type: "animated",
      });

      // 2. Ekstrak audio dari video menggunakan FFmpeg
      let audioBuffer = null;
      try {
        await execFileAsync(resolveFfmpegPath(), [
          "-y",
          "-i", inVideo,
          "-vn",
          "-c:a", "libmp3lame",
          "-b:a", "128k",
          outAudio,
        ], { timeout: 30000 });
        audioBuffer = await fsp.readFile(outAudio);
      } catch (err) {
        logger?.warn?.(`[ssound] Gagal ekstrak audio (mungkin video bisu): ${err?.message}`);
      }

      const remoteJid = msg.key.remoteJid;

      // Kirim stiker
      await sock.sendMessage(
        remoteJid,
        { sticker: stickerBuffer, mimetype: "image/webp" },
        { quoted: msg }
      );

      // Kirim audio bersuara (Voice Note / Audio) jika ada track suaranya
      if (audioBuffer && audioBuffer.length > 500) {
        await sock.sendMessage(
          remoteJid,
          {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true, // dikirim sebagai Voice Note agar langsung play
          },
          { quoted: msg }
        );
      } else {
        await reply("⚠️ Stiker berhasil dibuat, tetapi video ini tidak memiliki track audio/suara.");
      }
    } catch (err) {
      logger?.error?.(`[ssound] ${err?.stack || err?.message || err}`);
      await reply(`Gagal membuat stiker bersuara: ${err.message || err}`);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
