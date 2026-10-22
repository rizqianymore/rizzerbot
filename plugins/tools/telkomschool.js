import { resendOtp, runAttendanceFlow } from "@/src/services/telkom/service.js";
import { normalizeNis } from "@/src/services/telkom/auth.js";
import { APP_URL } from "@/src/services/telkom/config.js";
import { decodeQrFromMessage, parseQrPayload } from "@/src/services/telkom/qr.js";

const USAGE =
  `*TELKOM SCHOOLS (DigitS)*\n\n` +
  `Cukup ketik NIS + password, sisanya otomatis:\n` +
  `👉 \`{prefix}telkom <nis> <password>\`\n\n` +
  `*Contoh:* \`{prefix}telkom 539241249 passwordku123\`\n\n` +
  `Bot akan: login → cek presensi → kirim absen otomatis → laporkan hasilnya.\n\n` +
  `*Perintah lain:*\n` +
  `• \`{prefix}telkom <nis>\` — pakai password dari vault admin (kalau sudah didaftarkan)\n` +
  `• \`{prefix}telkom status <nis> [password]\` — cek status saja (tanpa absen)\n` +
  `• \`{prefix}telkom <nis> <kode>\` — lanjutkan login 2FA\n` +
  `• \`{prefix}telkom resend <nis>\` — kirim ulang kode 2FA\n` +
  `• \`{prefix}telkom link\` — link aplikasi resmi\n\n` +
  `*Absen pakai QR guru:* kirim foto QR guru ke bot dengan caption\n` +
  `\`{prefix}telkom <nis> <password>\` — bot baca QR-nya lalu langsung absen.\n\n` +
  `_Password hanya dipakai sekali, tidak disimpan, tidak masuk log._\n` +
  `_Endpoint API & proteksi Cloudflare ditangani otomatis._\n` +
  `_Absen tetap memakai akun & token kamu sendiri: ${APP_URL}_`;

/** Pesan ini berisi media (foto) yang bisa berisi QR guru. */
function hasMedia(msg) {
  const message = msg?.message || "";
  return Boolean(message.imageMessage || message.documentMessage || message.videoMessage);
}

export default {
  name: "telkomschool",
  cooldownMs: 15000,
  aliases: ["telkom", "tsch", "digits", "abstels"],
  description: "Absen Telkom Schools (DigitS) otomatis: cukup NIS + password, bot login, cek, lalu kirim presensi.",
  usage: "<nis> [password] | status <nis> [password] | resend <nis> | link",
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

    // Argumen berikutnya bisa: kode OTP (angka), isi QR (JSON), atau password.
    const second = String(args[readOnly ? 2 : 1] || "").trim();
    const isOtp = /^\d{4,8}$/.test(second);
    const otp = isOtp ? second : "";
    const qrFromArg = isOtp ? null : parseQrPayload(second);
    const password = isOtp || qrFromArg ? "" : second;

    await sendTyping();

    // Foto QR guru: bot decode sendiri, lalu absen memakai QR asli.
    let qrPayload = qrFromArg;
    if (!qrPayload && hasMedia(msg)) {
      const decoded = await decodeQrFromMessage(sock, msg);
      qrPayload = parseQrPayload(decoded);
      if (!qrPayload) logger?.info?.("[telkomschool] QR pada foto tidak terbaca");
    }

    const result = await runAttendanceFlow({
      nis,
      actor: senderJid || "",
      actorJid: senderJid || "",
      logger,
      allowSubmit: !readOnly,
      otp,
      qrPayload,
      password,
    });

    if (!result.ok) {
      logger?.warn?.(`[telkomschool] alur gagal: ${result.code}`);
      return reply(String(result.message || "⚠️ Presensi gagal diproses.").replaceAll("{prefix}", currentPrefix));
    }

    const header = readOnly ? "*STATUS PRESENSI (cek saja)*" : "*PRESENSI HARI INI*";
    return reply(result.summary || header);
  },
};
