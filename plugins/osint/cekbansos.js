import {
  fetchFormSession,
  fetchCaptchaImage,
  submitNik,
  fetchHasil,
  parseHasil,
  formatHasil,
  cekBansosOtomatis,
  savePendingSession,
  peekPendingSession,
  takePendingSession,
} from "@/src/services/cekbansos.js";
import { getNikInfoText } from "@/src/services/nikparse.js";

async function buildHasilText(nik, parsed) {
  const bansos = formatHasil(nik, parsed);
  try {
    const info = await getNikInfoText(nik);
    if (info) return `${bansos}\n\n${info}`;
  } catch (_) {}
  return bansos;
}

const NIK_REGEX = /^\d{16}$/;

export default {
  "name": "cekbansos",
  "aliases": ["bansos", "cekbansosnik"],
  "description": "Cek penerima manfaat bansos Kemensos berdasarkan NIK",
  "usage": "<nik16> [kode_captcha]",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping, prefix, senderJid, logger }) => {
      const currentPrefix = prefix || ".";
      const remoteJid = msg.key.remoteJid;
      const nik = (args[0] || "").trim();
      const manualCode = (args[1] || "").trim();

      if (!nik || !NIK_REGEX.test(nik)) {
        return reply(
          `NIK harus 16 digit angka!\n\n` +
          `Gunakan: \`${currentPrefix}cekbansos <nik16>\`\n` +
          `Contoh: \`${currentPrefix}cekbansos 3171051505590004\``
        );
      }

      if (manualCode) {
        const session = takePendingSession(senderJid, nik);
        if (!session) {
          return reply(
            `Sesi captcha tidak ditemukan / kedaluwarsa.\n` +
            `Kirim dulu \`${currentPrefix}cekbansos ${nik}\` untuk dapat gambar captcha, lalu balas dengan \`${currentPrefix}cekbansos ${nik} <kode>\` maksimal 5 menit.`
          );
        }
        await sendTyping();
        try {
          const { success } = await submitNik(session, nik, manualCode);
          if (!success) return reply("Kode captcha salah. Ulangi: kirim lagi `.cekbansos " + nik + "`.");
          const html = await fetchHasil(session);
          return reply(await buildHasilText(nik, parseHasil(html)));
        } catch (err) {
          logger?.warn?.(`[cekbansos] manual gagal: ${err.message}`);
          return reply(`Gagal memproses: ${err.message}`);
        }
      }

      await sendTyping();
      await reply("Mengecek data ke Kemensos...");

      try {
        const res = await cekBansosOtomatis(nik, { maxAttempts: 4 });
        if (res.status === "ok") return reply(await buildHasilText(nik, res.result));

        logger?.warn?.(`[cekbansos] solver mentok untuk ${nik.slice(0, 6)}****`);

        const existing = peekPendingSession(senderJid, nik);
        if (existing?.image) {
          await sock.sendMessage(
            remoteJid,
            {
              image: existing.image,
              caption:
                `Ketik kode di gambar\n\n` +
                `Balas dengan:\n\`${currentPrefix}cekbansos ${nik} <kode>\`\n\n` +
                `Berlaku 5 menit.`,
            },
            { quoted: msg }
          );
          return;
        }
        const session = await fetchFormSession();
        const image = await fetchCaptchaImage(session);
        savePendingSession(senderJid, session, nik, image);
        await sock.sendMessage(
          remoteJid,
          {
            image,
            caption:
              `Ketik kode di gambar\n\n` +
              `Balas dengan:\n\`${currentPrefix}cekbansos ${nik} <kode>\`\n\n` +
              `Berlaku 5 menit.`,
          },
          { quoted: msg }
        );
      } catch (err) {
        logger?.warn?.(`[cekbansos] gagal: ${err.message}`);
        return reply(`Gagal menghubungi server Kemensos: ${err.message}`);
      }
    },
};
