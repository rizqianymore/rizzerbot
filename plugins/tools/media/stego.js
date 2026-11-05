import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { encodeLSB, decodeLSB } from "@/src/services/forensic/stego.js";

export default {
  name: "stego",
  aliases: ["sisip", "sembunyi", "unstego", "bacastego"],
  description: "Steganografi foto LSB: Sembunyikan & baca pesan rahasia di dalam pixel gambar (100% lokal)",
  usage: "<pesan> (reply foto) ATAU ketik .unstego (reply foto)",
  category: "Tools & Media",
  cooldownMs: 5000,
  run: async (sock, msg, args, context) => {
    const isUnstego = context.commandName === "unstego" || context.commandName === "bacastego";
    const target = findDownloadableTarget(msg);

    if (!target) {
      return context.reply(
        `Kirim atau reply foto yang ingin diproses!\n\n` +
        `*Menyembunyikan Pesan:*\n` +
        `Reply foto lalu ketik: \`${context.prefix || "."}stego <pesan rahasia>\`\n\n` +
        `*Membaca Pesan:*\n` +
        `Reply foto lalu ketik: \`${context.prefix || "."}unstego\``
      );
    }

    await context.sendTyping();

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 10 * 1024 * 1024 });
    } catch (err) {
      return context.reply(`Gagal mengunduh gambar: ${err.message}`);
    }

    if (!buffer || buffer.length === 0) {
      return context.reply("File gambar kosong.");
    }

    // MODE 1: UNSTEGO (DECODE PESAN)
    if (isUnstego || args.length === 0) {
      try {
        const secretText = await decodeLSB(buffer);
        if (!secretText) {
          if (isUnstego) {
            return context.reply("Tidak ditemukan pesan tersembunyi (LSB) di dalam gambar ini.");
          }
          // Jika dipanggil dengan `.stego` tanpa argumen
          return context.reply(`Tuliskan pesan yang mau disembunyikan!\nContoh: \`${context.prefix || "."}stego Password: Rahasia123\``);
        }

        const out = [
          `*PESAN STEGANOGRAFI TERDETEKSI*`,
          `Panjang Pesan: ${secretText.length} karakter`,
          ``,
          `*Isi Pesan Rahasia:*`,
          `\`\`\``,
          secretText,
          `\`\`\``,
        ].join("\n");

        return context.reply(out);
      } catch (err) {
        return context.reply(`Gagal menganalisis steganografi: ${err.message}`);
      }
    }

    // MODE 2: STEGO (ENCODE PESAN)
    const textToHide = args.join(" ").trim();
    if (!textToHide) {
      return context.reply(`Tuliskan pesan yang mau disisipkan!\nContoh: \`${context.prefix || "."}stego Ini pesan rahasia\``);
    }

    try {
      const pngWithSecret = await encodeLSB(buffer, textToHide);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: pngWithSecret,
          caption:
            `*STEGANOGRAFI BERHASIL*\n` +
            `Pesan rahasia (${textToHide.length} karakter) telah disematkan ke dalam pixel gambar secara kasat mata.\n\n` +
            `Gunakan \`${context.prefix || "."}unstego\` pada foto ini untuk membacanya kembali.`,
        },
        { quoted: msg }
      );
    } catch (err) {
      return context.reply(`Gagal menyisipkan pesan: ${err.message}`);
    }
  },
};
