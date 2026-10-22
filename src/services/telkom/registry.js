import { db } from "@/src/core/database.js";

/**
 * Registry consent siswa + rate limit per NIS + audit log.
 *
 * Disimpan di section `telkom` pada database bot (bukan data presensi/session):
 *   { students: { <nis>: { consent, jid, autoSubmit, note, addedAt, addedBy } },
 *     usage:   { <nis>: { date, count } },
 *     audit:   [ { at, event, ... } ] }
 */

const SECTION = "telkom";
const MAX_AUDIT = 200;
export const DEFAULT_DAILY_LIMIT = 3;

function normalizeNis(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Samarkan NIS untuk audit log (menjaga data siswa tetap minim terekspos). */
export function maskNis(nis) {
  const digits = normalizeNis(nis);
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
}

function section() {
  const data = db.data || {};
  if (!data[SECTION] || typeof data[SECTION] !== "object" || Array.isArray(data[SECTION])) {
    data[SECTION] = {};
  }
  const store = data[SECTION];
  if (!store.students || typeof store.students !== "object" || Array.isArray(store.students)) store.students = {};
  if (!store.usage || typeof store.usage !== "object" || Array.isArray(store.usage)) store.usage = {};
  if (!Array.isArray(store.audit)) store.audit = [];
  return store;
}

function save() {
  try {
    db.save();
  } catch (_) {}
}

/** Kuota harian per NIS (default 3x/hari). */
export function dailyLimit() {
  const raw = Number(process.env.TELKOM_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_LIMIT;
}

/** Data consent satu NIS (null bila tidak terdaftar). */
export function getConsent(nis) {
  const key = normalizeNis(nis);
  if (!key) return null;
  const entry = section().students[key];
  return entry && typeof entry === "object" ? entry : null;
}

/** True bila NIS terdaftar DAN sudah memberi consent. */
export function isConsented(nis) {
  const entry = getConsent(nis);
  return Boolean(entry && entry.consent);
}

/**
 * Tambah/ubah consent siswa.
 * @param {string} nis
 * @param {{consent?: boolean, actor?: string, note?: string, autoSubmit?: boolean, jid?: string}} options
 */
export function setConsent(nis, { consent = true, actor = "", note = "", autoSubmit = false, jid = "" } = {}) {
  const key = normalizeNis(nis);
  if (!key) return null;

  const store = section();
  const existing = store.students[key] || {};
  const next = {
    ...existing,
    nis: key,
    consent: Boolean(consent),
    autoSubmit: autoSubmit === undefined ? existing.autoSubmit !== false : Boolean(autoSubmit),
    note: note !== undefined ? String(note).slice(0, 200) : existing.note || "",
    jid: jid !== undefined ? String(jid || "").trim() : existing.jid || "",
    updatedAt: new Date().toISOString(),
  };
  if (!next.addedAt) next.addedAt = next.updatedAt;
  if (next.consent && !next.addedBy) next.addedBy = String(actor || "");

  store.students[key] = next;
  save();
  return next;
}

/** Cabut consent / hapus NIS dari whitelist. */
export function removeConsent(nis) {
  const key = normalizeNis(nis);
  if (!key) return false;
  const store = section();
  if (!store.students[key]) return false;
  delete store.students[key];
  save();
  return true;
}

/** Daftar NIS terdaftar (untuk perintah admin). */
export function listConsent() {
  const store = section();
  return Object.values(store.students)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      nis: entry.nis,
      consent: Boolean(entry.consent),
      autoSubmit: entry.autoSubmit !== false,
      jid: entry.jid || "",
      note: entry.note || "",
      addedAt: entry.addedAt || "",
      updatedAt: entry.updatedAt || "",
    }))
    .sort((a, b) => String(a.nis).localeCompare(String(b.nis)));
}

/**
 * Cari NIS yang terikat ke sebuah akun WhatsApp.
 * Dipakai untuk auto-absen: siswa tinggal kirim foto QR guru.
 */
export function findConsentByJid(jid) {
  const target = String(jid || "").trim();
  if (!target) return null;
  const store = section();
  for (const entry of Object.values(store.students)) {
    if (!entry || typeof entry !== "object") continue;
    if (!entry.jid) continue;
    if (entry.jid === target) {
      return { nis: entry.nis, consent: Boolean(entry.consent), autoSubmit: entry.autoSubmit !== false };
    }
  }
  return null;
}

/** Status kuota harian NIS tanpa menambah counter. */
export function quotaStatus(nis, today) {
  const key = normalizeNis(nis);
  const limit = dailyLimit();
  const usage = section().usage[key];
  const date = today || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const count = usage && usage.date === date ? Number(usage.count) || 0 : 0;
  return {
    nis: key,
    date,
    limit,
    count,
    remaining: Math.max(0, limit - count),
    allowed: count < limit,
  };
}

/** Tambah counter pemakaian harian (dipanggil setelah percobaan berhasil). */
export function recordUsage(nis, today) {
  const key = normalizeNis(nis);
  if (!key) return quotaStatus(nis, today);
  const date = today || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const store = section();
  const current = store.usage[key];
  const count = current && current.date === date ? Number(current.count) || 0 : 0;
  store.usage[key] = { date, count: count + 1 };
  save();
  return quotaStatus(key, date);
}

const SENSITIVE_KEYS = /^(password|passwd|pass|token|cookie|jwt|secret|authorization)$/i;

/** Buang field sensitif dari payload audit. */
export function sanitizeAuditPayload(payload = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") clean[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean") clean[key] = value;
    else clean[key] = "[object]";
  }
  return clean;
}

/**
 * Audit log TANPA data sensitif (tanpa password/token/cookie).
 * Disimpan di database (bounded) dan dicatat ke logger.
 */
export function audit(event, payload = {}, logger) {
  const store = section();
  const entry = {
    at: new Date().toISOString(),
    event: String(event || "unknown").slice(0, 40),
    ...sanitizeAuditPayload(payload),
  };
  store.audit.push(entry);
  if (store.audit.length > MAX_AUDIT) store.audit.splice(0, store.audit.length - MAX_AUDIT);
  save();
  logger?.info?.(`[TelkomAudit] ${entry.event} ${JSON.stringify(entry)}`);
  return entry;
}

/** Ambil audit trail terakhir (untuk admin). */
export function listAudit(limit = 20) {
  const store = section();
  const max = Math.max(1, Math.min(Number(limit) || 20, MAX_AUDIT));
  return store.audit.slice(-max).reverse();
}
