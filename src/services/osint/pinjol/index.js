import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedLegal = null;
let cachedIllegal = null;

function loadData() {
  if (!cachedLegal) {
    try {
      const legalPath = path.join(__dirname, "legal.json");
      const raw = fs.readFileSync(legalPath, "utf-8");
      const parsed = JSON.parse(raw);
      cachedLegal = Array.isArray(parsed?.data) ? parsed.data : [];
    } catch (_) {
      cachedLegal = [];
    }
  }

  if (!cachedIllegal) {
    try {
      const illegalPath = path.join(__dirname, "illegal.txt");
      const raw = fs.readFileSync(illegalPath, "utf-8");
      cachedIllegal = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          // Format contoh: "1. Aku Rupiah dengan perusahaan developer Fnsudai Fintech Ltd"
          const clean = line.replace(/^[0-9]+[\.\)]\s*/, "");
          const parts = clean.split(/ dengan perusahaan developer /i);
          return {
            name: parts[0]?.trim() || clean,
            developer: parts[1]?.trim() || "Tidak Diketahui",
          };
        });
    } catch (_) {
      cachedIllegal = [];
    }
  }
}

/**
 * Mencari status pinjaman online berdasarkan nama aplikasi atau perusahaan
 * @param {string} query
 * @returns {object}
 */
export function checkPinjol(query) {
  loadData();
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return {
      success: false,
      message: "Nama pinjaman online atau aplikasi tidak boleh kosong.",
    };
  }

  // 1. Cek di daftar resmi OJK (Legal)
  const legalMatches = cachedLegal.filter((item) => {
    const platform = (item.platform_name || "").toLowerCase();
    const company = (item.company_name || "").toLowerCase();
    const sites = Array.isArray(item.website) ? item.website.join(" ").toLowerCase() : "";
    return platform.includes(q) || company.includes(q) || sites.includes(q);
  });

  // 2. Cek di daftar Ilegal / Satgas Waspada Investasi
  const illegalMatches = cachedIllegal.filter((item) => {
    const name = (item.name || "").toLowerCase();
    const dev = (item.developer || "").toLowerCase();
    return name.includes(q) || dev.includes(q);
  });

  return {
    success: true,
    query,
    totalLegalFound: legalMatches.length,
    totalIllegalFound: illegalMatches.length,
    isLegal: legalMatches.length > 0 && illegalMatches.length === 0,
    isIllegal: illegalMatches.length > 0,
    isWarning: legalMatches.length > 0 && illegalMatches.length > 0,
    legal: legalMatches.slice(0, 5),
    illegal: illegalMatches.slice(0, 5),
  };
}
