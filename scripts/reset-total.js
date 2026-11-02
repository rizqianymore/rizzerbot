import fs from "fs";
import path from "path";
import readline from "readline";

const ROOT = process.cwd();

const TARGETS_TO_CLEAR = [
  "assets/sessions",
  "database/db.json",
  "database/users.json",
  "database/settings.json",
  "database/lidmap.json",
  "statuses",
  "logs",
  "tmp",
  ".cache",
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
