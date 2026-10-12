import axios from "axios";

const BASE = "https://infoalkes.kemkes.go.id";
const SEARCH_URL = `${BASE}/cari/getPencarian`;
const DETAIL_URL = `${BASE}/cari`;

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 25000,
  maxRedirects: 5,
  validateStatus: () => true,
});

let cachedCookies = "";
let cookieExpiry = 0;

const KAT_PENCARIAN = {
  nomor_izin_edar: "1",
  nama_produk: "2",
  pendaftar: "3",
  tipe: "4",
  produsen: "5",
  jenis_produk: "6",
};

function stripHtml(html) {
  if (!html) return "-";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNomorIzin(raw) {
  // Extract clean nomor from HTML like: <b>AKL 21603712060</b><div>Terbit : 2029-12-31</div><div>Expired : 2029-12-31</div>
  const match = raw?.match(/<b>([^<]+)<\/b>/);
  const nomor = match ? match[1].trim() : stripHtml(raw);
  const terbitMatch = raw?.match(/Terbit\s*:\s*([^<\n]+)/);
  const expiredMatch = raw?.match(/Expired\s*:\s*([^<\n]+)/);
  return {
    nomor,
    terbit: terbitMatch ? terbitMatch[1].trim() : "-",
    expired: expiredMatch ? expiredMatch[1].trim() : "-",
  };
}

function extractMerk(raw) {
  // <b>LITHO Surgical Laser System</b><div>Peralatan Bedah</div><div>Laser surgical instrument...</div><span class="badge...">Elektromedik Non Radiasi</span>
  const match = raw?.match(/<b>([^<]+)<\/b>/);
  const nama = match ? match[1].trim() : stripHtml(raw);
  const typeMatch = raw?.match(/<div>([^<]+)<\/div>/);
  const jenis = typeMatch ? typeMatch[1].trim() : "-";
  const classMatch = raw?.match(/badge-light-\s*(\w+)/);
  const kategori = classMatch ? classMatch[1] : "-";
  return { nama, jenis, kategori };
}

function extractTipe(raw) {
  // <b>-</b><div>Kelas : C</div> or <b>FS 969H</b><div>Kelas : A</div>
  const match = raw?.match(/<b>([^<]+)<\/b>/);
  const tipe = match ? match[1].trim() : "-";
  const kelasMatch = raw?.match(/Kelas\s*:\s*([^<\n]+)/);
  const kelas = kelasMatch ? kelasMatch[1].trim() : "-";
  return { tipe: tipe === "-" ? "-" : tipe, kelas };
}

function extractPendaftar(raw) {
  // <b>PT. I-TECH LAFACOS</b><div>Gedung indra centra Blok M-N, Jl. Jendral suprapto No. 60, Kel Cempaka Putih barat , Kec. Cempaka Putih</div>
  const match = raw?.match(/<b>([^<]+)<\/b>/);
  const nama = match ? match[1].trim() : stripHtml(raw);
  const addrMatch = raw?.match(/<div>([^<]+)<\/div>/);
  const alamat = addrMatch ? addrMatch[1].trim() : "-";
  return { nama, alamat };
}

function extractProdusen(raw) {
  // <b>QUANTA SYSTEM.</b><div>Italy</div><div></div><div></div><div></div>
  const match = raw?.match(/<b>([^<]+)<\/b>/);
  const nama = match ? match[1].trim() : stripHtml(raw);
  const negaraMatch = raw?.match(/<div>([^<]+)<\/div>/);
  const negara = negaraMatch ? negaraMatch[1].trim() : "-";
  return { nama, negara };
}

function extractStatus(raw) {
  // <span class="badge py-3 px-4 fs-7 badge-light-success">Berlaku</span>
  const match = raw?.match(/badge-light-(\w+)">([^<]+)<\/span>/);
  if (match) return { status: match[2].trim(), class: match[1] };
  return { status: stripHtml(raw), class: "-" };
}

async function ensureCookies() {
  const now = Date.now();
  if (cachedCookies && now < cookieExpiry) return;

  try {
    const res = await client.get(BASE, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
    const cookies = res.headers["set-cookie"];
    if (cookies) {
      cachedCookies = cookies.map((c) => c.split(";")[0]).join("; ");
      cookieExpiry = now + 55 * 60 * 1000; // 55 min
    }
  } catch (err) {
    console.warn("[InfoAlkes] Gagal refresh cookies:", err.message);
  }
}

function parseDataTableResponse(json) {
  if (!json.data || !Array.isArray(json.data)) return [];

  return json.data.map((item) => {
    const nomorInfo = extractNomorIzin(item.NOMOR);
    const merkInfo = extractMerk(item.MERK);
    const tipeInfo = extractTipe(item.TIPE);
    const pendaftarInfo = extractPendaftar(item.PENDAFTAR);
    const produsenInfo = extractProdusen(item.PRODUSEN);
    const statusInfo = extractStatus(item.STATUS_NIE);

    return {
      produkId: item.PRODUK_ID || "-",
      tanggal: item.TANGGAL || "-",
      nomorIzin: nomorInfo.nomor,
      terbit: nomorInfo.terbit,
      expired: nomorInfo.expired,
      namaProduk: merkInfo.nama,
      jenisProduk: item.JENIS_PRODUK || merkInfo.jenis,
      kategoriProduk: merkInfo.kategori,
      tipe: tipeInfo.tipe,
      kelas: tipeInfo.kelas,
      keterangan: stripHtml(item.KETERANGAN),
      pendaftar: pendaftarInfo.nama,
      pendaftarAlamat: pendaftarInfo.alamat,
      produsen: produsenInfo.nama,
      produsenNegara: produsenInfo.negara,
      status: statusInfo.status,
      statusClass: statusInfo.class,
      _raw: item,
    };
  });
}

export async function searchInfoAlkes(query, category = "nomor_izin_edar", page = 1, perPage = 20) {
  if (!query || query.trim().length < 2) {
    throw new Error("Query terlalu pendek (minimal 2 karakter)");
  }

  await ensureCookies();
  if (!cachedCookies) {
    throw new Error("Gagal mendapatkan session dari server InfoAlkes");
  }

  const kat = KAT_PENCARIAN[category] || KAT_PENCARIAN.nomor_izin_edar;
  const q = query.trim();

  const params = new URLSearchParams();
  params.append("draw", String(page));
  params.append("start", String((page - 1) * perPage));
  params.append("length", String(perPage));
  params.append("search[value]", "");
  params.append("search[regex]", "false");
  params.append("kat_pencarian", kat);
  params.append("strCari", q);

  try {
    const res = await client.get(SEARCH_URL, {
      params,
      headers: {
        "User-Agent": UA,
        Accept: "application/json,*/*",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${BASE}/cari`,
        Cookie: cachedCookies,
      },
    });

    if (res.status !== 200) {
      if (res.status === 401 || res.status === 419) {
        cachedCookies = "";
        cookieExpiry = 0;
        await ensureCookies();
        if (cachedCookies) return searchInfoAlkes(query, category, page, perPage);
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = res.data;
    const results = parseDataTableResponse(json);

    return {
      data: results,
      total: json.recordsTotal || 0,
      filtered: json.recordsFiltered || 0,
      page,
      perPage,
    };
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      throw new Error("Timeout menghubungi server InfoAlkes");
    }
    throw err;
  }
}

export async function getDetail(produkId) {
  if (!produkId) throw new Error("PRODUK_ID kosong");

  await ensureCookies();
  if (!cachedCookies) throw new Error("Gagal mendapatkan session");

  // produkId from API is like "ie_ak|S-C01400090090626" -> need to base64 encode
  const encoded = Buffer.from(produkId).toString("base64");
  const url = `${DETAIL_URL}/${encoded}/detail`;

  try {
    const res = await client.get(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        Referer: `${BASE}/cari`,
        Cookie: cachedCookies,
      },
    });

    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return res.data; // HTML content for modal
  } catch (err) {
    throw new Error(`Gagal ambil detail: ${err.message}`);
  }
}

export function formatResults(query, result, startTime) {
  const latency = (Date.now() - startTime).toFixed(0);
  const { data, total, filtered } = result;

  if (data.length === 0) {
    return `🔍 *CEK INFO ALKES/PKRT*\n\nQuery: \`${query}\`\nKategori: \`${categoryLabel(query)}\`\n\n❌ Tidak ditemukan data.\n\n_Query: ${latency} ms_`;
  }

  const displayed = data.slice(0, 10);
  let text = `🔍 *CEK INFO ALKES/PKRT*\n\n`;
  text += `Query: \`${query}\`\n`;
  text += `Total: *${filtered.toLocaleString("id-ID")}* dari ${total.toLocaleString("id-ID")} (halaman ${result.page})\n\n`;

  displayed.forEach((item, i) => {
    text += `${i + 1}. *${item.namaProduk}*\n`;
    text += `   🔢 *No. Izin:* ${item.nomorIzin}\n`;
    text += `   📦 *Kategori:* ${item.keterangan}\n`;
    text += `   🏷️ *Jenis:* ${item.jenisProduk}\n`;
    text += `   📋 *Tipe/Kelas:* ${item.tipe} / ${item.kelas}\n`;
    text += `   🏭 *Pendaftar:* ${item.pendaftar}\n`;
    text += `   🏪 *Produsen:* ${item.produsen} (${item.produsenNegara})\n`;
    text += `   📅 *Terbit:* ${item.terbit} | *Expired:* ${item.expired}\n`;
    text += `   ✅ *Status:* ${item.status}\n\n`;
  });

  if (data.length > 10) {
    text += `_...dan ${data.length - 10} data lainnya di halaman ini. Total filtered: ${filtered.toLocaleString("id-ID")}_\n\n`;
  }
  text += `_Query: ${latency} ms_`;
  text += `\n\n*Sumber:* infoalkes.kemkes.go.id (e-Info Alkes PKRT)`;
  return text;
}

function categoryLabel(query) {
  // Not used but kept for potential future use
  return "Semua";
}