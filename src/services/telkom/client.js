import { telkomRequest } from "./http.js";
import { resolveEndpoints } from "./discovery.js";
import { APP_ORIGIN, QR_TYPES, joinUrl } from "./config.js";

/**
 * Client API presensi Telkom Schools (DigitS).
 *
 * Endpoint diambil otomatis dari discovery.js (bundle aplikasi resmi),
 * sehingga tidak ada path/hash yang harus dikonfigurasi manual.
 *
 * Bentuk request (sesuai aplikasi resmi):
 *   GET  {registrasiRead}/{hashProfile}                 -> profil siswa (numberid/nis, nama)
 *   GET  {presensiRead}/{hashRead}/{studentId}          -> status presensi hari ini
 *   POST {presensiWrite}/{hashWrite}                    -> submit presensi
 */

async function endpoints() {
  const result = await resolveEndpoints();
  return {
    bases: result?.bases || {},
    hashes: result?.hashes || {},
  };
}

/** Ambil profil siswa (dipakai untuk menemukan studentId internal). */
export async function fetchStudentProfile(token, cookie, { timeoutMs = 12000, signal, logger } = {}) {
  const { bases, hashes } = await endpoints();
  const base = bases.registrasiRead;
  const hash = hashes.profile;
  if (!base || !hash) throw new Error("Endpoint profil belum terdeteksi.");

  const res = await telkomRequest(joinUrl(base, hash), {
    method: "GET",
    token,
    cookie,
    timeoutMs,
    signal,
    origin: APP_ORIGIN,
    referer: `${APP_ORIGIN}/`,
    logger,
  });

  const body = res?.data && typeof res.data === "object" ? res.data : {};
  const data = body.data && typeof body.data === "object" ? body.data : body;
  const profile = data.profile && typeof data.profile === "object" ? data.profile : data;

  const studentId = String(profile.numberid || profile.nis || profile.student_id || "").trim();
  const name = String(profile.fullname || profile.student_name || profile.name || "").trim();

  return {
    ok: body.status !== false,
    studentId,
    nis: String(profile.nis || "").trim(),
    name,
    photo: profile.photo || "",
    raw: body,
  };
}

/** Ambil status presensi hari ini (read-only). */
export async function fetchAttendance(token, cookie, studentId, { timeoutMs = 12000, signal, logger } = {}) {
  const { bases, hashes } = await endpoints();
  const base = bases.presensiRead;
  const hash = hashes.read;
  if (!base || !hash) throw new Error("Endpoint presensi belum terdeteksi.");
  if (!studentId) throw new Error("Student ID tidak tersedia.");

  const res = await telkomRequest(joinUrl(base, `${hash}/${encodeURIComponent(studentId)}`), {
    method: "GET",
    token,
    cookie,
    timeoutMs,
    signal,
    origin: APP_ORIGIN,
    referer: `${APP_ORIGIN}/`,
    logger,
  });

  return res?.data ?? null;
}

/**
 * Susun payload submit sesuai aplikasi resmi:
 *   { studentId, qrType, location, ...isi QR }
 */
export function buildSubmitPayload({ studentId, kind, qrPayload = null, location = null, date = "" } = {}) {
  const qrType = QR_TYPES[kind] || QR_TYPES.datang;
  const payload = {
    studentId: String(studentId || ""),
    qrType,
    ...(location && typeof location === "object" ? { location } : {}),
  };
  if (qrPayload && typeof qrPayload === "object" && !Array.isArray(qrPayload)) {
    Object.assign(payload, qrPayload);
    payload.studentId = String(studentId || "");
    payload.qrType = qrType;
  } else if (date) {
    payload.date = date;
  }
  return payload;
}
/**
 * Submit presensi memakai token siswa.
 * @param {{token:string, cookie:string, studentId:string, kind:string, qrPayload?:object, location?:object, date?:string}} options
 */
export async function submitAttendance({
  token,
  cookie,
  studentId,
  kind = "datang",
  qrPayload = null,
  location = null,
  date = "",
  timeoutMs = 12000,
  signal,
  logger,
} = {}) {
  const { bases, hashes } = await endpoints();
  const base = bases.presensiWrite;
  const hash = hashes.write;
  if (!base || !hash) throw new Error("Endpoint submit presensi belum terdeteksi.");

  const payload = buildSubmitPayload({ studentId, kind, qrPayload, location, date });

  const res = await telkomRequest(joinUrl(base, hash), {
    method: "POST",
    token,
    cookie,
    timeoutMs,
    signal,
    origin: APP_ORIGIN,
    referer: `${APP_ORIGIN}/`,
    contentType: "application/json",
    body: payload,
    logger,
  });

  const body = res?.data && typeof res.data === "object" ? res.data : {};
  const ok = body.status === true || body.status === "success" || body.success === true;
  return {
    ok,
    status: res?.status || 0,
    message: String(body.message || (ok ? "Presensi tercatat." : "") || "").slice(0, 160),
    data: body,
    payload,
  };
}
