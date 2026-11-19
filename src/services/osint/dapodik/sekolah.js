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
  let text = `*OSINT TOOLS - DATA SEKOLAH DAPODIK*
`;
  text += `└─ NPSN       : ${row.npsn || "-"}
`;
  text += `└─ Nama       : ${row.nama || "-"}
`;
  text += `└─ Bentuk     : ${row.bentuk_pendidikan || "-"}
`;
  text += `└─ Status     : ${row.status || "-"}
`;
  text += `└─ Alamat     : ${row.alamat || "-"}
`;
  text += `└─ Desa/Kel   : ${row.desa_kelurahan || "-"}
`;
  text += `└─ Kecamatan  : ${row.kecamatan || "-"}
`;
  text += `└─ Kota/Kab   : ${row.kabupaten_kota || "-"}
`;
  text += `└─ Provinsi   : ${row.provinsi || "-"}
`;
  text += `└─ Akreditasi : ${row.akreditasi || "-"}
`;
  text += `│
`;
  return text;
}

function formatList(query, items) {
  const shown = items.slice(0, 10);
  const lines = [` *HASIL PENCARIAN SEKOLAH*\n`];
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
