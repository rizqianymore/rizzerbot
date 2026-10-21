/**
 * Penyimpanan sementara untuk sesi login 2FA (butuh kode OTP dari siswa).
 * Hanya disimpan di memori, berumur pendek, dan tidak memuat password/token.
 */

const TTL_MS = 10 * 60 * 1000;
const store = new Map();

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
