import axios from "axios";

// Kode provinsi Kemendagri (sama persis dengan sumber API wilayah).
const PROVINCES = {
  11: "ACEH", 12: "SUMATERA UTARA", 13: "SUMATERA BARAT", 14: "RIAU", 15: "JAMBI",
  16: "SUMATERA SELATAN", 17: "BENGKULU", 18: "LAMPUNG", 19: "KEPULAUAN BANGKA BELITUNG",
  21: "KEPULAUAN RIAU", 31: "DKI JAKARTA", 32: "JAWA BARAT", 33: "JAWA TENGAH",
  34: "DI YOGYAKARTA", 35: "JAWA TIMUR", 36: "BANTEN", 51: "BALI",
  52: "NUSA TENGGARA BARAT", 53: "NUSA TENGGARA TIMUR", 61: "KALIMANTAN BARAT",
  62: "KALIMANTAN TENGAH", 63: "KALIMANTAN SELATAN", 64: "KALIMANTAN TIMUR",
  65: "KALIMANTAN UTARA", 71: "SULAWESI UTARA", 72: "SULAWESI TENGAH",
  73: "SULAWESI SELATAN", 74: "SULAWESI TENGGARA", 75: "GORONTALO", 76: "SULAWESI BARAT",
  81: "MALUKU", 82: "MALUKU UTARA", 91: "PAPUA BARAT", 94: "PAPUA",
};

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const ACRONYMS = new Set(["dki", "di"]);

function neatWord(w) {
  const l = w.toLowerCase();
  if (!l) return w;
  if (ACRONYMS.has(l)) return l.toUpperCase();
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** "KOTA PADANG" → "Kota Padang", "DI YOGYAKARTA" → "DI Yogyakarta". */
export function neat(s) {
  return String(s || "-")
    .toLowerCase()
    .split(/(\s+|[()/|-])/)
    .map((t) => (/^[\s()/|-]+$/.test(t) ? t : neatWord(t)))
    .join("");
}

function zodiac(day, month) {
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  return "Sagittarius";
}

function generation(year) {
  if (year < 1946) return "Pra-Boomer";
  if (year <= 1964) return "Baby Boomer";
  if (year <= 1980) return "Gen X";
  if (year <= 1996) return "Milenial";
  if (year <= 2012) return "Gen Z";
  return "Gen Alpha";
}

/**
 * Parse struktur NIK 16 digit (murni lokal, tanpa network).
 * Mengembalikan { valid, reason } bila struktur tak sah.
 */
export function parseNik(nik) {
  const n = String(nik || "").trim();
  if (!/^\d{16}$/.test(n)) return { valid: false, reason: "nik harus 16 digit angka" };

  const provCode = n.slice(0, 2);
  const cityCode = n.slice(0, 4);
  const districtCode = n.slice(0, 6);
  const dayRaw = Number(n.slice(6, 8));
  const month = Number(n.slice(8, 10));
  const yy = Number(n.slice(10, 12));
  const seq = n.slice(12, 16);

  if (!PROVINCES[provCode]) return { valid: false, reason: `kode provinsi ${provCode} tidak dikenal` };

  let day = dayRaw;
  let gender = "Laki-Laki";
  if (dayRaw >= 41 && dayRaw <= 71) {
    day = dayRaw - 40;
    gender = "Perempuan";
  } else if (dayRaw < 1 || dayRaw > 31) {
    return { valid: false, reason: "tanggal lahir pada nik tidak valid" };
  }
  if (month < 1 || month > 12) return { valid: false, reason: "bulan lahir pada nik tidak valid" };

  const nowYear = new Date().getFullYear();
  const year = 2000 + yy <= nowYear ? 2000 + yy : 1900 + yy;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { valid: false, reason: "tanggal lahir pada nik tidak valid" };
  }

  const now = new Date();
  let age = now.getFullYear() - year;
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthday) age--;

  const pad = (v) => String(v).padStart(2, "0");
  return {
    valid: true,
    nik: n,
    formatted: `${provCode}.${cityCode.slice(2)}.${districtCode.slice(4)}.${n.slice(6, 12)}.${seq}`,
    gender,
    birthStr: `${pad(day)}-${pad(month)}-${year}`,
    dayName: HARI[date.getUTCDay()],
    age,
    zodiac: zodiac(day, month),
    generation: generation(year),
    provinceCode: provCode,
    province: neat(PROVINCES[provCode]),
    cityCode,
    city: null, // diisi enrichWilayah
    districtCode,
    district: null, // diisi enrichWilayah
    sequence: seq,
  };
}

// ── Nama kota/kecamatan via API wilayah (cache kecil, fallback ke kode) ──
const WILAYAH_BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";
const wilayahCache = new Map(); // key → { data, expires }
const WILAYAH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchWilayah(path) {
  const hit = wilayahCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.data;
  const res = await axios.get(`${WILAYAH_BASE}/${path}`, { timeout: 12000 });
  const data = Array.isArray(res.data) ? res.data : [];
  wilayahCache.set(path, { data, expires: Date.now() + WILAYAH_TTL_MS });
  if (wilayahCache.size > 50) {
    const firstKey = wilayahCache.keys().next().value;
    wilayahCache.delete(firstKey);
  }
  return data;
}

/** Lengkapi nama kota & kecamatan. Tak pernah melempar — gagal = tampil kode. */
export async function enrichWilayah(parsed) {
  if (!parsed?.valid) return parsed;
  try {
    const cities = await fetchWilayah(`regencies/${parsed.provinceCode}.json`);
    const city = cities.find((c) => String(c.id) === parsed.cityCode);
    parsed.city = city ? neat(city.name) : parsed.cityCode;
  } catch {
    parsed.city = parsed.cityCode;
  }
  try {
    const districts = await fetchWilayah(`districts/${parsed.cityCode}.json`);
    // ID kecamatan 7 digit, NIK memakai 6 digit awal (tidak selalu cocok 1:1)
    const dist = districts.find((d) => String(d.id).startsWith(parsed.districtCode));
    parsed.district = dist ? neat(dist.name) : parsed.districtCode;
  } catch {
    parsed.district = parsed.districtCode;
  }
  return parsed;
}

export function formatNikInfo(p) {
  let text = `*Info NIK*\n`;
  text += `NIK: ${p.nik}\n`;
  text += `Format: ${p.formatted}\n`;
  text += `Jenis Kelamin: ${p.gender}\n`;
  text += `Tanggal Lahir: ${p.birthStr} (${p.dayName})\n`;
  text += `Umur: ${p.age} Tahun\n`;
  text += `Zodiak: ${p.zodiac}\n`;
  text += `Generasi: ${p.generation}\n`;
  text += `Provinsi: ${p.province}\n`;
  text += `Kota/Kab: ${p.city || p.cityCode}\n`;
  text += `Kecamatan: ${p.district || p.districtCode}\n`;
  text += `No Urut: ${p.sequence}`;
  return text;
}

/** Satu panggilan untuk plugin: parse + enrich (fallback lokal bila offline). */
export async function getNikInfoText(nik) {
  const parsed = parseNik(nik);
  if (!parsed.valid) return null;
  await enrichWilayah(parsed);
  return formatNikInfo(parsed);
}
