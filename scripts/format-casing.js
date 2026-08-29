import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsDir = path.join(__dirname, "..", "plugins");

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

function toTitleCase(str) {
  return str.replace(/\b[A-Za-z0-9]+/g, (txt) => {
    // Kecualikan akronim tertentu jika diinginkan
    if (["ID", "IP", "DNS", "URL", "WA", "DB", "RAM", "CPU", "VPS", "PID", "RSS", "AI", "JKT48", "NIS", "NISN", "OVO", "QR", "HD"].includes(txt)) {
      return txt;
    }
    return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
  });
}

// Replacement pairs for uppercase text phrases inside markdown bold (*TEXT*)
const knownPhrases = [
  ["*PHOTOBOOTH RESULT*", "*Photobooth Result*"],
  ["*MANAJEMEN ADMIN BOT (ENTERPRISE)*", "*Manajemen Admin Bot (Enterprise)*"],
  ["*HASIL KONVERSI TEKS*", "*Hasil Konversi Teks*"],
  ["*PROFIL RESMI MEMBER JKT48*", "*Profil Resmi Member JKT48*"],
  ["*SPOTIFY TRACK DOWNLOADER*", "*Spotify Track Downloader*"],
  ["*EVAL EXECUTION OUTPUT*", "*Eval Execution Output*"],
  ["*EVAL ERROR*", "*Eval Error*"],
  ["*TAG ALL MEMBERS*", "*Tag All Members*"],
  ["*LINK UNDANGAN GRUP*", "*Link Undangan Grup*"],
  ["*PLUGIN RUNTIME CONTROLLER*", "*Plugin Runtime Controller*"],
  ["*DASHBOARD OPERASIONAL BOT*", "*Dashboard Operasional Bot*"],
  ["*MANAJEMEN PENGGUNA (ENTERPRISE)*", "*Manajemen Pengguna (Enterprise)*"],
  ["*MANAJEMEN PENGGUNA PREMIUM (ENTERPRISE)*", "*Manajemen Pengguna Premium (Enterprise)*"],
  ["*MANAJEMEN MULTI-BOT (SUB-BOT)*", "*Manajemen Multi-Bot (Sub-Bot)*"],
  ["*PAIRING CODE SUB-BOT BARU*", "*Pairing Code Sub-Bot Baru*"],
  ["*HASIL PENCARIAN CCTV*", "*Hasil Pencarian CCTV*"],
  ["*LAPORAN STATUS KONEKTIVITAS CCTV*", "*Laporan Status Konektivitas CCTV*"],
  ["*DETAIL KAMERA CCTV*", "*Detail Kamera CCTV*"],
  ["*CCTV NX WITNESS MONITORING*", "*CCTV NX Witness Monitoring*"],
  ["*LIVE (AKTIF)*", "*Live (Aktif)*"],
  ["*OFFLINE / GAGAL*", "*Offline / Gagal*"],
  ["*TERBUKA*", "*Terbuka*"],
  ["*DITUTUP*", "*Ditutup*"],
  ["*AKTIF (Self Only)*", "*Aktif (Self Only)*"],
  ["*AKTIF (Maintenance)*", "*Aktif (Maintenance)*"],
  ["*AKTIF (Grup Saja)*", "*Aktif (Grup Saja)*"],
  ["*AKTIF (Private Saja)*", "*Aktif (Private Saja)*"],
  ["*AKTIF (Proteksi Nyala)*", "*Aktif (Proteksi Nyala)*"],
  ["*KICKED - ANTILINK*", "*Kicked - Anti-Link*"],
  ["*PERINGATAN ANTILINK*", "*Peringatan Anti-Link*"],
  ["*DAFTAR PENGGUNA PREMIUM*", "*Daftar Pengguna Premium*"],
  ["*DAFTAR ADMIN BOT*", "*Daftar Admin Bot*"],
  ["*DAFTAR PENGGUNA LIMITED*", "*Daftar Pengguna Limited*"],
  ["*DAFTAR PLUGIN YANG DINONAKTIFKAN*", "*Daftar Plugin yang Dinonaktifkan*"],
  ["*VPS & SERVER TELEMETRY REPORT*", "*VPS & Server Telemetry Report*"],
];

const files = getJsFilesRecursive(pluginsDir);
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  for (const [target, replacement] of knownPhrases) {
    if (content.includes(target)) {
      content = content.replaceAll(target, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(file, content, "utf8");
    console.log(`✓ Updated casing: ${path.relative(process.cwd(), file)}`);
    changedCount++;
  }
}

console.log(`\nSelesai! Berhasil merapikan ${changedCount} file plugin.`);
