import { resendOtp, runAttendanceFlow } from "@/src/services/telkom/service.js";
import { normalizeNis } from "@/src/services/telkom/auth.js";
import { APP_URL } from "@/src/services/telkom/config.js";
import { decodeQrFromMessage, parseQrPayload } from "@/src/services/telkom/qr.js";

const USAGE =
  `*TELKOM SCHOOLS (DigitS)*\n\n` +
  `Cukup ketik:\n` +
  `👉 \`{prefix}telkom <nis>\`\n\n` +
  `*Contoh:* \`{prefix}telkom 539241249\`\n\n` +
  `*Perintah lain:*\n` +
  `• \`{prefix}telkom status <nis>\` — cek status saja (tanpa submit)\n` +
  `• \`{prefix}telkom <nis> <kode>\` — lanjutkan login 2FA\n` +
  `• \`{prefix}telkom resend <nis>\` — kirim ulang kode 2FA\n` +
  `• \`{prefix}telkom link\` — link aplikasi resmi\n\n` +
  `*Absen pakai QR guru:* kirim foto QR guru ke bot dengan caption\n` +
  `\`{prefix}telkom <nis>\` — bot baca QR-nya lalu mengirim presensi.\n\n` +
  `_Endpoint API & proteksi Cloudflare ditangani otomatis oleh bot._\n` +
  `_Absen tetap memakai akun & perangkat kamu sendiri: ${APP_URL}_`;

/** Pesan ini berisi media (foto) yang bisa berisi QR guru. */
function hasMedia(msg) {
  const message = msg?.message || {};
  return Boolean(message.imageMessage || message.documentMessage || message.videoMessage);
}

export default {
  name: "telkomschool",
  cooldownMs: 20000,
  aliases: ["telkom", "tsch", "digits", "abstels"],
  description: "Cek & submit presensi Telkom Schools (DigitS) untuk NIS terdaftar (consent required).",
  usage: "<nis> | status <nis> | resend <nis> | link",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger, senderJid }) => {
    const currentPrefix = prefix || ".";
    const firstArg = String(args[0] || "").trim();
    const lowerFirst = firstArg.toLowerCase();

    if (lowerFirst === "link" || lowerFirst === "presensi" || lowerFirst === "help") {
      return reply(
        `*PRESENSI TELKOM SCHOOLS*\n\n` +
          `Buka halaman resmi berikut untuk absen (QR + lokasi asli dari perangkatmu):\n` +
          `${APP_URL}\n\n` +
          `_Bot memakai akun & token kamu sendiri, tidak memalsukan presensi._`
      );
    }

    const readOnly = lowerFirst === "status";
    const resend = lowerFirst === "resend";
    const nis = normalizeNis(readOnly || resend ? args[1] : args[0]);

    if (!nis) {
      return reply(USAGE.replaceAll("{prefix}", currentPrefix));
    }

    if (resend) {
      const result = await resendOtp(nis, { actorJid: senderJid || "", logger });
      return reply(result.message.replaceAll("{prefix}", currentPrefix));
    }

    // Argumen kedua: kode OTP (angka) atau isi QR (JSON).
    const second = String(args[1] || "").trim();
    const otp = /^\d{4,8}$/.test(second) ? second : "";
    let qrPayload = otp ? null : parseQrPayload(second);

    await sendTyping();

    // Foto QR guru: bot decode sendiri, lalu submit memakai QR asli.
    if (!qrPayload && hasMedia(msg)) {
      const decoded = await decodeQrFromMessage(sock, msg);
      qrPayload = parseQrPayload(decoded);
      if (!qrPayload) {
        logger?.info?.("[telkomschool] QR pada foto tidak terbaca");
      }
    }

    const result = await runAttendanceFlow({
      nis,
      actor: senderJid || "",
      actorJid: senderJid || "",
      logger,
      allowSubmit: !readOnly,
      otp,
      qrPayload,
    });

    if (!result.ok) {
      logger?.warn?.(`[telkomschool] alur gagal: ${result.code}`);
      return reply(String(result.message || "⚠️ Presensi gagal diproses.").replaceAll("{prefix}", currentPrefix));
    }

    const header = readOnly ? "*STATUS PRESENSI (cek saja)*" : "*STATUS PRESENSI*";
    return reply(result.summary || header);
  },
};
