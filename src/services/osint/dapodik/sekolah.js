import { withDapoPage, cacheGet, cacheSet, SEARCH_TTL_MS, DETAIL_TTL_MS } from "./client.js";

const searchCache = new Map();
const detailCache = new Map();

const NPSN_REGEX = /^\d{8}$/;

function neat(value, fallback = "-") {
  const s = String(value ?? "").trim();
  return s && s !== "-" ? s : fallback;
}

function labelSemester(code) {
  const m = /^(\d{4})([12])$/.exec(String(code || "").trim());
  if (!m) return neat(code);
  const start = Number(m[1]);
  return `${m[2] === "1" ? "Ganjil" : "Genap"} ${start}/${start + 1}`;
}

function formatTanggal(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const d = new Date(raw.replace(" ", "T"));
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export async function searchSekolah(query) {
  const q = String(query || "").trim();
  if (!q) throw new Error("query wajib diisi");
  if (q.length > 80) throw new Error("query terlalu panjang (maks 80 karakter)");

  const key = q.toLowerCase();
  const cached = cacheGet(searchCache, key);
  if (cached) return cached;

  const json = await withDapoPage((fetchJson) => fetchJson(`/api/detail-sekolah/search?q=${encodeURIComponent(q)}`));
  const items = Array.isArray(json?.data) ? json.data : [];
  cacheSet(searchCache, key, items, SEARCH_TTL_MS);
  return items;
}

export async function getSekolahDetail(npsn) {
  const code = String(npsn || "").trim();
  if (!NPSN_REGEX.test(code)) throw new Error("NPSN harus 8 digit angka");

  const cached = cacheGet(detailCache, code);
  if (cached) return cached;

  const json = await withDapoPage((fetchJson) => fetchJson(`/api/detail-sekolah?npsn=${code}`));
  const row = Array.isArray(json?.data) ? json.data[0] : null;
  if (row) cacheSet(detailCache, code, row, DETAIL_TTL_MS);
  return row || null;
}

/** Cari lalu detail dalam satu sesi browser (hemat resource). */
async function searchThenDetail(query) {
  return withDapoPage(async (fetchJson) => {
    const searchJson = await fetchJson(`/api/detail-sekolah/search?q=${encodeURIComponent(query)}`);
    const items = Array.isArray(searchJson?.data) ? searchJson.data : [];
    cacheSet(searchCache, query.toLowerCase(), items, SEARCH_TTL_MS);
    if (items.length !== 1 || !NPSN_REGEX.test(String(items[0]?.npsn || ""))) return { items };

    const detailJson = await fetchJson(`/api/detail-sekolah?npsn=${items[0].npsn}`);
    const row = Array.isArray(detailJson?.data) ? detailJson.data[0] : null;
    if (row) cacheSet(detailCache, row.npsn, row, DETAIL_TTL_MS);
    return { items, row };
  });
}

export function formatSekolah(row) {
  const rtRw = [row.rt ? `RT ${row.rt}` : "", row.rw ? `RW ${row.rw}` : ""].filter(Boolean).join("/");
  const alamatParts = [neat(row.alamat_jalan, ""), rtRw, neat(row.desa_kelurahan, "")].filter(Boolean);

  const lines = [];
  lines.push(`🏫 *DATA SEKOLAH — DAPODIK*\n`);
  lines.push(`• Nama: *${neat(row.nama)}*`);
  lines.push(`• NPSN: ${neat(row.npsn)}`);
  lines.push(`• Jenjang: ${neat(row.jenjang || row.bentuk_pendidikan)} (${neat(row.status_sekolah)})`);
  lines.push(`• Akreditasi: ${neat(row.akreditasi)}`);
  lines.push(`• Alamat: ${alamatParts.join(", ") || "-"}`);
  const wilayah = [neat(row.kecamatan), neat(row.kabupaten), neat(row.provinsi)]
    .filter((v) => v && v !== "-")
    .join(", ");
  if (wilayah) lines.push(`• Wilayah: ${wilayah}${row.kode_pos ? ` ${row.kode_pos}` : ""}`);
  if (row.nama_kepsek && row.nama_kepsek !== "-") lines.push(`• Kepala sekolah: ${neat(row.nama_kepsek)}`);

  const pd = Number(row.pd || 0);
  if (pd > 0) {
    lines.push(`• Peserta didik: ${pd} (L ${Number(row.pd_l || 0)} / P ${Number(row.pd_p || 0)})`);
  }
  const stats = [
    row.jum_guru ? `Guru ${Number(row.jum_guru)}` : "",
    row.jum_tendik ? `Tendik ${Number(row.jum_tendik)}` : "",
    row.rombel ? `Rombel ${Number(row.rombel)}` : "",
    row.ruang_kelas ? `Ruang kelas ${Number(row.ruang_kelas)}` : "",
  ].filter(Boolean);
  if (stats.length) lines.push(`• Tenaga & sarana: ${stats.join(" | ")}`);
  if (row.partisipasi_bos) lines.push(`• BOS: ${neat(row.partisipasi_bos)}`);
  if (row.status_kepemilikan && row.status_kepemilikan !== "-") {
    lines.push(
      `• Kepemilikan: ${neat(row.status_kepemilikan)}${row.nama_yayasan ? ` (${neat(row.nama_yayasan)})` : ""}`
    );
  }

  const updated = formatTanggal(row.tanggal_update);
  if (updated !== "-") lines.push(`\n_Data diperbarui ${updated} • ${labelSemester(row.semester)}_`);
  return lines.join("\n");
}

function formatList(query, items) {
  const shown = items.slice(0, 10);
  const lines = [`🏫 *HASIL PENCARIAN SEKOLAH*\n`];
  lines.push(`Query: \`${query}\``);
  lines.push(`Ditemukan: *${items.length}* sekolah (menampilkan ${shown.length} teratas)\n`);
  shown.forEach((item, i) => {
    const wilayah = [item.kecamatan, item.kabupaten, item.provinsi].filter(Boolean).join(", ");
    lines.push(`${i + 1}. *${neat(item.nama)}* — ${neat(item.jenjang)} (${neat(item.status_sekolah)})`);
    lines.push(`   NPSN: ${neat(item.npsn)}${wilayah ? ` | ${wilayah}` : ""}`);
  });
  if (items.length > shown.length) {
    lines.push(`\n_...dan ${items.length - shown.length} lainnya. Perjelas kata kunci atau pakai NPSN._`);
  }
  lines.push(`\n_Untuk detail: gunakan NPSN, contoh \`ceksekolah ${shown[0]?.npsn || "20100216"}\`_`);
  return lines.join("\n");
}

export async function getSekolahInfoText(input) {
  const raw = String(input || "").trim();
  if (!raw) return { error: "Masukkan nama sekolah atau NPSN 8 digit." };

  const startTime = Date.now();

  if (NPSN_REGEX.test(raw)) {
    const cached = cacheGet(detailCache, raw);
    const row = cached || (await getSekolahDetail(raw));
    if (!row) return { error: `Sekolah dengan NPSN ${raw} tidak ditemukan di Dapodik.` };
    return {
      text: `${formatSekolah(row)}\n\n_Sumber: dapo.kemendikdasmen.go.id • NPSN ${raw} • ${Date.now() - startTime} ms_`,
    };
  }

  const { items, row } = await searchThenDetail(raw);
  if (items.length === 0) return { error: `Sekolah "${raw}" tidak ditemukan di Dapodik.` };

  if (row) {
    return {
      text: `${formatSekolah(row)}\n\n_Sumber: dapo.kemendikdasmen.go.id • query: ${raw} • ${Date.now() - startTime} ms_`,
    };
  }
  return { text: `${formatList(raw, items)}\n\n_Sumber: dapo.kemendikdasmen.go.id • ${Date.now() - startTime} ms_` };
}
