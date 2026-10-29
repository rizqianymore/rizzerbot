import { stealthBrowser } from "@/src/utils/request.js";
import { BASE, UA, fetchWithTimeout, DETAIL_TTL_MS, detailCache, cacheGet, cacheSet, neat } from "./constants.js";
import { searchPddikti } from "./search.js";

const PRODI_PAGE_SIZE = 8;

function normalize(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function apiGet(path) {
  const url = `${BASE}${path}`;
  const cached = cacheGet(detailCache, path);
  if (cached) return cached;

  let payload = null;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json, text/plain, */*", "User-Agent": UA },
    });
    if (res.ok) payload = await res.json();
  } catch (_) {

  }

  if (!payload) {
    const inPage = await stealthBrowser.inPageFetch(url, { headers: { Accept: "application/json, text/plain, */*" } });
    if (inPage && typeof inPage === "object") payload = inPage;
    else if (typeof inPage === "string") {
      try {
        payload = JSON.parse(inPage);
      } catch (_) {
        payload = null;
      }
    }
  }

  if (!payload) throw new Error("Gagal mengambil data dari PDDikti");
  cacheSet(detailCache, path, payload, DETAIL_TTL_MS);
  return payload;
}

function pickPt(pts, raw) {
  const q = String(raw || "").trim();
  const byCode = pts.find((p) => String(p.kode || "").trim() === q);
  if (byCode) return byCode;
  const byName = pts.find((p) => normalize(p.nama) === normalize(q) || normalize(p.nama_singkat) === normalize(q));
  if (byName) return byName;
  return pts.length === 1 ? pts[0] : null;
}

function formatTanggalPanjang(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return neat(value);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function semesterCandidates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let start;
  let half;
  if (month >= 8) {
    start = year;
    half = 1;
  } else if (month <= 1) {
    start = year - 1;
    half = 1;
  } else {
    start = year - 1;
    half = 2;
  }
  const current = `${start}${half}`;
  const prev = half === 2 ? `${start}1` : `${start - 1}2`;
  const prevPrev = half === 2 ? `${start - 1}2` : `${start - 1}1`;
  return [current, prev, prevPrev];
}

async function getProdi(ptId) {
  for (const code of semesterCandidates()) {
    try {
      const json = await apiGet(`/api/pt/prodi/${ptId}/${code}`);
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (rows.length) return rows;
    } catch (_) {

    }
  }
  return [];
}

async function buildProdiSection(ptId) {
  const rows = await getProdi(ptId);
  if (!rows.length) return "• Program studi: data tidak tersedia";

  const aktif = rows.filter((r) => String(r.status_prodi || "").toLowerCase() === "aktif");
  const list = aktif.length ? aktif : rows;
  const top = [...list]
    .sort((a, b) => Number(b.jumlah_mahasiswa || 0) - Number(a.jumlah_mahasiswa || 0))
    .slice(0, PRODI_PAGE_SIZE);

  const jenjangCount = {};
  for (const r of list) {
    const j = neat(r.jenjang_prodi, "?");
    jenjangCount[j] = (jenjangCount[j] || 0) + 1;
  }
  const ringkasan = Object.entries(jenjangCount)
    .sort((a, b) => b[1] - a[1])
    .map(([j, n]) => `${j} (${n})`)
    .join(", ");

  const lines = [`• Program studi *aktif*: ${list.length}${ringkasan ? ` — ${ringkasan}` : ""}`];
  for (const r of top) {
    const mhs = Number(r.jumlah_mahasiswa || 0);
    const dosen = Number(r.jumlah_dosen || 0);
    lines.push(`   • ${neat(r.nama_prodi)} (${neat(r.jenjang_prodi)}) — ${mhs} mhs, ${dosen} dosen`);
  }
  if (list.length > top.length) lines.push(`   _...dan ${list.length - top.length} prodi lainnya_`);
  return lines.join("\n");
}

export async function getKampusInfoText(input) {
  const raw = String(input || "").trim();
  if (!raw) return { error: "Masukkan nama perguruan tinggi atau kode PT (6 digit)." };
  if (raw.length > 100) return { error: "Query terlalu panjang (maks 100 karakter)." };

  const startTime = Date.now();
  const data = await searchPddikti(raw);
  const pts = Array.isArray(data?.pt) ? data.pt : [];
  if (!pts.length) return { error: `Perguruan tinggi "${raw}" tidak ditemukan di PDDikti.` };

  const pt = pickPt(pts, raw);
  if (!pt) {
    const lines = [`🎓 *PILIH PERGURUAN TINGGI*\n`, `Query: \`${raw}\``, `Ditemukan: *${pts.length}* PT\n`];
    pts.slice(0, 10).forEach((p, i) => {
      lines.push(`${i + 1}. *${neat(p.nama)}* (${neat(p.nama_singkat, "-")}) — kode ${neat(p.kode, "-")}`);
    });
    lines.push(`\n_Untuk detail: sebutkan kode PT atau nama yang lebih spesifik_`);
    return { text: `${lines.join("\n")}\n\n_Sumber: PDDikti • ${Date.now() - startTime} ms_` };
  }

  const id = String(pt.id || "").trim();
  const safeGet = async (path) => {
    try {
      const json = await apiGet(path);
      return json?.data ?? null;
    } catch (_) {
      return null;
    }
  };

  const [detailData, rasioData, mhsData, biayaData, prodiText] = await Promise.all([
    safeGet(`/api/pt/detail/${id}`).then((d) => d || {}),
    safeGet(`/api/pt/rasio/${id}`),
    safeGet(`/api/pt/mahasiswa/${id}`),
    safeGet(`/api/pt/cost-range/${id}`),
    buildProdiSection(id),
  ]);

  const detail = detailData || {};
  const rasio = rasioData?.rasio || "";
  const mahasiswa = mhsData || {};
  const biaya = biayaData?.range_biaya_kuliah || "";

  const alamat = [
    neat(detail.alamat, "").replace(/\s+/g, " ").trim(),
    neat(detail.kab_kota_pt, ""),
    neat(detail.provinsi_pt, ""),
  ]
    .filter((v) => v && v !== "-")
    .join(", ");
  const lines = [`🎓 *PERGURUAN TINGGI — PDDIKTI*\n`];
  lines.push(
    `• Nama: *${neat(detail.nama_pt || pt.nama)}*${detail.nm_singkat || pt.nama_singkat ? ` (${neat(detail.nm_singkat || pt.nama_singkat)})` : ""}`
  );
  lines.push(`• Kode PT: ${neat(detail.kode_pt || pt.kode)}`);
  lines.push(`• Kelompok: ${neat(detail.kelompok)}${detail.pembina ? ` • pembina: ${neat(detail.pembina)}` : ""}`);
  lines.push(`• Status: ${neat(detail.status_pt)} • Akreditasi: ${neat(detail.akreditasi_pt)}`);
  if (detail.tgl_berdiri_pt) {
    lines.push(
      `• Berdiri: ${formatTanggalPanjang(detail.tgl_berdiri_pt)}${detail.sk_pendirian_sp ? ` • SK: ${neat(detail.sk_pendirian_sp)}` : ""}`
    );
  }
  if (alamat) lines.push(`• Alamat: ${alamat}${detail.kode_pos ? `, ${detail.kode_pos}` : ""}`);
  const kontak = [
    detail.website ? `web: ${detail.website}` : "",
    detail.no_tel ? `telp: ${detail.no_tel}` : "",
    detail.email ? `email: ${detail.email}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  if (kontak) lines.push(`• Kontak: ${kontak}`);
  if (rasio) lines.push(`• Rasio dosen:mahasiswa: ${rasio}`);
  if (mahasiswa.mean_jumlah_baru || mahasiswa.mean_jumlah_lulus) {
    lines.push(
      `• Rata-rata mhs baru: ${Number(mahasiswa.mean_jumlah_baru || 0).toLocaleString("id-ID")} • lulusan: ${Number(mahasiswa.mean_jumlah_lulus || 0).toLocaleString("id-ID")}`
    );
  }
  if (biaya) lines.push(`• Rentang biaya kuliah: Rp${biaya}`);
  lines.push(prodiText);

  return {
    text: `${lines.join("\n")}\n\n_Sumber: PDDikti (${BASE.replace("https://", "")}) • query: ${raw} • ${Date.now() - startTime} ms_`,
  };
}
