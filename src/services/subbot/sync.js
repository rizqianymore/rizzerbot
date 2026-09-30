import path from "path";
import fs from "fs";
import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { baseSessionsDir } from "./store.js";
import { createSubBot } from "./manager.js";

/**
 * Auto update & sync database for all existing sub-bots on the server
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

        // Update database: daftarkan JID, tapi JANGAN timpa setting mandiri
        // (public/prefix/owner) yang sudah diatur owner sub via DM.
        for (const jid of jidsToSync) {
          db.registerBotJid(jid);
          const hasConfig = Boolean(db.data?.botSettings?.[db.normalizeJid(jid)]);
          if (!hasConfig) {
            db.updateBotSettings(jid, {
              botName,
              ownerNumber: `${number}@s.whatsapp.net`,
              ownerNumbers: [],
            });
          } else if (botName && botName !== `SubBot (+${number})`) {
            // Hanya refresh nama, setting self/public/prefix dibiarkan apa adanya
            db.updateBotSettings(jid, { botName });
          }
          db.updateUser(jid, {
            name: botName,
            registered: true,
          });
        }

        updatedCount++;
        logger?.info?.(`[SubBot Database Sync] Berhasil memperbarui data sub-bot: +${number} (Settings & Register Terpisah)`);
      }
    }

    if (updatedCount > 0) {
      db.save();
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
