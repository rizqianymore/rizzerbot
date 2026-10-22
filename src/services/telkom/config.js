/**
 * Konstanta & default Telkom Schools (DigitS).
 *
 * Semua nilai base URL dan hash endpoint di sini hanya fallback:
 * modul ./discovery.js mencari sendiri nilai terbaru dari aplikasi resmi
 * (runtime config + bundle) sehingga tidak perlu konfigurasi manual di .env.
 */

export const APP_ORIGIN = "https://presensi.telkomschools.sch.id";
export const APP_URL = `${APP_ORIGIN}/siswa/presensi`;
export const APP_ROOT = `${APP_ORIGIN}/`;
export const PORTAL_URL = "https://digits.telkomschools.sch.id/";

export const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

/** Base URL API resmi (hasil parse runtime config aplikasi DigitS). */
export const DEFAULT_BASES = {
  issueauth: "https://gateway.ypt.or.id/",
  registrasiRead: "https://gw-digits.telkomschools.sch.id/api/read",
  presensiRead: "https://gw-digits.telkomschools.sch.id/api/presensi-read",
  presensiWrite: "https://gw-digits.telkomschools.sch.id/api/presensi-write",
};

/** Hash endpoint yang dipakai bundle resmi (fallback bila discovery gagal). */
export const DEFAULT_HASHES = {
  profile: "7b566720a8dd41916b2d3f565f57f42b",
  read: "dbc366754e1d31910e16a4b41893b09c",
  write: "caa809d407e0b78296e0c0dc019f5965",
};

/** Label QR resmi (dipakai saat submit presensi). */
export const QR_TYPES = {
  datang: "QR Datang",
  pulang: "QR Pulang",
  kelas: "QR Kelas",
  aktivitas: "QR Aktivitas",
  event: "QR Event",
};

/**
 * Sesi QR guru (dipakai plugin .absensi & auto-absen bot).
 * Sumber: env TELKOM_QR_ID / TELKOM_QR_LEMDIK_ID, default sama dengan
 * plugin .absensi supaya QR yang dibuat guru dan yang dibuat bot identik.
 */
export const DEFAULT_QR_SESSION = { id: 3919, lemdikId: 47 };

export function qrSession() {
  const id = Number(process.env.TELKOM_QR_ID);
  const lemdikId = Number(process.env.TELKOM_QR_LEMDIK_ID);
  return {
    id: Number.isFinite(id) && id > 0 ? id : DEFAULT_QR_SESSION.id,
    lemdikId: Number.isFinite(lemdikId) && lemdikId > 0 ? lemdikId : DEFAULT_QR_SESSION.lemdikId,
  };
}

/**
 * Auto-absen: bot membuat sendiri payload QR guru (default AKTIF).
 * Matikan dengan TELKOM_AUTO_QR=0 kalau absen harus pakai QR asli dari foto.
 */
export function autoQrEnabled() {
  return !["0", "false", "no", "off"].includes(
    String(process.env.TELKOM_AUTO_QR ?? "1")
      .trim()
      .toLowerCase()
  );
}

/** Susun payload QR guru (format resmi: id, lemdikId, createdAt, type). */
export function buildQrPayload(type, createdAt) {
  const session = qrSession();
  return {
    id: session.id,
    lemdikId: session.lemdikId,
    createdAt,
    type,
  };
}

/** Path relatif pada app resmi yang memetakan jenis QR ke tipe presensi. */
export const QR_TYPE_ALIASES = {
  "qr datang": "datang",
  "qr pulang": "pulang",
  "qr kelas": "kelas",
  "qr aktivitas": "aktivitas",
  "qr event": "event",
  datang: "datang",
  pulang: "pulang",
};

/** Buang garis miring di akhir base URL. */
export function trimBase(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

/** Gabungkan base + path tanpa menghasilkan double slash. */
export function joinUrl(base, suffix) {
  const left = trimBase(base);
  const right = String(suffix || "").startsWith("/") ? String(suffix) : `/${suffix || ""}`;
  return `${left}${right}`;
}
