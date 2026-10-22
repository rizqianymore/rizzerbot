/**
 * Penyimpanan sementara untuk sesi login 2FA (butuh kode OTP dari siswa).
 * Hanya disimpan di memori, berumur pendek, dan tidak memuat password/token.
 */

const TTL_MS = 10 * 60 * 1000;
const store = new Map();

/** State scan (QR guru + lokasi) per akun, supaya bisa dikirim 2 langkah. */
const scanStore = new Map();
const SCAN_TTL_MS = 15 * 60 * 1000;

function key(nis, jid) {
  return `${String(nis || "").replace(/\D/g, "")}:${String(jid || "").trim()}`;
}

function prune() {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (now - entry.at > TTL_MS) store.delete(id);
  }
}

/** Simpan sesi 2FA yang menunggu kode OTP. */
export function setPendingTwoFactor(nis, jid, url) {
  prune();
  const id = key(nis, jid);
  store.set(id, { at: Date.now(), url: String(url || ""), nis: String(nis || "") });
  return id;
}

/** Ambil (dan hapus) sesi 2FA. */
export function takePendingTwoFactor(nis, jid) {
  prune();
  const id = key(nis, jid);
  const entry = store.get(id);
  if (!entry) return null;
  store.delete(id);
  return entry;
}

/** Cek tanpa menghapus. */
export function hasPendingTwoFactor(nis, jid) {
  prune();
  return store.has(key(nis, jid));
}

/** Hapus semua sesi 2FA (untuk reset/test). */
export function clearPendingTwoFactor() {
  store.clear();
}

/* ------------------------------------------------------------------ */
/* State scan QR guru + lokasi (2 langkah: foto QR, lalu lokasi)      */
/* ------------------------------------------------------------------ */

function scanKey(jid) {
  return String(jid || "").trim();
}

/** Simpan QR guru dan/atau lokasi terakhir dari seorang siswa. */
export function setScanState(jid, { qrPayload = null, location = null } = {}) {
  const id = scanKey(jid);
  if (!id) return null;
  const now = Date.now();
  const previous = scanStore.get(id);
  const next = {
    at: now,
    qrPayload: qrPayload || previous?.qrPayload || null,
    location: location || previous?.location || null,
  };
  scanStore.set(id, next);
  return next;
}

/** Ambil state scan (QR + lokasi) siswa. */
export function getScanState(jid) {
  const id = scanKey(jid);
  if (!id) return null;
  const state = scanStore.get(id);
  if (!state) return null;
  if (Date.now() - state.at > SCAN_TTL_MS) {
    scanStore.delete(id);
    return null;
  }
  return state;
}

/** Hapus state scan siswa. */
export function clearScanState(jid) {
  scanStore.delete(scanKey(jid));
}
