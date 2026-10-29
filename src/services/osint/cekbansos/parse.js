function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHasil(html) {
  const badge = html.match(/DTSEN\s+TRIWULAN\s+[\d.]+\s*\d*/i)?.[0]?.trim() || "";
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const rows = [];
  for (const tr of tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (cells.length < 11) continue;
    rows.push({
      nama: cells[0] || "-",
      desil: cells[1] || "-",
      ketDtsen: cells[2] || "-",
      sembako: cells[3] || "-",
      sembakoPeriode: cells[4] || "-",
      pkh: cells[5] || "-",
      pkhPeriode: cells[6] || "-",
      pbi: cells[7] || "-",
      pbiPeriode: cells[8] || "-",
      pbiKet: cells[9] || "-",
      kpd: cells[10] || "-",
    });
  }
  return { badge, rows };
}

export function formatHasil(nik, parsed) {
  const maskNik = (n) => (n.length === 16 ? `${n.slice(0, 6)}********${n.slice(-4)}` : n);

  const ACRONYMS = new Set(["dtsen", "nik", "pkh", "pbi", "jk", "kpd", "ktp"]);
  const neatWord = (w) => {
    const l = w.toLowerCase();
    if (!l) return w;
    if (ACRONYMS.has(l)) return l.toUpperCase();
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  const neat = (s) =>
    String(s || "-")
      .toLowerCase()
      .split(/(\s+|[()/|-])/)
      .map((t) => (/^[\s()/|-]+$/.test(t) ? t : neatWord(t)))
      .join("");
  let text = `*HASIL CEK BANSOS*\n`;
  if (parsed.badge) text += `${neat(parsed.badge)}\n`;
  text += `NIK: ${maskNik(nik)}\n\n`;
  if (!parsed.rows.length) {
    return text + `Data tidak ditemukan untuk NIK tersebut (tidak terdaftar sebagai penerima manfaat).`;
  }
  for (const r of parsed.rows) {
    text +=
      `Nama: ${neat(r.nama)}\n` +
      `Desil: ${neat(r.desil)} (${neat(r.ketDtsen)})\n` +
      `Sembako: ${neat(r.sembako)}${r.sembakoPeriode !== "-" ? ` (${neat(r.sembakoPeriode)})` : ""}\n` +
      `PKH: ${neat(r.pkh)}${r.pkhPeriode !== "-" ? ` (${neat(r.pkhPeriode)})` : ""}\n` +
      `PBI-JK: ${neat(r.pbi)}${r.pbiPeriode !== "-" ? ` (${neat(r.pbiPeriode)})` : ""}${r.pbiKet !== "-" ? ` — ${neat(r.pbiKet)}` : ""}\n` +
      `KPD: ${neat(r.kpd)}\n`;
  }
  return text.trim();
}
