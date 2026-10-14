import axios from "axios";

const BASE = "https://kki.go.id";
const SEARCH_URL = `${BASE}/cek_dokter/search`;
const DETAIL_DOKTER_URL = `${BASE}/cek_dokter/detail_dokter`;
const DETAIL_NAKES_URL = `${BASE}/cek_dokter/detail_nakes`;
const PROFESI_URL = `${BASE}/ceknamednakes/get_profesi`;

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 50000,
  maxRedirects: 5,
  validateStatus: () => true,
});

let cachedCookies = "";
let cookieExpiry = 0;

const JENIS = { medis: "1", nakes: "2" };

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureCookies(force = false) {
  const now = Date.now();
  if (!force && cachedCookies && now < cookieExpiry) return;

  const res = await client.get(`${BASE}/`, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    timeout: 30000,
  });
  const cookies = res.headers["set-cookie"];
  if (cookies && cookies.length) {
    cachedCookies = cookies.map((c) => c.split(";")[0]).join("; ");
    cookieExpiry = now + 50 * 60 * 1000;
  }
}

function buildSearchParams(query, { jenis, tipe, profesi, start, length }) {
  const p = new URLSearchParams();
  p.append("draw", "1");
  p.append("start", String(start || 0));
  p.append("length", String(length || 10));
  p.append("search[value]", "");
  p.append("search[regex]", "false");
  p.append("order[0][column]", "0");
  p.append("order[0][dir]", "asc");

  for (let i = 0; i < 3; i++) {
    p.append(`columns[${i}][data]`, String(i));
    p.append(`columns[${i}][name]`, "");
    p.append(`columns[${i}][searchable]`, "true");
    p.append(`columns[${i}][orderable]`, "true");
    p.append(`columns[${i}][search][value]`, "");
    p.append(`columns[${i}][search][regex]`, "false");
  }
  p.append("nama", query);
  p.append("jenis", jenis);
  p.append("tipe", tipe || "nama");
  p.append("profesi", profesi || "");
  return p;
}

function parseSearchRows(json) {
  if (!json?.data || !Array.isArray(json.data)) return [];
  return json.data.map((row) => {
    const nama = stripHtml(row[1]);
    const buttonHtml = String(row[2] || "");
    const idMatch = buttonHtml.match(/detail_(?:dokter|nakes)\('([^']+)'\)/);
    return {
      no: row[0],
      nama,
      id: idMatch ? idMatch[1] : null,
    };
  });
}

export async function searchNakes(
  query,
  { jenis = JENIS.nakes, tipe = "nama", profesi = "", start = 0, length = 10 } = {}
) {
  if (!query || query.trim().length < 1) {
    throw new Error("Query kosong");
  }

  await ensureCookies();
  if (!cachedCookies) throw new Error("Gagal mendapatkan session dari KKI");

  const params = buildSearchParams(query.trim(), { jenis, tipe, profesi, start, length });
  const headers = {
    "User-Agent": UA,
    Accept: "application/json,*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cachedCookies,
    Referer: `${BASE}/ceknamednakes/form`,
  };

  let res;
  try {
    res = await client.post(SEARCH_URL, params, { headers });
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {

      await new Promise((r) => setTimeout(r, 1500));
      await ensureCookies(true);
      res = await client.post(SEARCH_URL, buildSearchParams(query.trim(), { jenis, tipe, profesi, start, length }), {
        headers: { ...headers, Cookie: cachedCookies },
      });
    } else {
      throw err;
    }
  }

  if (res.status !== 200) {
    if (res.status === 419 || res.status === 401) {
      await ensureCookies(true);
      return searchNakes(query, { jenis, tipe, profesi, start, length });
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  const rows = rankByRelevance(parseSearchRows(json), query);

  return {
    data: rows,
    total: json.recordsTotal || 0,
    filtered: json.recordsFiltered || 0,
  };
}

export async function getDetail(id, jenis = JENIS.nakes) {
  if (!id) throw new Error("ID kosong");

  await ensureCookies();
  const url = jenis === JENIS.medis ? DETAIL_DOKTER_URL : DETAIL_NAKES_URL;
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cachedCookies,
    Referer: `${BASE}/ceknamednakes/form`,
  };

  let res;
  try {
    res = await client.post(url, new URLSearchParams({ id }), { headers });
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      await new Promise((r) => setTimeout(r, 1500));
      await ensureCookies(true);
      res = await client.post(url, new URLSearchParams({ id }), {
        headers: { ...headers, Cookie: cachedCookies },
      });
    } else {
      throw err;
    }
  }

  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const html = typeof res.data === "string" ? res.data : String(res.data);
  return parseDetailHtml(html, jenis);
}

function extractDetailPhoto(html) {
  if (!html) return null;
  const tags = [...String(html).matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  if (!tags.length) return null;
  const BAD = /logo|icon|badge|banner|slide|blog|header|footer|sprite|placeholder|loading|pixel|track|ads/i;
  const GOOD = /foto|photo|profil|profile|avatar|pasfoto|sdmk|dokter|nakes|person|user|picture|gambar/i;
  const norm = (s) => {
    if (!s) return null;
    const dm = s.match(/^data:image\/(jpeg|jpg|png|webp|gif)(;charset=[^;,]+)?;base64,(.*)$/is);
    if (dm) {
      const b64 = (dm[3] || "").replace(/\s/g, "");
      if (b64.length < 100 || b64.length > 15_000_000) return null;
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
      return s;
    }
    if (/^data:/i.test(s)) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return `${BASE}${s}`;
    return `${BASE}/${s}`;
  };
  const cands = [];
  for (const m of tags) {
    const src = (m[1] || "").trim();
    if (!src) continue;
    const isDataUri = /^data:image\//i.test(src);
    const tagForCheck = m[0].replace(/base64,[A-Za-z0-9+/=\s]{20,}/is, "base64,...").slice(0, 500);
    const checkStr = isDataUri ? tagForCheck : `${src.slice(0, 500)} ${tagForCheck}`;
    if (BAD.test(checkStr)) continue;
    const url = norm(src);
    if (!url) continue;
    const score =
      (GOOD.test(checkStr) ? 2 : 0) +
      (isDataUri ? 1 : /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ? 1 : 0);
    cands.push({ url, score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.length ? cands[0].url : null;
}

export async function getSdmkPhoto(sdmkUrl) {
  if (!sdmkUrl || !/^https?:\/\/satusehat\.kemkes\.go\.id\/sdmk\//i.test(String(sdmkUrl))) return null;
  try {
    const res = await client.get(String(sdmkUrl), {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      timeout: 30000,
    });
    if (res.status !== 200) return null;
    const html = typeof res.data === "string" ? res.data : String(res.data);
    const m = html.match(/data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=]+)/i);
    if (!m) return null;
    const b64 = m[2];
    if (b64.length < 100 || b64.length > 15_000_000) return null;
    return `data:image/${m[1].toLowerCase()};base64,${b64}`;
  } catch {
    return null;
  }
}

export function parseDetailHtml(html, _jenis) {
  const out = {
    nama: "-",
    kualifikasi: "-",
    nomorStr: "-",
    masaBerlaku: "-",
    status: "-",
    sdmkUrl: "-",
    foto: extractDetailPhoto(html),
  };
  if (!html) return out;

  const nameMatch = html.match(/class="sdmk-name"[^>]*>([\s\S]*?)<\/h5>/);
  if (nameMatch) out.nama = stripHtml(nameMatch[1]);

  const urlMatch = html.match(/href="(https:\/\/satusehat\.kemkes\.go\.id\/sdmk\/[^"]+)"/);
  if (urlMatch) out.sdmkUrl = urlMatch[1];

  const rows = html.split(/class="sdmk-info-row"/).slice(1);
  for (const row of rows) {
    const labelMatch = row.match(/sdmk-label"[^>]*>[\s\S]*?<\/i>\s*([^<]+)<\/div>/);
    const valueMatch = row.match(/sdmk-value"[^>]*>([\s\S]*?)<\/div>/);
    if (!labelMatch || !valueMatch) continue;
    const label = stripHtml(labelMatch[1]).toLowerCase();
    const value = stripHtml(valueMatch[1]);
    if (label.includes("kualifikasi")) out.kualifikasi = value || "-";
    else if (label.includes("nomor str") || label.includes("no str")) out.nomorStr = value || "-";
    else if (label.includes("masa berlaku")) out.masaBerlaku = value || "-";
    else if (label.includes("status")) out.status = value || "-";
  }

  const badgeMatch = html.match(/badge\s+(bg-\w+|badge-\w+)"[^>]*>([^<]+)<\/span>/);
  if (badgeMatch && out.status) {
    out.statusClass = badgeMatch[1];
  }

  return out;
}

const profesiCache = { 1: null, 2: null };
let profesiExpiry = 0;

export async function getProfesi(jenis = JENIS.nakes) {
  const now = Date.now();
  if (profesiCache[jenis] && now < profesiExpiry) return profesiCache[jenis];

  await ensureCookies();
  const res = await client.post(PROFESI_URL, new URLSearchParams({ jenis }), {
    headers: {
      "User-Agent": UA,
      Accept: "application/json,*/*",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cachedCookies,
      Referer: `${BASE}/ceknamednakes/form`,
    },
  });

  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const json = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  const list = json.data || [];
  profesiCache[jenis] = list;
  profesiExpiry = now + 60 * 60 * 1000;
  return list;
}

export async function resolveProfesi(jenis, term) {
  if (!term) return "";
  const list = await getProfesi(jenis);
  const t = String(term).trim().toLowerCase();

  const byCode = list.find((p) => String(p.kode) === t);
  if (byCode) return String(byCode.kode);

  const byName = list.find((p) => p.profesi.toLowerCase() === t);
  if (byName) return String(byName.kode);

  const byPartial = list.find((p) => p.profesi.toLowerCase().includes(t));
  if (byPartial) return String(byPartial.kode);

  return null;
}

function statusTag(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("aktif") && !s.includes("tidak")) return "[AKTIF]";
  if (s.includes("tidak") || s.includes("non")) return "[NONAKTIF]";
  return "[INFO]";
}

export function rankByRelevance(rows, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q || !Array.isArray(rows)) return rows;
  const score = (nama) => {
    const n = String(nama || "").toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/\s+/).some((w) => w === q)) return 2;
    if (n.includes(q)) return 3;
    return 4;
  };
  return [...rows].sort((a, b) => score(a.nama) - score(b.nama));
}

export function formatProfesiList(list, jenis) {
  const title = jenis === JENIS.medis ? "Tenaga Medis" : "Tenaga Kesehatan (Nakes)";
  let text = `*DAFTAR PROFESI ${title.toUpperCase()}*\n\n`;
  list.forEach((p) => {
    text += `• \`${p.kode}\` — ${p.profesi}\n`;
  });
  text += `\n_Untuk filter, gunakan kode atau nama profesi._`;
  return text;
}

export function formatResults(query, result, details, opts = {}) {
  const { jenis, tipe } = opts;
  const { data, filtered } = result;
  const jenisLabel = jenis === JENIS.medis ? "Tenaga Medis" : "Tenaga Kesehatan";
  const tipeLabel = tipe === "str" ? "No. STR" : "Nama";

  let text = `*CEK NAKES — KONSIL KESEHATAN INDONESIA*\n\n`;
  text += `Pencarian: \`${query}\` (${tipeLabel})\n`;
  text += `Jenis: ${jenisLabel}\n`;
  text += `Ditemukan: *${filtered.toLocaleString("id-ID")}* data\n\n`;

  if (data.length === 0) {
    text += `*Tidak ditemukan data.*\n\n`;
    if (tipe === "nama" && jenis === JENIS.nakes) {
      text += `_Pencarian nama nakes bersifat *persis* (exact). Pastikan ejaan nama sesuai yang terdaftar, atau gunakan pencarian No. STR._\n\n`;
    } else if (jenis === JENIS.medis) {
      text += `_Pencarian tenaga medis bersifat *sebagian* (partial), tapi wajib menyertakan profesi. Tambahkan kode/nama profesi._\n\n`;
    }
    text += `_Sumber: kki.go.id (Konsil Kesehatan Indonesia)_`;
    return text;
  }

  const detailed = details || [];
  detailed.forEach((d, i) => {
    const se = statusTag(d.status);
    text += `*${i + 1}. ${d.nama || data[i]?.nama || "-"}*\n`;
    text += `   Kualifikasi: ${d.kualifikasi}\n`;
    text += `   No. STR: ${d.nomorStr}\n`;
    text += `   Masa Berlaku: ${d.masaBerlaku}\n`;
    text += `   ${se} Status STR: ${d.status}\n`;
    if (d.sdmkUrl && d.sdmkUrl !== "-") {
      text += `   Profil SDMK: ${d.sdmkUrl}\n`;
    }
    text += `\n`;
  });

  if (data.length > detailed.length) {
    const rest = data.slice(detailed.length, 10);
    if (rest.length) {
      text += `*Hasil lainnya:*\n`;
      rest.forEach((r, i) => {
        text += `   ${detailed.length + i + 1}. ${r.nama}\n`;
      });
      if (filtered > 10) {
        text += `   _...dan ${filtered.toLocaleString("id-ID") - 10} lainnya._\n`;
      }
      text += `\n`;
    }
  }

  text += `_Sumber: kki.go.id (Konsil Kesehatan Indonesia)_`;
  return text;
}
