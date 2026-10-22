/**
 * Helper laporan jalur anti-protection untuk caption/log plugin.
 */

/** Label ramah-user untuk setiap jalur request. */
export const VIA_LABELS = {
  direct: "koneksi langsung",
  unlocker: "Bright Data Web Unlocker",
  proxy: "Bright Data Web Unlocker (native proxy)",
  browser: "browser stealth",
  "scraping-browser": "Bright Data Scraping Browser",
  cookies: "cookie clearance (browser)",
  "cookies:browser": "cookie clearance (browser stealth)",
  "cookies:scraping-browser": "cookie clearance (Scraping Browser)",
};

/** Ubah id jalur jadi label yang enak dibaca. */
export function describeVia(via) {
  if (!via) return "";
  return VIA_LABELS[via] || String(via);
}

/**
 * Susun catatan singkat kalau ada jalur unlocker/browser yang dipakai.
 *
 * @param {string[]} attempts daftar percobaan, mis. ["direct:protected", "unlocker:ok"]
 * @param {object} [opts]
 * @param {string} [opts.via] jalur yang berhasil
 * @returns {string} baris siap pakai ("" kalau tidak ada yang perlu dilaporkan)
 */
export function buildProtectionNote(attempts = [], opts = {}) {
  const list = Array.isArray(attempts) ? attempts : [];
  const protectedHit = list.some((entry) => /:(protected|blocked)$/.test(entry));
  const via = opts.via || list.findLast?.((entry) => entry.endsWith(":ok"))?.split(":")[0];

  if (!via) return "";
  if (!protectedHit) return "";

  const label = describeVia(via);
  return `🛡️ Proteksi diatasi via ${label}`;
}

/**
 * Gabungkan beberapa info jalur menjadi satu baris ringkas.
 * @param {string[]} vias
 * @returns {string}
 */
export function summarizeVias(vias = []) {
  const unique = [...new Set(vias.filter(Boolean))];
  if (!unique.length) return "";
  return unique.map((v) => describeVia(v)).join(" → ");
}

export default { VIA_LABELS, describeVia, buildProtectionNote, summarizeVias };
