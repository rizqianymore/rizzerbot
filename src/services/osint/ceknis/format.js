import { parseNisQuery, fetchSiswaByNis } from "./fetch.js";

function neat(v) {
  const s = String(v ?? "").trim();
  return s || "-";
}

export function maskPhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "-";
  if (d.length <= 7) return `${d.slice(0, 2)}****`;
  return `${d.slice(0, 4)}****${d.slice(-4)}`;
}

export function formatSiswa(row, { showFullPhone = true } = {}) {
  const phone = neat(row["NO HP"]);
  const phoneShown = showFullPhone ? phone : phone === "-" ? "-" : maskPhone(phone);
  const lines = [];
  lines.push(`*DATA SISWA*`);
  lines.push(`No: ${neat(row.NO)}`);
  lines.push(`Nama: ${neat(row["NAMA SISWA"])}`);
  lines.push(`NIS: ${neat(row.NIS)}`);
  lines.push(`Kelas: ${neat(row.KELAS)}`);
  lines.push(`Tema: ${neat(row.TEMA)}`);
  lines.push(`Judul: ${neat(row.JUDUL)}`);
  lines.push(`Pembimbing: ${neat(row["GURU PEMBIMBING"])}`);
  lines.push(`No HP: ${phoneShown}`);
  const status = String(row.STATUS ?? "").trim();
  if (status) lines.push(`Status: ${status}`);
  return lines.join("\n");
}

export async function getSiswaInfoText(input, mode = "nis", opts = {}) {
  const parsed = parseNisQuery(input);
  if (!parsed.valid) return { error: parsed.reason };
  try {
    const rows = await fetchSiswaByNis(parsed.query, mode);
    if (!rows || rows.length === 0) {
      return { error: `Data NIS "${parsed.query}" tidak ditemukan.` };
    }
    if (rows.length === 1) return { text: formatSiswa(rows[0], opts) };
    const shown = rows.slice(0, 10);
    const out = [`*DATA SISWA (${rows.length} hasil)*`, ``];
    shown.forEach((r, i) => {
      out.push(`${i + 1}. *${neat(r["NAMA SISWA"])}* — NIS: ${neat(r.NIS)} | ${neat(r.KELAS)}`);
    });
    if (rows.length > 10) out.push(`_... dan ${rows.length - 10} lainnya. Persempit dengan NIS spesifik._`);
    out.push(``, `Detail: \`.ceknis <nis>\``);
    return { text: out.join("\n") };
  } catch (err) {
    opts?.logger?.warn?.(`[ceknis] gagal nis=${parsed.query}: ${err.message}`);
    if (err?.name === "AbortError") return { error: "Timeout menghubungi server data (10 dtk). Coba lagi." };
    return { error: `Gagal mengambil data: ${err.message}` };
  }
}

export async function getMultiSiswaInfoText(nisList, opts = {}) {
  const unique = [...new Set(nisList)].slice(0, 5);
  const results = await Promise.all(
    unique.map(async (nis) => {
      try {
        const rows = await fetchSiswaByNis(nis, "nis");
        if (!rows?.length) return { nis, error: "tidak ditemukan" };
        return { nis, text: formatSiswa(rows[0], opts) };
      } catch (err) {
        return { nis, error: err.message };
      }
    })
  );
  return results;
}
