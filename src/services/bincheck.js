// src/services/bincheck.js — cek BIN kartu (6-8 digit pertama) murni + enrich online.
// Sumber online: lookup.binlist.net (gratis, tanpa API key, header Accept-Version: 3).
// Privasi: TIDAK PERNAH meminta/menyimpan nomor kartu lengkap. Input >8 digit
// otomatis dipotong 8 digit untuk lookup & dimask di output.

/** Deteksi skema dari rentang IIN (ISO/IEC 7812). Urutan penting (spesifik dulu). */
export function detectScheme(digits) {
  const d = String(digits || "");
  if (/^4/.test(d)) return { scheme: "Visa", lengths: [16], note: "Kartu kredit/debit internasional terpopuler." };
  const mcOld = /^5[1-5]/.test(d);
  const mcNew = (() => {
    if (!/^2/.test(d) || d.length < 4) return d.startsWith("222") || d.startsWith("27");
    const n = Number(d.slice(0, 4));
    return n >= 2221 && n <= 2720;
  })();
  if (mcOld || mcNew) return { scheme: "Mastercard", lengths: [16], note: "Termasuk seri baru 2221-2720." };
  if (/^3[47]/.test(d)) return { scheme: "American Express", lengths: [15], note: "15 digit, diawali 34/37." };
  if (/^3(?:0[0-5]|[68])/.test(d)) return { scheme: "Diners Club", lengths: [14], note: "14 digit." };
  if (/^35/.test(d)) return { scheme: "JCB", lengths: [16], note: "Jepang; populer untuk kartu co-brand Indonesia." };
  if (/^62/.test(d)) return { scheme: "UnionPay", lengths: [16, 17, 18, 19], note: "China; 16-19 digit." };
  if (/^6011|^64|^65/.test(d)) return { scheme: "Discover", lengths: [16, 19], note: "Awalan 6 juga dipakai kartu domestik (cth. GPN Indonesia)." };
  if (/^60|^81|^82/.test(d)) return { scheme: "RuPay / Domestik", lengths: [16], note: "Awalan 6/8 juga dipakai kartu domestik (cth. GPN Indonesia)." };
  if (/^50|^5[6-9]/.test(d)) return { scheme: "Maestro", lengths: [12, 13, 14, 15, 16, 17, 18, 19], note: "Debit Maestro (Mastercard)." };
  return { scheme: "Tidak dikenal", lengths: [16], note: "Awalan tidak cocok pola IIN umum." };
}

function maskPan(digits) {
  if (digits.length <= 8) return digits;
  return `${digits.slice(0, 6)}****${digits.slice(-2)}`;
}

/**
 * Parse input BIN. Terima "45717360", "4571 7360", "5521-7500".
 * Return { valid, ... } — tidak pernah throw untuk input user.
 */
export function parseBin(rawInput) {
  const raw = String(rawInput || "").trim();
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return { valid: false, reason: "input kosong. Contoh: .bincheck 45717360" };
  if (digits.length < 6) return { valid: false, reason: "minimal 6 digit. Contoh: .bincheck 45717360" };
  if (digits.length > 19) return { valid: false, reason: "maksimal 19 digit (nomor kartu penuh tidak disarankan)" };

  const fullGiven = digits.length > 8;
  const bin = digits.slice(0, 8);
  const info = detectScheme(bin);

  return {
    valid: true,
    kind: "bin",
    formatted: fullGiven ? maskPan(digits) : bin,
    bin,
    binShort: bin.slice(0, 6),
    fullGiven,
    masked: fullGiven ? maskPan(digits) : null,
    scheme: info.scheme,
    lengths: info.lengths,
    schemeNote: info.note,
    note: fullGiven
      ? "Nomor lengkap dimask & tidak disimpan. Lain kali cukup kirim 6-8 digit pertama."
      : "Lookup memakai 6-8 digit pertama (BIN/IIN).",
  };
}

export function formatBinInfo(p) {
  const lines = [];
  lines.push(`*INFO BIN*`);
  lines.push(`BIN: ${p.fullGiven ? `${p.bin} (dari ${p.masked})` : p.bin}`);
  lines.push(`Skema: ${p.scheme}`);
  if (p.detail?.brand && p.detail.brand !== "-") lines.push(`Brand: ${p.detail.brand}`);
  if (p.detail?.type && p.detail.type !== "-") lines.push(`Tipe: ${p.detail.type}`);
  if (p.detail?.prepaid !== null && p.detail?.prepaid !== undefined) {
    lines.push(`Prabayar: ${p.detail.prepaid ? "Ya" : "Bukan"}`);
  }
  if (p.detail?.bank && p.detail.bank !== "-") lines.push(`Bank: ${p.detail.bank}`);
  if (p.detail?.country && p.detail.country !== "-") lines.push(`Negara: ${p.detail.country}`);
  if (p.detail?.currency && p.detail.currency !== "-") lines.push(`Mata Uang: ${p.detail.currency}`);
  lines.push(`Panjang Kartu: ${p.lengths.join("/")} digit`);
  if (!p.detail) lines.push(`Wilayah: ${p.schemeNote}`);
  return lines.join("\n");
}

/** Satu panggilan sinkron: parse + format offline. Return string atau null. */
export function getBinInfoText(input) {
  const parsed = parseBin(input);
  if (!parsed.valid) return null;
  return formatBinInfo(parsed);
}

// ── Enrich online via binlist.net (gratis, tanpa key) ──
const BINLIST_BASE = "https://lookup.binlist.net";
const BIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const binCache = new Map(); // bin -> { data, expires }

function cacheGet(key) {
  const hit = binCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  binCache.delete(key);
  return null;
}

function cacheSet(key, data) {
  binCache.set(key, { data, expires: Date.now() + BIN_TTL_MS });
  if (binCache.size > 200) {
    const firstKey = binCache.keys().next().value;
    binCache.delete(firstKey);
  }
}

/** Ambil detail BIN. Return { brand, type, prepaid, bank, country, currency } atau null. */
export async function getBinDetail(bin) {
  const key = String(bin || "").replace(/[^0-9]/g, "").slice(0, 8);
  if (key.length < 6) return null;
  const cached = cacheGet(key);
  if (cached) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${BINLIST_BASE}/${encodeURIComponent(key)}`, {
      headers: { "Accept-Version": "3", Accept: "application/json", "User-Agent": "rizzerbot/1.0" },
      signal: ctrl.signal,
    });
    if (res.status === 404) {
      cacheSet(key, null);
      return null;
    }
    // 429 = rate limit tier gratis → fallback offline, jangan cache.
    if (res.status === 429) return null;
    if (!res.ok) throw new Error(`BINLIST HTTP ${res.status}`);
    const d = await res.json();
    const neat = (v) => {
      if (v === true) return true;
      if (v === false) return false;
      const s = String(v ?? "").trim();
      return s || null;
    };
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const country = d.country || {};
    const bank = d.bank || {};
    const detail = {
      brand: neat(d.brand) || "-",
      type: cap(neat(d.type)) || "-",
      prepaid: d.prepaid === true ? true : d.prepaid === false ? false : null,
      bank: neat(bank.name) || "-",
      country: neat(country.name)
        ? `${neat(country.name)}${country.alpha2 ? ` (${country.alpha2})` : ""}`
        : "-",
      currency: neat(country.currency) || "-",
    };
    cacheSet(key, detail);
    return detail;
  } finally {
    clearTimeout(timer);
  }
}

/** Lengkapi hasil parseBin dengan detail online. Tak pernah throw — gagal = offline apa adanya. */
export async function enrichBin(parsed) {
  if (!parsed?.valid) return parsed;
  try {
    const detail = await getBinDetail(parsed.bin);
    if (detail) parsed.detail = detail;
  } catch (_) {
    // abaikan, fallback offline
  }
  return parsed;
}

/** Satu panggilan async untuk plugin: parse + enrich + format. */
export async function getBinInfoTextOnline(input) {
  const parsed = parseBin(input);
  if (!parsed.valid) return null;
  await enrichBin(parsed);
  return formatBinInfo(parsed);
}
