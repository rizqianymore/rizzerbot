import axios from "axios";

const BASE = "https://cekbpom.pom.go.id";
const DT_URL = `${BASE}/produk-dt/all`;
const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 25000,
  maxRedirects: 5,
  validateStatus: () => true,
});

let cachedCsrf = null;
let cachedCookies = "";
let csrfExpiry = 0;

async function ensureCsrfToken() {
  const now = Date.now();
  if (cachedCsrf && cachedCookies && now < csrfExpiry) return;

  try {
    const res = await client.get(`${BASE}/all-produk`, {
      params: { query: "test" },
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });

    const csrfMatch = res.data.match(/<meta name="csrf-token" content="([^"]+)"/);
    if (csrfMatch) cachedCsrf = csrfMatch[1];

    const cookies = res.headers["set-cookie"];
    if (cookies) {
      cachedCookies = cookies.map((c) => c.split(";")[0]).join("; ");
    }

    csrfExpiry = now + 55 * 60 * 1000;
  } catch (err) {
    console.warn("[BPOM] Gagal refresh CSRF token:", err.message);
  }
}

export async function searchProduk(query) {
  if (!query || query.trim().length < 2) {
    throw new Error("Query terlalu pendek (minimal 2 karakter)");
  }

  await ensureCsrfToken();
  if (!cachedCsrf || !cachedCookies) {
    throw new Error("Gagal mendapatkan CSRF token dari server BPOM");
  }

  const q = query.trim();
  const formData = new URLSearchParams();
  formData.append("draw", "1");
  formData.append("start", "0");
  formData.append("length", "50");
  formData.append("search[value]", q);
  formData.append("query", q);

  try {
    const res = await client.post(DT_URL, formData, {
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json,*/*",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-TOKEN": cachedCsrf,
        Origin: BASE,
        Referer: `${BASE}/all-produk`,
        Cookie: cachedCookies,
      },
    });

    if (res.status !== 200) {

      if (res.status === 419 || res.status === 401) {
        cachedCsrf = null;
        cachedCookies = "";
        csrfExpiry = 0;
        await ensureCsrfToken();
        if (cachedCsrf && cachedCookies) {
          return searchProduk(query);
        }
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = res.data;
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Format respons tidak terduga");
    }

    return json.data.map((item) => ({
      tipe: item.CATEGORY || item.CLASS || "-",
      nomorRegistrasi: item.PRODUCT_REGISTER || "-",
      namaProduk: item.PRODUCT_NAME || "-",
      pendaftar: item.REGISTRAR || "-",
      merk: item.PRODUCT_BRANDS || "-",
      kemasan: item.PRODUCT_PACKAGE || "-",
      bentukSediaan: item.PRODUCT_FORM || "-",
      komposisi: item.INGREDIENTS || "-",
      tanggalPermohonan: item.SUBMIT_DATE || "-",
      tanggalTerbit: item.PRODUCT_DATE || "-",
      tanggalExpired: item.PRODUCT_EXPIRED || "-",
      status: item.STATUS || "-",

      _raw: {
        productId: item.PRODUCT_ID,
        registrarAddress: item.REGISTRAR_ADD,
        manufacturerName: item.MANUFACTURER_NAME,
        manufacturerAddress: item.MANUFACTURER_ADDRESS,
        department: item.DEPARTMENT,
        atcCode: item.PRODUCT_ATC,
      },
    }));
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      throw new Error("Timeout menghubungi server BPOM");
    }
    throw err;
  }
}

export function formatProduk(item, index) {
  let text = `${index}. *${item.namaProduk}*\n`;
  text += `   📋 *Tipe:* ${item.tipe}\n`;
  text += `   🔢 *No. Registrasi:* ${item.nomorRegistrasi}\n`;
  text += `   🏭 *Pendaftar:* ${item.pendaftar}\n`;
  if (item.merk && item.merk !== "-") text += `   🏷️ *Merk:* ${item.merk}\n`;
  if (item.kemasan && item.kemasan !== "-") text += `   📦 *Kemasan:* ${item.kemasan}\n`;
  if (item.bentukSediaan && item.bentukSediaan !== "-") text += `   💊 *Bentuk Sediaan:* ${item.bentukSediaan}\n`;
  if (item.komposisi && item.komposisi !== "-") text += `   🧪 *Komposisi:* ${item.komposisi}\n`;
  if (item.tanggalTerbit && item.tanggalTerbit !== "-") text += `   📅 *Tgl Terbit:* ${item.tanggalTerbit}\n`;
  if (item.tanggalExpired && item.tanggalExpired !== "-") text += `   ⏰ *Tgl Expired:* ${item.tanggalExpired}\n`;
  text += `   ✅ *Status:* ${item.status}\n`;
  return text;
}

export function formatResults(query, results, startTime) {
  const latency = (Date.now() - startTime).toFixed(0);
  if (results.length === 0) {
    return `🔍 *CEK BPOM*\n\nQuery: \`${query}\`\n\n❌ Tidak ditemukan produk yang terdaftar.\n\n_Query: ${latency} ms_`;
  }

  const displayed = results.slice(0, 10);
  let text = `🔍 *CEK BPOM*\n\n`;
  text += `Query: \`${query}\`\n`;
  text += `Ditemukan: *${results.length}* produk (menampilkan ${displayed.length} teratas)\n\n`;

  displayed.forEach((item, i) => {
    text += formatProduk(item, i + 1) + "\n";
  });

  if (results.length > 10) {
    text += `\n_...dan ${results.length - 10} produk lainnya. Perjelas query jika perlu._\n`;
  }
  text += `\n_Query: ${latency} ms_`;
  text += `\n\n*Catatan:* Data bersumber dari cekbpom.pom.go.id (Produk Teregistrasi). Untuk keperluan hukum, verifikasi langsung ke BPOM.`;
  return text;
}
