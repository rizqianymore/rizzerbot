import { PLAT_WILAYAH, CD_COUNTRY, ZZ_MAP } from "./data.js";

export function getJenisKendaraan(angka, kodeDepan) {
  const n = Number(angka);
  if (!Number.isFinite(n) || n < 1 || n > 9999) return "-";
  if (kodeDepan === "B") {
    if (n >= 1 && n <= 2999) return "Mobil pribadi";
    if (n >= 3000 && n <= 6999) return "Sepeda motor";
    if (n >= 7000 && n <= 7999) return "Bus / travel / angkutan (sebagian mobil pribadi B)";
    if (n >= 8000 && n <= 8999) return "Mobil barang / pikap (aturan Metro Jaya)";
    if (n >= 9000 && n <= 9999) return "Truk / pikap";
    return "-";
  }
  if (n >= 1 && n <= 1999) return "Mobil pribadi";
  if (n >= 2000 && n <= 6999) return "Sepeda motor";
  if (n >= 7000 && n <= 7999) return "Bus / travel / angkutan umum";
  return "Truk / pikap / mobil barang";
}

function normalizeInput(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

export function parsePlat(rawInput) {
  const raw = String(rawInput || "").trim();
  if (!raw) return { valid: false, reason: "input kosong" };
  const norm = normalizeInput(raw);

  let m = norm.match(/^(CD|CC)\s*(\d{1,3})(?:\s*P)?\s*(\d{1,4})$/);
  if (m) {
    let korps = m[1];
    let negaraStr = m[2];
    let regStr = m[3];

    if (!/\s/.test(raw.trim()) && !raw.toUpperCase().includes("P")) {
      const digits = `${negaraStr}${regStr}`;
      let fixed = null;
      for (const len of [2, 3, 1]) {
        if (digits.length - len < 1 || digits.length - len > 4) continue;
        const c = digits.slice(0, len);
        if (CD_COUNTRY[Number(c)]) {
          fixed = [c, digits.slice(len)];
          break;
        }
      }
      if (fixed) {
        negaraStr = fixed[0];
        regStr = fixed[1];
      }
    }
    const jenisKorps = korps === "CD" ? "Korps Diplomatik (Corps Diplomatique)" : "Korps Konsuler (Corps Consulaire)";
    const kodeNegara = Number(negaraStr);
    return {
      valid: true,
      kind: "diplomatik",
      formatted: `${korps} ${negaraStr} ${regStr}`,
      kode: korps,
      angka: regStr,
      suffix: "",
      provinsi: "Jakarta (Kemlu)",
      wilayah: jenisKorps,
      areas: ["Kendaraan dinas/pribadi perwakilan asing di Indonesia"],
      jenis: "Kendaraan korps diplomatik/konsuler",
      negara: CD_COUNTRY[kodeNegara] || `Kode negara ${kodeNegara}`,
      khusus: jenisKorps,
      note: "Pelat merah/hitam khusus; STNK via rekomendasi Kemlu. Bukan plat wilayah sipil.",
    };
  }

  m = norm.match(/^(\d{1,6})\s*([IVXL]{1,5}|\d{1,2}|AD|AL|AU|PM|POLRI|TNI)?$/);
  if (m && norm.match(/^\d/)) {

    const tail = (m[2] || "").trim();
    const looksMil = /^(I{1,3}V?|V|IV|VI{0,3}|IX|X|AD|AL|AU|PM)$/.test(tail) || /TNI|POLRI/.test(norm);
    if (looksMil || /^\d{4,6}(\s|$)/.test(norm)) {
      return {
        valid: true,
        kind: "tni-polri",
        formatted: raw.toUpperCase().trim(),
        kode: "TNI/POLRI",
        angka: m[1],
        suffix: tail,
        provinsi: "-",
        wilayah: "TNI / Polri (nomor dinas militer/kepolisian)",
        areas: ["AD = Angkatan Darat", "AL = Angkatan Laut", "AU = Angkatan Udara", "Polri = Kepolisian"],
        jenis: "Kendaraan dinas TNI/Polri",
        khusus: "Plat dinas militer/kepolisian (kuning/hijau/merah sesuai matra)",
        note: "Format TNI/Polri tidak memakai kode wilayah sipil. Cek fisik: logo matra + warna dasar khusus.",
      };
    }
  }

  m = norm.match(/^([A-Z]{1,2})\s*(\d{1,4})\s*([A-Z]{1,3})?$/);
  if (!m) {
    return { valid: false, reason: "format salah. Contoh: B 1234 ABC / AD 1234 AB / BK 5678 AA" };
  }
  const kode = m[1];
  const angkaStr = m[2];
  const suffix = m[3] || "";
  const angka = Number(angkaStr);

  const info = PLAT_WILAYAH[kode];
  if (!info) return { valid: false, reason: `kode wilayah ${kode} tidak dikenal` };
  if (angka < 1 || angka > 9999) return { valid: false, reason: "angka harus 1-9999" };
  if (suffix && !/^[A-Z]{1,3}$/.test(suffix)) return { valid: false, reason: "huruf belakang harus 1-3 huruf A-Z" };

  let khusus = null;
  if (/^ZZ[A-Z]$/.test(suffix)) {
    khusus = ZZ_MAP[suffix] || "Dinas pejabat negara (pengganti RF, sistem ZZ)";
  } else if (/^RF[A-Z]$/.test(suffix) || suffix === "RFS" || suffix === "RF") {
    khusus = "Dinas pejabat/instansi (seri RF lama, sudah diganti sistem ZZ)";
  }

  const jenis = getJenisKendaraan(angka, kode);
  const formatted = suffix ? `${kode} ${angkaStr} ${suffix}` : `${kode} ${angkaStr}`;

  return {
    valid: true,
    kind: khusus ? "khusus" : "sipil",
    formatted,
    kode,
    angka: angkaStr,
    suffix,
    provinsi: info.provinsi,
    wilayah: info.wilayah,
    areas: info.areas,
    jenis,
    khusus,
    note: khusus
      ? "Plat khusus dinas — prioritas & aturan parkir/akses berbeda dari plat sipil biasa."
      : "Perkiraan golongan dari rentang angka TNKB (bukan data Samsat live).",
  };
}
