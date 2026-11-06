import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

export default {
  name: "mute",
  aliases: ["unmuteaudio", "removeaudio", "hilangsuara"],
  description: "Hapus suara (audio track) dari file video sehingga menjadi video hening / tanpa suara",
  usage: "(reply video)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    const target = findDownloadableTarget(msg);

    if (!target) {
      return reply(
        `*MUTE VIDEO (HAPUS AUDIO)*\n\n` +
          `Balas (reply) video yang ingin dihilangkan suaranya dengan *${p}mute*.`
      );
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 50 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal mengambil media: ${err?.message || err}`);
    }

    if (!buffer?.length) return reply("Gagal membaca buffer video.");

    await reply("Menghapus suara dari video...");

    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `mute-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.mp4`;
    const outFile = `${base}-muted.mp4`;

    try {
      await fs.writeFile(inFile, buffer);

      // Gunakan -an (audio null) dan salin video stream langsung tanpa re-encode
      await execFileAsync(
        getFfmpegPath(),
        ["-y", "-i", inFile, "-c:v", "copy", "-an", outFile],
        { timeout: 60000 }
      );

      const out = await fs.readFile(outFile);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          video: out,
          mimetype: "video/mp4",
          caption: "Video berhasil di-mute (tanpa audio).",
        },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal menghapus suara video: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
