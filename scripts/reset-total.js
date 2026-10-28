import fs from "fs";
import path from "path";
import readline from "readline";

const ROOT = process.cwd();

// Daftar folder & file data/cache/sesi yang perlu dibersihkan saat total reset
const TARGETS_TO_CLEAR = [
  "assets/sessions",          // Sesi login WhatsApp (primary bot & subbots)
  "database/db.json",         // Cache & database utama
  "database/users.json",      // Database users
  "database/settings.json",   // Settings tersimpan di database
  "database/lidmap.json",     // Pemetaan LID WhatsApp
  "statuses",                 // Folder unduhan status WhatsApp
  "logs",                     // Log PM2 / log sistem
  "tmp",                      // File temporary
  ".cache",                   // Cache
];

function deleteTarget(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return;

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  [CLEANED DIR]  ${relPath}`);
    } else {
      fs.unlinkSync(fullPath);
      console.log(`  [CLEANED FILE] ${relPath}`);
    }
  } catch (err) {
    console.error(`  [FAILED] ${relPath}: ${err.message}`);
  }
}

async function run() {
  console.log("\n==================================================");
  console.log("       RIZZERBOT TOTAL RESET UTILITY");
  console.log("==================================================");
  console.log("Perhatian: Tindakan ini akan menghapus seluruh sesi,");
  console.log("database lama, log, dan cache secara BERSIH.");
  console.log("File konfigurasi '.env' akan TETAP AMAN.\n");

  const isForce = process.argv.includes("--force") || process.argv.includes("-y");

  if (!isForce) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question("Ketik 'yes' untuk melanjutkan reset total: ", (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase());
      });
    });

    if (answer !== "yes" && answer !== "y") {
      console.log("Reset dibatalkan.\n");
      process.exit(0);
    }
  }

  console.log("\nMembersihkan data...");
  for (const target of TARGETS_TO_CLEAR) {
    deleteTarget(target);
  }

  // Buat kembali folder esensial dalam keadaan kosong
  const ESSENTIAL_DIRS = ["assets/sessions/primary_bot", "logs", "tmp", "statuses"];
  for (const dir of ESSENTIAL_DIRS) {
    const p = path.join(ROOT, dir);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }

  console.log("\n✅ RESET TOTAL SELESAI!");
  console.log("Semua sesi WhatsApp, cache, dan data lama sudah bersih 100%.");
  console.log("File '.env' Anda tetap aman & utuh.");
  console.log("\nSilakan mulai ulang bot:");
  console.log("  node index.js   ATAU   npm run pm2:restart\n");
}

run();
