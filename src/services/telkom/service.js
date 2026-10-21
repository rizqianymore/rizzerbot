import { confirmTwoFactor, isValidNis, issueStudentToken, normalizeNis, resendTwoFactor } from "./auth.js";
import { fetchAttendance, fetchStudentProfile, submitAttendance } from "./client.js";
import {
  checkWindow,
  extractQrPayload,
  findEntry,
  formatAttendanceSummary,
  isRecorded,
  parseAttendanceStatus,
  wibParts,
} from "./attendance.js";
import { audit, getConsent, isConsented, maskNis, quotaStatus, recordUsage } from "./registry.js";
import { createSession } from "./session.js";
import { resolvePassword } from "./vault.js";
import { takePendingTwoFactor, setPendingTwoFactor } from "./pending.js";
import { qrTypeToKind } from "./qr.js";
import { db } from "@/src/core/database.js";

/**
 * Orkestrator alur presensi Telkom Schools:
 * validasi -> consent -> kuota -> vault -> login -> profil -> status -> submit -> cleanup.
 *
 * Cleanup (session cleared) WAJIB dijalankan di finally block.
 */

const TOTAL_TIMEOUT_MS = 60000;

const USER_MESSAGES = {
  invalid_nis: "❌ Format NIS tidak valid (5-15 digit angka).",
  not_consented: "ℹ️ NIS ini belum terdaftar atau belum ada consent.\nHubungi admin untuk aktivasi.",
  nis_bound_other: "❌ NIS ini terdaftar pada akun lain. Hubungi admin.",
  quota_exceeded: "⏳ Kuota presensi harian sudah habis. Coba lagi besok.",
  missing_credential: "🔑 Kredensial siswa belum tersedia di vault. Hubungi admin.",
  auth_failed: "❌ Login ditolak gateway (NIS/password tidak cocok).",
  timeout: "⏱️ Timeout saat menghubungi server Telkom Schools. Coba lagi.",
  network: "🌐 Gagal terhubung ke server Telkom Schools. Coba lagi nanti.",
  status_failed: "⚠️ Gagal membaca status presensi. Coba lagi sebentar.",
  endpoint_missing:
    "⚠️ Endpoint resmi belum terdeteksi (bundle aplikasi berubah?).\nCoba lagi beberapa saat lagi atau hubungi admin.",
  submit_failed: "⚠️ Pengiriman presensi ditolak server. Absen lewat aplikasi resmi.",
  challenge: "🛡️ Proteksi Cloudflare sedang aktif. Bot mencoba otomatis, coba lagi sebentar.",
  two_factor_required:
    "🔐 Gateway meminta kode verifikasi.\nKirim ulang kode dulu: `{prefix}telkom resend <nis>`\nLalu balas: `{prefix}telkom <nis> <kode>`",
  invalid_otp: "❌ Kode verifikasi tidak valid/ditolak. Minta kode baru lalu coba lagi.",
  otp_expired: "⏳ Sesi verifikasi sudah kedaluwarsa. Ulangi `{prefix}telkom <nis>`.",
};

function fail(code, logger, extra = {}) {
  const message = USER_MESSAGES[code] || "⚠️ Presensi gagal diproses. Coba lagi nanti.";
  logger?.warn?.(`[Telkom] gagal (${code})`, extra?.detail ? String(extra.detail).slice(0, 160) : "");
  return { ok: false, code, message, ...extra };
}

/** Bandingkan dua akun WhatsApp (toleran terhadap JID @lid vs @s.whatsapp.net). */
function sameAccount(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    const ra = db.resolvePhoneJid(a);
    const rb = db.resolvePhoneJid(b);
    if (ra && rb && ra === rb) return true;
  } catch (_) {}
  const da = String(a).replace(/\D/g, "");
  const dbb = String(b).replace(/\D/g, "");
  return Boolean(da && dbb && da === dbb);
}

function mapError(err) {
  const code = String(err?.code || "");
  if (code === "invalid_nis") return "invalid_nis";
  if (code === "missing_credential") return "missing_credential";
  if (code === "timeout") return "timeout";
  if (code === "network") return "network";
  if (code === "auth_failed") return "auth_failed";
  if (code === "challenge") return "challenge";
  if (code === "two_factor_required") return "two_factor_required";
  if (code === "invalid_otp") return "invalid_otp";
  if (code === "otp_expired") return "otp_expired";
  const message = String(err?.message || "");
  if (/belum terdeteksi/i.test(message)) return "endpoint_missing";
  if (/timeout/i.test(message)) return "timeout";
  if (/gagal terhubung|fetch failed|ENOTFOUND|ECONN/i.test(message)) return "network";
  if (/Cloudflare|proteksi/i.test(message)) return "challenge";
  if (Number(err?.status) === 401) return "auth_failed";
  if (Number(err?.status) === 403) return "status_failed";
  if (/API 401|API 403|Unauthorized/i.test(message)) return "auth_failed";
  if (/API 5\d\d/.test(message)) return "status_failed";
  return "status_failed";
}

/**
 * Decide & perform submit presensi.
 * Syarat: consent autoSubmit, dalam window resmi, dan belum absen hari ini (idempoten).
 *
 * `qrPayload` = isi QR guru (dari foto / tempelan siswa). Bila ada, jenis
 * presensi mengikuti tipe QR tersebut (mis. "QR Datang" -> datang).
 */
async function maybeSubmit({ nis, session, parsed, consent, allowSubmit, logger, location, qrPayload = null }) {
  if (!allowSubmit) return { attempted: false, reason: "read_only" };
  if (consent?.autoSubmit === false) return { attempted: false, reason: "auto_submit_disabled" };
  if (!parsed?.ok) return { attempted: false, reason: "status_unavailable" };

  const qrKind = qrPayload?.type ? qrTypeToKind(qrPayload.type) : null;
  const kinds = qrKind ? [qrKind] : ["datang", "pulang"];

  let outsideWindow = false;
  let alreadyRecorded = false;

  for (const kind of kinds) {
    if (isRecorded(parsed.entries, kind)) {
      alreadyRecorded = true;
      continue;
    }

    const isDaily = kind === "datang" || kind === "pulang";
    const window = isDaily ? checkWindow(kind) : { allowed: true, window: null };
    if (isDaily && !window.allowed) {
      outsideWindow = true;
      continue;
    }
    if (!isDaily && !qrPayload) {
      // Presensi mapel/kegiatan wajib memakai QR asli dari guru.
      continue;
    }

    try {
      const response = await submitAttendance({
        token: session.token,
        cookie: session.cookie,
        studentId: session.studentId,
        kind,
        qrPayload: qrPayload || extractQrPayload(parsed, kind),
        location,
        date: wibParts().date,
      });
      const ok = response?.ok === true;
      const message = String(response?.message || "");
      const submittedAt = wibParts().time;
      if (ok) {
        // Update cache status lokal agar ringkasan mencerminkan absen yang baru tercatat.
        const entry = findEntry(parsed.entries, kind);
        if (entry) {
          entry.present = true;
          entry.time = entry.time && entry.time !== "00:00" ? entry.time : submittedAt;
        }
      }
      audit("submit", { nis: maskNis(nis), kind, ok, window: window.window, httpStatus: response?.status }, logger);
      return {
        attempted: true,
        kind,
        success: ok,
        message: message.slice(0, 120),
        window: window.window,
        time: submittedAt,
      };
    } catch (err) {
      audit("submit_error", { nis: maskNis(nis), kind, detail: String(err?.message || err).slice(0, 120) }, logger);
      return {
        attempted: true,
        kind,
        success: false,
        message: String(err?.message || "").slice(0, 120),
        window: window.window,
        time: wibParts().time,
      };
    }
  }

  if (alreadyRecorded && !outsideWindow) return { attempted: false, reason: "already_recorded" };
  if (outsideWindow) return { attempted: false, reason: "outside_window" };
  return { attempted: false, reason: "already_recorded" };
}

/**
 * Jalankan alur lengkap presensi untuk satu NIS.
 *
 * @param {{nis:string, actor?:string, actorJid?:string, logger?:object, allowSubmit?:boolean, otp?:string, location?:object}} options
 */
export async function runAttendanceFlow({
  nis: nisInput,
  actor = "",
  actorJid = "",
  logger,
  allowSubmit = true,
  otp = "",
  location = null,
  qrPayload = null,
} = {}) {
  const nis = normalizeNis(nisInput);

  // 1. Validasi input
  if (!isValidNis(nis)) {
    audit("reject_invalid_nis", { nis: maskNis(nisInput) }, logger);
    return fail("invalid_nis", logger);
  }

  // 1b. Whitelist + consent
  const consent = getConsent(nis);
  if (!isConsented(nis)) {
    audit("reject_no_consent", { nis: maskNis(nis), actor: maskNis(actor) }, logger);
    return fail("not_consented", logger);
  }
  if (consent.jid && actorJid && !sameAccount(consent.jid, actorJid)) {
    audit("reject_nis_mismatch", { nis: maskNis(nis), actor: maskNis(actor) }, logger);
    return fail("nis_bound_other", logger);
  }

  // 1c. Rate limit per NIS
  const quota = quotaStatus(nis);
  if (!quota.allowed) {
    audit("reject_quota", { nis: maskNis(nis), count: quota.count, limit: quota.limit }, logger);
    return fail("quota_exceeded", logger, { quota });
  }

  // 2. Kredensial dari vault (tidak ada password default)
  let password = null;
  try {
    password = resolvePassword(nis);
  } catch (err) {
    audit("reject_no_credential", { nis: maskNis(nis) }, logger);
    return fail(err?.code === "invalid_nis" ? "invalid_nis" : "missing_credential", logger);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
  let session = null;

  try {
    // 3. Login + token (mungkin perlu 2FA)
    let auth;
    const code = String(otp || "").replace(/\D/g, "");
    if (code) {
      const pending = takePendingTwoFactor(nis, actorJid);
      if (!pending) {
        audit("reject_otp_expired", { nis: maskNis(nis) }, logger);
        return fail("otp_expired", logger);
      }
      auth = await confirmTwoFactor(pending.url, code, {
        timeoutMs: 20000,
        signal: controller.signal,
        logger,
      });
    } else {
      try {
        auth = await issueStudentToken(nis, password, {
          timeoutMs: 20000,
          signal: controller.signal,
          logger,
        });
      } catch (err) {
        if (err?.code === "two_factor_required") {
          setPendingTwoFactor(nis, actorJid, err.twoFactorUrl);
          audit("two_factor_required", { nis: maskNis(nis) }, logger);
          return fail("two_factor_required", logger, { twoFactor: true });
        }
        throw err;
      }
    }
    password = null;

    session = createSession({
      token: auth.token,
      cookie: auth.cookie,
      claims: auth.claims,
      expiresAt: auth.expiresAt,
    });
    audit("login", { nis: maskNis(nis), ok: true, bound: Boolean(consent.jid) }, logger);

    // 4. Profil siswa -> studentId internal (auto-detect, bukan asumsi NIS)
    let studentId = nis;
    let studentName = "";
    try {
      const profile = await fetchStudentProfile(session.token, session.cookie, {
        timeoutMs: TOTAL_TIMEOUT_MS,
        signal: controller.signal,
      });
      if (profile?.studentId) studentId = profile.studentId;
      if (profile?.name) studentName = profile.name;
      audit("profile", { nis: maskNis(nis), found: Boolean(profile?.studentId) }, logger);
    } catch (err) {
      audit("profile_error", { nis: maskNis(nis), detail: String(err?.message || err).slice(0, 120) }, logger);
    }
    session.studentId = studentId;

    // 5. Status presensi hari ini
    let statusPayload = null;
    try {
      statusPayload = await fetchAttendance(session.token, session.cookie, studentId, {
        timeoutMs: TOTAL_TIMEOUT_MS,
        signal: controller.signal,
      });
    } catch (err) {
      audit("status_error", { nis: maskNis(nis), detail: String(err?.message || err).slice(0, 120) }, logger);
      return fail(mapError(err), logger, { detail: err?.message });
    }

    const parsed = parseAttendanceStatus(statusPayload);
    if (studentName) parsed.studentName = studentName;
    audit("status", { nis: maskNis(nis), entries: parsed.entries.length }, logger);

    // 6. Submit presensi (hanya jika diizinkan & dalam window)
    const submit = await maybeSubmit({
      nis,
      session,
      parsed,
      consent,
      allowSubmit,
      logger,
      location,
      qrPayload,
    });

    recordUsage(nis);

    const summary = formatAttendanceSummary({
      studentName: parsed.studentName,
      parsed,
      submit,
      title: allowSubmit ? "*PRESENSI HARI INI*" : "*STATUS PRESENSI (cek saja)*",
    });

    return {
      ok: true,
      nis,
      studentId,
      studentName: parsed.studentName,
      parsed,
      submit,
      quota: quotaStatus(nis),
      summary,
    };
  } catch (err) {
    const code = mapError(err);
    audit("error", { nis: maskNis(nis), code, detail: String(err?.message || err).slice(0, 120) }, logger);
    return fail(code, logger, { detail: err?.message });
  } finally {
    // 7. Cleanup wajib: hapus cookie & token dari memori, null-kan session.
    password = null;
    if (session) session.destroy(logger);
    session = null;
    clearTimeout(timer);
  }
}

/** Kirim ulang kode 2FA ke WhatsApp siswa. */
export async function resendOtp(nis, { actorJid = "", logger } = {}) {
  const digits = normalizeNis(nis);
  if (!isValidNis(digits)) return fail("invalid_nis", logger);
  const pending = takePendingTwoFactor(digits, actorJid);
  if (!pending) return fail("otp_expired", logger);
  const ok = await resendTwoFactor(digits);
  setPendingTwoFactor(digits, actorJid, pending.url);
  audit("otp_resend", { nis: maskNis(digits), ok }, logger);
  return ok
    ? { ok: true, message: "✅ Kode verifikasi sudah dikirim ulang ke WhatsApp kamu." }
    : { ok: false, code: "network", message: USER_MESSAGES.network };
}

/**
 * Ringkasan status saja (tanpa submit) — dipakai untuk mode "cek".
 */
export function describeStatusOnly(parsed) {
  const datang = findEntry(parsed?.entries || [], "datang");
  const pulang = findEntry(parsed?.entries || [], "pulang");
  return {
    datang: datang?.present ? datang.time : null,
    pulang: pulang?.present ? pulang.time : null,
  };
}
