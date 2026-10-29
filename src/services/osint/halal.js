import axios from "axios";

const BASE = "https://bpjph.halal.go.id";
const SEARCH_PATH = "/cari/sertifikat";

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  validateStatus: () => true,
});

const SEARCH_KEYS = {
  produk: "produk",
  pelaku: "pelaku_usaha",
  sertifikat: "no_regis",
  no_regis: "no_regis",
};

function stripHtml(s) {
  if (!s) return "";
  return String(s)
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

function joinRscPayload(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)].map((m) => {
    try {
      return JSON.parse('"' + m[1] + '"');
    } catch {
      return m[1];
    }
  });
  return chunks.join("");
}

function extractBalancedArray(str, startIdx) {

  const open = str.indexOf("[", startIdx);
  if (open === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return str.slice(open, i + 1);
    }
  }
  return null;
}

function parsePagination(payload) {
  const getNum = (key) => {
    const m = payload.match(new RegExp(`"${key}":(\\d+)`));
    return m ? parseInt(m[1], 10) : 0;
  };
  return {
    currentPage: getNum("currentPage"),
    totalItems: getNum("totalItems"),
    pageSize: getNum("pageSize"),
    totalPages: getNum("totalPages"),
  };
}

function normalizeItem(item) {
  const pabrik = Array.isArray(item.pabrik) ? item.pabrik : [];

  const prod = pabrik.find((p) => p.fasil_id === "FAPAB") || pabrik[0] || {};
  return {
    merekDagang: stripHtml(item.merek_dagang) || "-",
    namaProduk: stripHtml(item.nama_produk) || "-",
    pelakuUsaha: stripHtml(item.pelaku_usaha?.nama_pelaku_usaha) || "-",
    nib: stripHtml(item.pelaku_usaha?.nib) || "-",
    noSertifikat: stripHtml(item.sertifikat?.no_sertifikat) || "-",
    terbit: stripHtml(item.sertifikat?.tgl_terbit_sertifikat) || "-",
    pabrik: stripHtml(prod.nama) || "-",
    alamat: stripHtml(prod.alamat) || "-",
    kota: stripHtml(prod.kab_kota) || "-",
    provinsi: stripHtml(prod.provinsi) || "-",
    negara: stripHtml(prod.negara) || "-",
    kodePos: stripHtml(prod.kode_pos) || "-",
    skalaUsaha: stripHtml(item.skala_usaha) || "-",
    _raw: item,
  };
}

export async function searchHalal(query, { key = "produk", page = 1 } = {}) {
  if (!query || query.trim().length < 2) {
    throw new Error("Query terlalu pendek (minimal 2 karakter)");
  }

  const param = SEARCH_KEYS[key] || SEARCH_KEYS.produk;
  const q = query.trim();
  const url = `${BASE}${SEARCH_PATH}?${param}=${encodeURIComponent(q)}${page > 1 ? `&page=${page}` : ""}`;

  let res;
  try {
    res = await client.get(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      throw new Error("Timeout menghubungi server halal.go.id");
    }
    throw err;
  }

  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const payload = joinRscPayload(res.data);
  const di = payload.indexOf('"data":');
  if (di === -1) {

    return { data: [], totalItems: 0, pageSize: 10, totalPages: 1, currentPage: 1 };
  }

  const arrText = extractBalancedArray(payload, di + '"data":'.length);
  let items = [];
  if (arrText) {
    try {
      items = JSON.parse(arrText);
    } catch {
      items = [];
    }
  }

  const pagination = parsePagination(payload);
  return {
    data: items.map(normalizeItem),
    totalItems: pagination.totalItems,
    pageSize: pagination.pageSize,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage || page,
    key,
  };
}

export function formatResults(query, result, startTime) {
  const latency = (Date.now() - startTime).toFixed(0);
  const { data, totalItems } = result;
  const keyLabel =
    { produk: "Nama Produk", pelaku: "Pelaku Usaha", sertifikat: "No. Sertifikat" }[result.key] || "Produk";

  let text = `☪️ *CEK PRODUK HALAL — BPJPH*\n\n`;
  text += `🔍 Pencarian (${keyLabel}): \`${query}\`\n`;
  text += `📊 Ditemukan: *${totalItems.toLocaleString("id-ID")}* sertifikat\n\n`;

  if (data.length === 0) {
    text += `❌ *Tidak ditemukan data sertifikat halal.*\n\n`;
    text += `_Coba: nama produk lebih spesifik, pelaku usaha, atau No. sertifikat (diawali ID...)._\n\n`;
    text += `_Query: ${latency} ms_`;
    text += `\n\n*Sumber:* bpjph.halal.go.id (BPJPH Kemenag RI)`;
    return text;
  }

  const displayed = data.slice(0, 10);
  displayed.forEach((item, i) => {
    text += `${i + 1}. *${item.namaProduk}*\n`;
    text += `   🏷️ Merek: ${item.merekDagang}\n`;
    text += `   🧾 No. Sertifikat: ${item.noSertifikat}\n`;
    text += `   🏭 Pelaku Usaha: ${item.pelakuUsaha}\n`;
    text += `   📍 Pabrik: ${item.pabrik}\n`;
    text += `   📫 Alamat: ${item.alamat}${item.kota ? `, ${item.kota}` : ""}${
      item.negara ? ` (${item.negara})` : ""
    }${item.kodePos ? " " + item.kodePos : ""}\n`;
    text += `   📅 Terbit: ${item.terbit}\n`;
    text += `   ✅ Status: *HALAL TERSERTIFIKAT*\n\n`;
  });

  if (totalItems > 10) {
    const remaining = (totalItems - 10).toLocaleString("id-ID");
    text += `_...dan ${remaining} sertifikat lainnya. Gunakan kata kunci lebih spesifik._\n\n`;
  }
  text += `_Query: ${latency} ms_`;
  text += `\n\n*Sumber:* bpjph.halal.go.id (BPJPH Kemenag RI)`;
  return text;
}
