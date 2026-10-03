// plugins/owner/resetdb.js — perintah "resetdb" (SuperOwner saja).
// Mereset database utama (users, transaksi, sewa, chat log, audit) TANPA
// mengganggu sub-bot yang aktif: database/subbots/* dan seluruh sesi login
// (assets/sessions/*) TIDAK disentuh. Setting bot (owner, prefix, dsb)
// dipertahankan. Wajib konfirmasi 2 tahap + restart otomatis agar memori bersih.
import fs from "fs";
import path from "path";
import { db } from "@/src/core/database.js";

const DB_DIR = path.join(process.cwd(), "database");
const SUBBOTS_DIR = path.join(DB_DIR, "subbots");
const BACKUPS_DIR = path.join(DB_DIR, "backups");
const CHATLOGS_DIR = path.join(DB_DIR, "chat_logs");

function countSubbotDbs() {
  try {
    if (!fs.existsSync(SUBBOTS_DIR)) return 0;
    return fs.readdirSync(SUBBOTS_DIR).filter((e) => /[0-9]/.test(e)).length;
  } catch (_) {
    return 0;
  }
}

function rmIfExists(p) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    return true;
  } catch (_) {
    return false;
  }
}

function clearDirKeepFolder(dir) {
  let removed = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      try {
        fs.rmSync(full, { recursive: true, force: true });
        removed++;
      } catch (_) {}
    }
  } catch (_) {}
  return removed;
}

export default {
  "name": "resetdb",
  "aliases": ["resetdatabase", "deletedb", "dbreset"],
  "description": "Reset database utama (kecuali sub-bot aktif & sesi login)",
  "usage": "[confirm]",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] resetdb oleh ${senderJid} args=${args.join(" ")}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Reset database hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }

      const subCount = countSubbotDbs();
      const keyword = String(args[0] || "").toLowerCase();
      if (keyword !== "confirm" && keyword !== "ya" && keyword !== "yes") {
        return reply(
          `⚠️ *RESET DATABASE UTAMA*\n\n` +
          `Perintah ini akan MENGHAPUS:\n` +
          `• Seluruh data user (owner tambahan, admin, premium, banned)\n` +
          `• Riwayat transaksi & data sewa grup\n` +
          `• Chat log & audit hak akses\n` +
          `• Peta LID→HP (dipelajari ulang otomatis)\n\n` +
          `Yang AMAN (tidak disentuh):\n` +
          `• ✅ ${subCount} database sub-bot aktif\n` +
          `• ✅ Seluruh sesi login (bot tetap online)\n` +
          `• ✅ Setting bot (owner utama, prefix, mode)\n` +
          `• ✅ File backup di database/backups/\n\n` +
          `Bot akan restart otomatis setelah reset.\n\n` +
          `_Ketik *.resetdb confirm* untuk lanjut._`
        );
      }

      await sendTyping();
      await reply("🗑️ Mereset database utama... (sub-bot & sesi aman)");

      const wiped = [];
      const failed = [];
      const push = (label, file) => {
        if (rmIfExists(file)) wiped.push(label);
        else failed.push(label);
      };

      try {
        // 1. Users + database utama (ditulis ulang fresh, setting dipertahankan).
        //    Hapus file dulu agar Store me-load skeleton bersih saat restart.
        push("users.json", path.join(DB_DIR, "users.json"));
        push("database.json", path.join(DB_DIR, "database.json"));
        push("transactions.json", path.join(DB_DIR, "transactions.json"));
        push("rentals.json", path.join(DB_DIR, "rentals.json"));

        // 2. Chat log & audit lama dibersihkan (audit baru dicatat di bawah).
        const logs = clearDirKeepFolder(CHATLOGS_DIR);
        wiped.push(`chat_logs (${logs} file)`);

        // 3. Tulis ulang audit fresh berisi jejak reset ini (akuntabilitas).
        try {
          fs.writeFileSync(
            path.join(DB_DIR, "privilege-audit.json"),
            JSON.stringify([{
              at: new Date().toISOString(),
              store: "main",
              action: "resetdb",
              target: senderJid || "",
              enabled: true,
            }], null, 2),
            "utf8"
          );
          wiped.push("privilege-audit.json (direset + jejak)");
        } catch (_) {
          failed.push("privilege-audit.json");
        }

        // 4. Pengaman: database sub-bot & sesi WAJIB masih ada sesudah wipe.
        const subAfter = countSubbotDbs();
        if (subAfter !== subCount) {
          logger?.error?.(`[resetdb] KETIDAKCOCOKAN sub-bot: sebelum=${subCount} sesudah=${subAfter}`);
        }

        logger?.warn?.(`[OwnerCmd] resetdb DIEKSEKUSI oleh ${senderJid}: hapus=[${wiped.join(", ")}] gagal=[${failed.join(", ") || "tidak ada"}] subbot_aman=${subAfter}`);
        await reply(
          `✅ *Reset Database Selesai!*\n\n` +
          `🧹 Dihapus: ${wiped.join(", ")}\n` +
          (failed.length ? `⚠️ Gagal: ${failed.join(", ")}\n` : ``) +
          `🤖 Sub-bot aman: ${subAfter} database tidak disentuh\n` +
          `🔄 Bot restart dalam 3 detik untuk memuat database bersih...`
        );
      } catch (err) {
        logger?.error?.(`[resetdb] gagal: ${err.message}`);
        return reply(`❌ Reset gagal: ${err.message}\nDatabase sub-bot & sesi tidak disentuh.`);
      }

      setTimeout(async () => {
        try {
          const { flushAllStores } = await import("@/src/core/database.js");
          flushAllStores();
        } catch (_) {}
        process.exit(0);
      }, 3000);
    },
};
