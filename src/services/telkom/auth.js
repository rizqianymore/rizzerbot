import { telkomRequest } from "./http.js";
import { resolveEndpoints } from "./discovery.js";
import { joinUrl } from "./config.js";

/**
 * Autentikasi siswa Telkom Schools (DigitS).
 *
 * Alur resmi aplikasi:
 *   POST {issueauth}/telkomschool/student/issueauth/web  (multipart: username, password)
 *     -> { token, expired }                 (berhasil)
 *     -> { url }                             (butuh kode 2FA)
 *   POST {issueauth}/confirmauth/{url}       (multipart: token = kode 6 digit)
 *     -> { token }
 *
 * Password SELALU milik siswa sendiri & diambil dari vault (./vault.js).
 */

const ISSUE_AUTH_PATH = "/telkomschool/student/issueauth/web";
const CONFIRM_PATH = "/confirmauth/";
const RESEND_PATH = "/resendauth";

export const MIN_NIS_LENGTH = 5;
export const MAX_NIS_LENGTH = 15;

export class TelkomAuthError extends Error {
  constructor(message, code = "auth_failed", status = 0, extra = {}) {
    super(message);
    this.name = "TelkomAuthError";
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

export function normalizeNis(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidNis(value) {
  const nis = normalizeNis(value);
  return nis.length >= MIN_NIS_LENGTH && nis.length <= MAX_NIS_LENGTH;
}

export function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function extractCookies(res) {
  const headers = res?.headers || {};
  const raw = headers["set-cookie"];
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const pairs = [];
  for (const entry of list) {
    const first = String(entry).split(";")[0].trim();
    if (first) pairs.push(first);
  }
  return pairs.length ? pairs.join("; ") : null;
}

function normalizeExpiry(data) {
  const raw = Number(data?.expired ?? data?.expires_in ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 86400;
  // `expired` bisa berupa durasi (detik) atau timestamp epoch.
  if (raw > 1e9) return Math.max(60, Math.floor(raw - Date.now() / 1000));
  return Math.floor(raw);
}

function buildAuthResult(data, cookie) {
  const token = data?.token;
  const expired = normalizeExpiry(data);
  return {
    token,
    expired,
    expiresAt: new Date(Date.now() + expired * 1000),
    claims: decodeJwtPayload(token),
    cookie: cookie || null,
  };
}

function mapAuthError(err) {
  if (err instanceof TelkomAuthError) return err;
  const message = String(err?.message || "");
  if (/timeout/i.test(message)) {
    return new TelkomAuthError("Timeout login.", "timeout");
  }
  if (/Gagal terhubung|fetch failed|ENOTFOUND|ECONN/i.test(message)) {
    return new TelkomAuthError("Gagal terhubung ke gateway.", "network");
  }
  return new TelkomAuthError("Login ditolak gateway.", "auth_failed", Number(err?.status) || 0);
}

async function authBases() {
  const endpoints = await resolveEndpoints();
  return endpoints?.bases?.issueauth || "https://gateway.ypt.or.id/";
}

/**
 * Login siswa.
 * @returns {Promise<{token:string, expired:number, expiresAt:Date, claims:object|null, cookie:string|null}>}
 * @throws {TelkomAuthError} code "two_factor_required" bila server meminta kode 2FA.
 */
export async function issueStudentToken(nis, password, { timeoutMs = 30000, signal, logger } = {}) {
  const username = normalizeNis(nis);
  if (!isValidNis(username)) {
    throw new TelkomAuthError("Format NIS tidak valid.", "invalid_nis");
  }

  const pass = typeof password === "string" ? password.trim() : "";
  if (!pass) {
    throw new TelkomAuthError("Kredensial siswa tidak tersedia.", "missing_credential");
  }

  const base = await authBases();
  const form = new FormData();
  form.append("username", username);
  form.append("password", pass);

  let res;
  try {
    res = await telkomRequest(joinUrl(base, ISSUE_AUTH_PATH), {
      method: "POST",
      body: form,
      timeoutMs,
      signal,
      origin: "https://digits.telkomschools.sch.id",
      referer: "https://digits.telkomschools.sch.id/",
    });
  } catch (err) {
    throw mapAuthError(err);
  }

  const data = res?.data && typeof res.data === "object" ? res.data : {};
  const cookie = extractCookies(res);

  if (data.token) {
    return buildAuthResult(data, cookie);
  }

  if (data.url) {
    // Server meminta kode OTP (2FA) — dikembalikan ke pemanggil untuk ditanyakan ke user.
    throw new TelkomAuthError("Gateway meminta kode verifikasi (2FA).", "two_factor_required", res.status, {
      twoFactorUrl: String(data.url),
    });
  }

  const message = String(data.message || "Login ditolak gateway.");
  logger?.warn?.(`[Telkom] login ditolak: ${message.slice(0, 80)}`);
  throw new TelkomAuthError("Login ditolak gateway (NIS/password tidak cocok).", "auth_failed", res.status);
}

/**
 * Selesaikan login 2FA dengan kode OTP yang diterima siswa.
 * @param {string} twoFactorUrl nilai `url` dari respons issueauth
 * @param {string} code kode OTP (6 digit)
 */
export async function confirmTwoFactor(twoFactorUrl, code, { timeoutMs = 30000, signal, logger } = {}) {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length < 4) {
    throw new TelkomAuthError("Kode verifikasi tidak valid.", "invalid_otp");
  }
  if (!twoFactorUrl) {
    throw new TelkomAuthError("Sesi verifikasi tidak ditemukan. Silakan ulangi login.", "otp_expired");
  }

  const base = await authBases();
  const target = /^https?:\/\//i.test(String(twoFactorUrl))
    ? String(twoFactorUrl)
    : joinUrl(base, `${CONFIRM_PATH}${String(twoFactorUrl).replace(/^\/+/, "")}`);

  const form = new FormData();
  form.append("token", digits);

  let res;
  try {
    res = await telkomRequest(target, {
      method: "POST",
      body: form,
      timeoutMs,
      signal,
      origin: "https://digits.telkomschools.sch.id",
      referer: "https://digits.telkomschools.sch.id/",
    });
  } catch (err) {
    throw mapAuthError(err);
  }

  const data = res?.data && typeof res.data === "object" ? res.data : {};
  if (!data.token) {
    logger?.warn?.(`[Telkom] 2FA gagal: ${String(data.message || "").slice(0, 80)}`);
    throw new TelkomAuthError("Kode verifikasi ditolak gateway.", "invalid_otp", res.status);
  }
  return buildAuthResult(data, extractCookies(res));
}

/** Minta kirim ulang kode 2FA ke WhatsApp siswa. */
export async function resendTwoFactor(nis, { timeoutMs = 30000, signal } = {}) {
  const base = await authBases();
  const form = new FormData();
  form.append("username", normalizeNis(nis));
  try {
    const res = await telkomRequest(joinUrl(base, RESEND_PATH), {
      method: "POST",
      body: form,
      timeoutMs,
      signal,
      origin: "https://digits.telkomschools.sch.id",
      referer: "https://digits.telkomschools.sch.id/",
    });
    return res?.status >= 200 && res?.status < 300;
  } catch (_) {
    return false;
  }
}
