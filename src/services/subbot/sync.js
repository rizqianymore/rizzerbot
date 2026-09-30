import path from "path";
import fs from "fs";
import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { baseSessionsDir } from "./store.js";
import { createSubBot } from "./manager.js";

/**
 * Daftarkan seluruh sub-bot yang ada di server + pastikan tiap sub
 * punya database SENDIRI. Tidak pernah menimpa setting mandiri.
 */
export async function syncSubBotsDatabase() {
  let updatedCount = 0;
  try {
    if (!fs.existsSync(baseSessionsDir)) return 0;
    const folders = fs.readdirSync(baseSessionsDir);

    for (const folder of folders) {
      if (folder.startsWith("sub_")) {
        const number = folder.replace("sub_", "").replace(/[^0-9]/g, "");
        if (!number) continue;

        const sessionDir = path.join(baseSessionsDir, folder);
        const credsPath = path.join(sessionDir, "creds.json");
        let botName = `SubBot (+${number})`;
        const jidsToSync = new Set([`${number}@s.whatsapp.net`]);

        if (fs.existsSync(credsPath)) {
          try {
            const raw = fs.readFileSync(credsPath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed?.me?.id) {
              const fullJid = db.normalizeJid(parsed.me.id);
              if (fullJid) jidsToSync.add(fullJid);
            }
            if (parsed?.me?.name) {
              botName = parsed.me.name;
            }
          } catch (_) {}
        }

        for (const jid of jidsToSync) {
          db.registerBotJid(jid);
        }
        // Satu database per nomor: seed sekali, setting mandiri tidak disentuh.
        const primaryJid = `${number}@s.whatsapp.net`;
        db.ensureSubStore(primaryJid, { botName });
        db.runWithBot(primaryJid, () => {
          db.updateUser(primaryJid, { name: botName, registered: true });
          for (const jid of jidsToSync) {
            if (jid !== primaryJid) db.updateUser(jid, { name: botName, registered: true });
          }
        });

        updatedCount++;
        logger?.info?.(`[SubBot Database Sync] Sub-bot +${number} terdaftar dengan database sendiri (terisolasi)`);
      }
    }
  } catch (err) {
    logger?.error?.("[SubBot Database Sync Error]:", err.message);
  }
  return updatedCount;
}

/**
 * Auto restore existing saved sub bot sessions on startup
 */
export async function autoRestoreSubBots() {
  try {
    // 1. Sinkronkan dan perbarui database terlebih dahulu agar database tidak old
    await syncSubBotsDatabase();

    if (!fs.existsSync(baseSessionsDir)) return;
    const folders = fs.readdirSync(baseSessionsDir);
    for (const folder of folders) {
      if (folder.startsWith("sub_")) {
        const number = folder.replace("sub_", "");
        logger.info(`[SubBot] Restoring saved sub bot session for ${number}...`);
        createSubBot(number).catch((err) => {
          logger.error(`[SubBot Restore Error] ${number}:`, err.message);
        });
      }
    }
  } catch (err) {
    logger.error("[Auto Restore SubBots Error]", err.message);
  }
}
