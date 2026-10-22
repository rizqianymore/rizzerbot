import { resendOtp, runAttendanceFlow } from "@/src/services/telkom/service.js";
import { normalizeNis } from "@/src/services/telkom/auth.js";
import { APP_URL } from "@/src/services/telkom/config.js";
import { parseAttendanceCode, scanCodesFromMessage } from "@/src/services/telkom/qr.js";
import { findConsentByJid } from "@/src/services/telkom/registry.js";
import { hasCredential } from "@/src/services/telkom/vault.js";

const USAGE =
  `*TELKOM SCHOOLS (DigitS)*\n\n` +
  `Cukup ketik NIS + password, sisanya otomatis:\n` +
  `👉 \`{prefix}telkom <nis> <password>\`\n\n` +
  `*Contoh:* \`{prefix}telkom 539241249 passwordku123\`\n\n` +
  `Bot akan: login → cek presensi → kirim absen otomatis → laporkan hasilnya.\n\n` +
  `*Absen cuma kirim foto QR guru:*\n` +
  `Kirim foto QR guru ke bot (tanpa perintah) → bot scan & absen otomatis.\n` +
  `Syaratnya NIS kamu sudah pernah dipakai 1x (otomatis terikat ke akun ini).\n\n` +
  `*Perintah lain:*\n` +
  `• \`{prefix}telkom <nis>\` — pakai password dari vault admin\n` +
  `• \`{prefix}telkom status <nis> [password]\` — cek status saja (tanpa absen)\n` +
  `• \`{prefix}telkom <nis> <kode>\` — lanjutkan login 2FA\n` +
  `• \`{prefix}telkom resend <nis>\` — kirim ulang kode 2FA\n` +
  `• \`{prefix}telkom link\` — link aplikasi resmi\n\n` +
  `_Password hanya dipakai sekali, tidak disimpan, tidak masuk log._\n` +
  `_Endpoint API & proteksi Cloudflare ditangani otomatis._\n` +
  `_Absen tetap memakai akun & token kamu sendiri: ${APP_URL}_`;

/** Pesan ini berisi media (foto/screenshot) yang bisa berisi QR guru. */
function hasMedia(msg) {
  const message = msg?.message || {};
  return Boolean(message.imageMessage || message.documentMessage || message.videoMessage);
}

/** Ambil kode yang discan dari foto + pastikan itu QR absensi Telkom. */
async function scanAttendanceCode(sock, msg) {
  const codes = await scanCodesFromMessage(sock, msg);
  for (const code of codes) {
    const parsed = parseAttendanceCode(code.text, code.format);
    if (parsed.kind) return parsed;
  }
  return null;
}

export default {
  name: "telkomschool",
  cooldownMs: 15000,
  aliases: ["telkom", "tsch", "digits", "abstels"],
  description: "Absen Telkom Schools (DigitS) otomatis: cukup NIS + password, atau kirim foto QR guru.",
  usage: "<nis> [password] | status <nis> [password] | resend <nis> | link",
  category: "Tools",

  /**
   * Handler media: siswa kirim foto QR guru (tanpa perintah) -> scan -> absen.
   * Berjalan hanya untuk akun yang NIS-nya sudah terikat.
   */
  onMedia: async (sock, msg, { logger, senderJid, remoteJid }) => {
    if (!hasMedia(msg)) return false;

    const bound = findConsentByJid(senderJid);
    if (!bound?.nis) return false;

    const scanned = await scanAttendanceCode(sock, msg);
    if (!scanned) {
      logger?.info?.("[telkomschool] foto tidak berisi QR absensi yang dikenali");
      return false;
    }

    if (!hasCredential(bound.nis)) {
      await sock
        .sendMessage(remoteJid, {
          text:
            `🔑 Password NIS \`${bound.nis}\` belum tersimpan di vault.\n` +
            `Kirim: \`.telkom ${bound.nis} <password>\` (sekali ini password-nya dipakai & dihapus).`,
        })
        .catch(() => {});
      return true;
    }

    logger?.info?.(`[telkomschool] auto-absen dari QR (${scanned.format})`);

    const result = await runAttendanceFlow({
      nis: bound.nis,
      actor: senderJid || "",
      actorJid: senderJid || "",
      logger,
      allowSubmit: true,
      qrPayload: scanned.payload,
    });

    const text = result.ok
      ? result.summary
      : String(result.message || "⚠️ Presensi gagal diproses.").replaceAll("{prefix}", ".");

    await sock.sendMessage(remoteJid, { text }, { quoted: msg }).catch(() => {});
    return true;
  },

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
    const qrFromArg = isOtp ? null : parseAttendanceCode(second).payload;
    const password = isOtp || qrFromArg ? "" : second;

    await sendTyping();

    // Foto QR guru: bot scan sendiri, lalu absen memakai QR asli.
    let qrPayload = qrFromArg;
    if (!qrPayload && hasMedia(msg)) {
      const scanned = await scanAttendanceCode(sock, msg);
      qrPayload = scanned?.payload || null;
      if (!qrPayload) logger?.info?.("[telkomschool] QR pada foto tidak terbaca/dikenali");
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
