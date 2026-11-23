import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const SIMPKB_BASE_URL = "https://portal-backend.simpkb.id";
const cache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 200 });

function formatDateString(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const day = String(d.getDate()).padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");

    return `${day} ${month} ${year} pk. ${hours}:${mins} WIB`;
  } catch {
    return isoString;
  }
}

export async function fetchRawSimpkb(keyword, page = 1) {
  const cleanKeyword = String(keyword || "").trim();
  const cacheKey = `${cleanKeyword.toLowerCase()}_p${page}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await request.json(`${SIMPKB_BASE_URL}/cari`, {
    params: {
      keyword: cleanKeyword,
      page: page || 1,
    },
    timeout: 15000,
    headers: {
      Accept: "application/json",
      Origin: "https://portal.simpkb.id",
      Referer: "https://portal.simpkb.id/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  cache.set(cacheKey, data);
  return data;
}

export function formatGtkItem(item, index) {
  let text = `*OSINT TOOLS - DATA GTK KEMENDIKBUD*
`;
  text += `└─ No. Peserta : ${item.no_peserta || item.nik || "-"}
`;
  text += `└─ Nama        : ${item.nama || "-"}
`;
  text += `└─ Satminkal   : ${item.satminkal || "-"}
`;
  text += `└─ Status      : ${item.status || "-"}
`;
  text += `└─ Jenjang     : ${item.jenjang || "-"}
`;
  text += `└─ Kota/Kab    : ${item.kota || "-"}
`;
  text += `└─ Provinsi    : ${item.provinsi || "-"}
`;
  text += `│
`;
  return text;
}

export async function searchGtk(keyword, page = 1) {
  const cleanKeyword = String(keyword || "").trim();
  if (!cleanKeyword) {
    return { error: "Masukkan kata kunci pencarian (Nama GTK, No. UKG, NUPTK, atau NIK)." };
  }

  const startTime = Date.now();
  try {
    const rawRes = await fetchRawSimpkb(cleanKeyword, page);
    const items = rawRes.data || [];
    const total = rawRes.total || 0;

    if (items.length === 0) {
      return {
        error: `Data GTK tidak ditemukan untuk kata kunci: *${cleanKeyword}*`,
      };
    }

    if (items.length === 1) {
      const singleText =
        ` *DATA GTK — SIMPKB*\n\n` +
        formatGtkItem(items[0]) +
        `\n\n_Sumber: portal.simpkb.id • ${Date.now() - startTime} ms_`;
      return { text: singleText };
    }

    const shown = items.slice(0, 5);
    const lines = [` *HASIL PENCARIAN GTK SIMPKB*\n`];
    lines.push(`Query: \`${cleanKeyword}\``);
    lines.push(`Total ditemukan: *${total}* data (menampilkan ${shown.length} teratas)\n`);

    shown.forEach((item, idx) => {
      lines.push(formatGtkItem(item, idx + 1));
      lines.push("");
    });

    if (items.length > shown.length) {
      lines.push(
        `_...dan ${total - shown.length} data lainnya. Perjelas pencarian dengan Nama lengkap / No. UKG / NUPTK._\n`
      );
    }

    lines.push(`_Sumber: portal.simpkb.id • ${Date.now() - startTime} ms_`);
    return { text: lines.join("\n").trim() };
  } catch (err) {
    return { error: `Gagal menghubungi SIMPKB: ${err.message}` };
  }
}
