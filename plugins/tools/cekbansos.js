// plugins/tools/cekbansos.js — perintah "cekbansos" (1 file = 1 perintah).
import {
  fetchFormSession,
  fetchCaptchaImage,
  submitNik,
  fetchHasil,
  parseHasil,
  formatHasil,
  cekBansosOtomatis,
  isOcrAvailable,
  savePendingSession,
  takePendingSession,
} from "@/src/services/cekbansos.js";

const NIK_REGEX = /^\d{16}$/;

export default {
  "name": "cekbansos",
  "aliases": ["bansos", "cekbansosnik"],
  "description": "Cek penerima manfaat bansos Kemensos berdasarkan NIK",
  "usage": "<nik16> [kode_captcha]",
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix, senderJid, logger }) => {
      const currentPrefix = prefix || ".";
      const remoteJid = msg.key.remoteJid;
      const nik = (args[0] || "").trim();
      const manualCode = (args[1] || "").trim();

      if (!nik || !NIK_REGEX.test(nik)) {
        return reply(
          `❌ NIK harus 16 digit angka!\n\n` +
          `*Gunakan:* \`${currentPrefix}cekbansos <nik16>\`\n` +
          `*Contoh:* \`${currentPrefix}cekbansos 3171051505590004\``
        );
      }

      // ── Jalur manual: user mengetik kode captcha dari gambar ──
      if (manualCode) {
        const session = takePendingSession(senderJid, nik);
        if (!session) {
          return reply(
            `❌ Sesi captcha tidak ditemukan / kedaluwarsa.\n` +
            `Kirim dulu \`${currentPrefix}cekbansos ${nik}\` untuk dapat gambar captcha, lalu balas dengan \`${currentPrefix}cekbansos ${nik} <kode>\` maksimal 3 menit.`
          );
        }
        await sendTyping();
        try {
          const { success } = await submitNik(session, nik, manualCode);
          if (!success) return reply("❌ Kode captcha salah. Ulangi: kirim lagi `.cekbansos " + nik + "`.");
          const html = await fetchHasil(session);
          return reply(formatHasil(nik, parseHasil(html)));
        } catch (err) {
          logger?.warn?.(`[cekbansos] manual gagal: ${err.message}`);
          return reply(`❌ Gagal memproses: ${err.message}`);
        }
      }

      // ── Jalur otomatis: solver OCR + retry ──
      await sendTyping();
      await reply("⏳ Mengecek data ke Kemensos...");

      try {
        if (await isOcrAvailable()) {
          const res = await cekBansosOtomatis(nik, { maxAttempts: 4 });
          if (res.status === "ok") return reply(formatHasil(nik, res.result));
          // OCR mentok (4x salah) → jatuh ke manual di bawah
          logger?.warn?.(`[cekbansos] OCR mentok untuk ${nik.slice(0, 6)}****`);
        }

        // ── Fallback manual: kirim gambar captcha, user ketik kodenya ──
        const session = await fetchFormSession();
        const image = await fetchCaptchaImage(session);
        savePendingSession(senderJid, session, nik);
        await sock.sendMessage(
          remoteJid,
          {
            image,
            caption:
              `🔤 *Ketik kode di gambar*\n\n` +
              `Balas dengan:\n\`${currentPrefix}cekbansos ${nik} <kode>\`\n\n` +
              `⏱️ Berlaku 3 menit.`,
          },
          { quoted: msg }
        );
      } catch (err) {
        logger?.warn?.(`[cekbansos] gagal: ${err.message}`);
        return reply(`❌ Gagal menghubungi server Kemensos: ${err.message}`);
      }
    },
};
