import axios from "axios";

const SIMPKB_BASE_URL = "https://portal-backend.simpkb.id";

const client = axios.create({
  baseURL: SIMPKB_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    Origin: "https://portal.simpkb.id",
    Referer: "https://portal.simpkb.id/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

const cache = new Map();

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
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const res = await client.get("/cari", {
    params: {
      keyword: cleanKeyword,
      page: page || 1,
    },
  });

  cache.set(cacheKey, {
    data: res.data,
    expiresAt: now + 5 * 60 * 1000,
  });

  return res.data;
}

export function formatGtkItem(item, index) {
  const statusList = (item.status || [])
    .filter((s) => s && s[1])
    .map((s) => s[0]);

  const satminkal = item.satminkal || {};
  const kota = satminkal.m_kota?.keterangan || "-";
  const provinsi = satminkal.m_propinsi?.keterangan || "-";

  let text = `${index ? `${index}. ` : ""}*${item.nama || "-"}*\n`;
  text += `• No. UKG: *${item.ptk_id || "-"}*\n`;
  text += `• NUPTK: ${item.nuptk || "-"}\n`;
  text += `• NIK: ${item.nik || "-"}\n`;
  text += `• Jenis PTK: ${item.jenis_ptk || "-"}\n`;
  text += `• Status SIMPKB: ${item.aktif_simpkb || "Aktif"}\n`;
  text += `• Satminkal: ${satminkal.nama || "-"}\n`;
  text += `• Wilayah: ${kota}, ${provinsi}\n`;

  if (item.pegawai) {
    text += `• Kepegawaian: ${item.pegawai}\n`;
  }
  if (item.aktif_dapodik) {
    text += `• Dapodik: ${item.aktif_dapodik} (Sinkron: ${formatDateString(item.last_sync || item.wkt_sinkron)})\n`;
  }

  if (statusList.length > 0) {
    text += `• Info Status:\n  - ${statusList.join("\n  - ")}\n`;
  }

  const tugas = item.tugases || [];
  if (tugas.length > 0) {
    text += `• Tugas Tambahan: ${tugas.map((t) => t.tugas || "Tugas").join(", ")}\n`;
  }

  return text.trim();
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
        `🔍 *DATA GTK — SIMPKB*\n\n` +
        formatGtkItem(items[0]) +
        `\n\n_Sumber: portal.simpkb.id • ${Date.now() - startTime} ms_`;
      return { text: singleText };
    }

    const shown = items.slice(0, 5);
    const lines = [`🔍 *HASIL PENCARIAN GTK SIMPKB*\n`];
    lines.push(`Query: \`${cleanKeyword}\``);
    lines.push(`Total ditemukan: *${total}* data (menampilkan ${shown.length} teratas)\n`);

    shown.forEach((item, idx) => {
      lines.push(formatGtkItem(item, idx + 1));
      lines.push("");
    });

    if (items.length > shown.length) {
      lines.push(`_...dan ${total - shown.length} data lainnya. Perjelas pencarian dengan Nama lengkap / No. UKG / NUPTK._\n`);
    }

    lines.push(`_Sumber: portal.simpkb.id • ${Date.now() - startTime} ms_`);
    return { text: lines.join("\n").trim() };
  } catch (err) {
    return { error: `Gagal menghubungi SIMPKB: ${err.message}` };
  }
}
