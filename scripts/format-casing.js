import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsDir = path.join(__dirname, "..", "plugins");

// Daftar singkatan teknis/resmi yang boleh tetap huruf besar
const PRESERVED_ACRONYMS = new Set([
  "ID",
  "IP",
  "DNS",
  "URL",
  "WA",
  "DB",
  "RAM",
  "CPU",
  "VPS",
  "PID",
  "RSS",
  "AI",
  "JKT48",
  "NIS",
  "NISN",
  "OVO",
  "QR",
  "HD",
  "TTL",
  "SSL",
  "API",
  "OSINT",
  "CCTV",
  "ETLE",
  "SCBD",
  "DPR",
  "PKL",
  "NPSN",
  "MP3",
  "MP4",
  "GIF",
  "PNG",
  "JPG",
  "JPEG",
  "WEBP",
  "JSON",
  "PDF",
  "DMCA",
]);

// Helper untuk mengubah string kalimat/frasa ALL-CAPS menjadi Title Case / Sentence Case presisi
export function formatToCleanTitleCase(text) {
  if (!text) return "";
  return text.replace(/\b[A-Za-z0-9_-]+\b/g, (word) => {
    const upperWord = word.toUpperCase();
    if (PRESERVED_ACRONYMS.has(upperWord)) {
      return upperWord;
    }
    // Jika kata berisi kombinasi huruf & angka seperti JKT48
    if (PRESERVED_ACRONYMS.has(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function getJsFilesRecursive(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getJsFilesRecursive(fullPath));
    } else if (item.isFile() && item.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

export function autoCleanAllPluginCasing(targetDir = pluginsDir) {
  const files = getJsFilesRecursive(targetDir);
  let totalModifications = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    let original = content;

    // 1. Regex mendeteksi bold header ALL CAPS: *TEXT WITH 2+ WORDS IN CAPS*
    // Contoh: *MANAJEMEN PENGGUNA* -> *Manajemen Pengguna*
    content = content.replace(/\*([A-Z0-9\s/:\-—–\(\)&]+)\*/g, (match, inner) => {
      const trimmed = inner.trim();
      // Jangan ubah jika hanya 1 kata pendek atau jika hanya simbol/akronim
      if (!trimmed || trimmed.length < 3) return match;
      if (PRESERVED_ACRONYMS.has(trimmed)) return match;
      if (/^[0-9]+$/.test(trimmed)) return match;

      // Jika mengandung minimal 1 huruf kapital dan bukan camelCase
      if (/[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
        const formatted = formatToCleanTitleCase(trimmed);
        return `*${formatted}*`;
      }
      return match;
    });

    // 2. Normalisasi status tag seperti [KICKED - ANTILINK] -> [Kicked - Anti-Link]
    content = content.replace(/\[([A-Z0-9\s/:\-—–\(\)&]+)\]/g, (match, inner) => {
      const trimmed = inner.trim();
      if (!trimmed || trimmed.length < 3) return match;
      if (PRESERVED_ACRONYMS.has(trimmed)) return match;
      if (trimmed === trimmed.toUpperCase()) {
        const formatted = formatToCleanTitleCase(trimmed);
        return `[${formatted}]`;
      }
      return match;
    });

    if (content !== original) {
      fs.writeFileSync(file, content, "utf8");
      console.log(`✨ Formatted: ${path.relative(process.cwd(), file)}`);
      totalModifications++;
    }
  }

  console.log(`\n🎉 Selesai! Berhasil meng-auto-format ${totalModifications} file plugin.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  autoCleanAllPluginCasing();
}
