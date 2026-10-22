import { resendOtp, runAttendanceFlow } from "@/src/services/telkom/service.js";
import { normalizeNis } from "@/src/services/telkom/auth.js";
import { APP_URL } from "@/src/services/telkom/config.js";
import { parseAttendanceCode, scanCodes } from "@/src/services/telkom/qr.js";
import { findConsentByJid } from "@/src/services/telkom/registry.js";
import { hasCredential } from "@/src/services/telkom/vault.js";
import { clearScanState, getScanState, setScanState } from "@/src/services/telkom/pending.js";
import { schoolInfo } from "@/src/services/telkom/school.js";
import {
  extractGpsFromImage,
  extractLocationFromMessage,
  formatLocation,
  toApiLocation,
} from "@/src/services/telkom/location.js";
import { getMediaBuffer } from "@/src/services/fetch/media/buffer.js";

const USAGE =
  `*TELKOM SCHOOLS (DigitS)*\n\n` +
  `Cukup ketik NIS + password, sisanya otomatis:\n` +
  `👉 \`{prefix}telkom <nis> <password>\`\n\n` +
  `*Contoh:* \`{prefix}telkom 539241249 passwordku123\`\n\n` +
  `Bot akan: login → cek presensi → kirim absen otomatis → laporkan hasilnya.\n\n` +
  `*Absen cuma kirim foto QR guru:*\n` +
  `Kirim foto QR guru ke bot (tanpa perintah) → bot scan & absen otomatis.\n` +
  `Kalau guru minta lokasi: kirim juga *Share Location* kamu (lokasi asli,\n` +
  `bukan dipalsukan) → bot langsung kirim absen.\n\n` +
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

/** Pesan ini adalah Share Location dari WhatsApp. */
function hasLocation(msg) {
  return Boolean(msg?.message?.locationMessage);
}

/** Scan kode pada foto + ambil GPS EXIF bila ada. */
async function scanPhoto(sock, msg) {
  let buffer = null;
  try {
    buffer = await getMediaBuffer(sock, msg, { maxBytes: 12 * 1024 * 1024 });
  } catch (_) {}

  if (!buffer) return { code: null, gps: null };

  const codes = await scanCodes(buffer);
  let code = null;
  for (const item of codes) {
    const parsed = parseAttendanceCode(item.text, item.format);
    if (parsed.kind) {
      code = parsed;
      break;
    }
  }
  const gps = code ? await extractGpsFromImage(buffer) : null;
  return { code, gps, buffer };
}

/** Kirim balasan ke siswa. */
async function say(sock, remoteJid, text, quoted) {
  await sock.sendMessage(remoteJid, { text }, quoted ? { quoted } : {}).catch(() => {});
}

export default {
  name: "telkomschool",
  cooldownMs: 15000,
  aliases: ["telkom", "tsch", "digits", "abstels"],
  description: "Absen Telkom Schools (DigitS) otomatis: cukup NIS + password, atau kirim foto QR guru + lokasi.",
  usage: "<nis> [password] | status <nis> [password] | resend <nis> | link",
  category: "Tools",

  /**
   * Handler media: siswa kirim foto QR guru / Share Location (tanpa perintah)
   * -> scan + lokasi -> absen otomatis.
   */
  onMedia: async (sock, msg, { logger, senderJid, remoteJid }) => {
    const bound = findConsentByJid(senderJid);
    if (!bound?.nis) return false;

    const nis = bound.nis;
    const state = getScanState(senderJid);

    // --- Langkah 2: student share lokasi -------------------------------
    if (hasLocation(msg)) {
      const location = extractLocationFromMessage(msg);
      if (!location) return false;

      setScanState(senderJid, { qrPayload: state?.qrPayload || null, location });

      if (!state?.qrPayload) {
        await say(
          sock,
          remoteJid,
          `📍 Lokasi diterima (${formatLocation(location)}).\n` +
            `Sekarang kirim **foto QR guru** ke bot → langsung absen.`,
          msg
        );
        return true;
      }

      if (!hasCredential(nis)) {
        await say(
          sock,
          remoteJid,
          `🔑 Password NIS \`${nis}\` belum tersimpan di vault.\n` +
            `Kirim: \`.telkom ${nis} <password>\` (sekali ini password-nya dipakai & dihapus).`,
          msg
        );
        return true;
      }

      logger?.info?.("[telkomschool] absen dengan QR + lokasi");
      const result = await runAttendanceFlow({
        nis,
        actor: senderJid || "",
        actorJid: senderJid || "",
        logger,
        allowSubmit: true,
        qrPayload: state.qrPayload,
        location: toApiLocation(location),
      });
      clearScanState(senderJid);
      await say(sock, remoteJid, result.ok ? result.summary : String(result.message || "⚠️ Gagal absen."), msg);
      return true;
    }

    // --- Langkah 1: student kirim foto QR ------------------------------
    if (!hasMedia(msg)) return false;

    const { code, gps } = await scanPhoto(sock, msg);
    if (!code) {
      logger?.info?.("[telkomschool] foto tidak berisi QR absensi yang dikenali");
      return false;
    }

    setScanState(senderJid, { qrPayload: code.payload, location: gps || state?.location || null });

    const location = gps || state?.location || null;

    // Kalau lokasi sudah ada (EXIF foto atau share lokasi sebelumnya) -> langsung absen.
    if (!location) {
      await say(
        sock,
        remoteJid,
        `✅ QR guru terdeteksi (*${code.payload?.type || "QR"}*).\n` +
          `Tinggal kirim **Share Location** kamu → bot langsung kirim absen.\n` +
          `_Lokasi dipakai apa adanya (tidak dipalsukan)._`,
        msg
      );
      return true;
    }

    if (!hasCredential(nis)) {
      await say(
        sock,
        remoteJid,
        `🔑 Password NIS \`${nis}\` belum tersimpan di vault.\n` +
          `Kirim: \`.telkom ${nis} <password>\` (sekali ini password-nya dipakai & dihapus).`,
        msg
      );
      return true;
    }

    logger?.info?.("[telkomschool] auto-absen dari QR + lokasi");
    const result = await runAttendanceFlow({
      nis,
      actor: senderJid || "",
      actorJid: senderJid || "",
      logger,
      allowSubmit: true,
      qrPayload: code.payload,
      location: toApiLocation(location),
    });
    clearScanState(senderJid);
    await say(sock, remoteJid, result.ok ? result.summary : String(result.message || "⚠️ Gagal absen."), msg);
    return true;
  },

  run: async (sock, msg, args, { reply, sendTyping, prefix, logger, senderJid }) => {
    const currentPrefix = prefix || ".";
    const firstArg = String(args[0] || "").trim();
    const lowerFirst = firstArg.toLowerCase();

    if (lowerFirst === "link" || lowerFirst === "presensi" || lowerFirst === "help") {
      const school = schoolInfo();
      return reply(
        `*PRESENSI TELKOM SCHOOLS*\n\n` +
          `📍 ${school.name}\n` +
          `${school.address}\n` +
          `🗺️ ${school.url}\n\n` +
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
    let location = null;
    const state = getScanState(senderJid);
    if (!qrPayload && hasMedia(msg)) {
      const scanned = await scanPhoto(sock, msg);
      qrPayload = scanned.code?.payload || null;
      location = scanned.gps || null;
      if (!qrPayload) logger?.info?.("[telkomschool] QR pada foto tidak terbaca/dikenali");
    }
    if (!location) location = toApiLocation(state?.location);

    const result = await runAttendanceFlow({
      nis,
      actor: senderJid || "",
      actorJid: senderJid || "",
      logger,
      allowSubmit: !readOnly,
      otp,
      qrPayload,
      password,
      location,
    });

    if (!result.ok) {
      logger?.warn?.(`[telkomschool] alur gagal: ${result.code}`);
      return reply(String(result.message || "⚠️ Presensi gagal diproses.").replaceAll("{prefix}", currentPrefix));
    }

    const header = readOnly ? "*STATUS PRESENSI (cek saja)*" : "*PRESENSI HARI INI*";
    return reply(result.summary || header);
  },
};
