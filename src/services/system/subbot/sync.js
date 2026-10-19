import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { detectSubBotSessions, subBots } from "./store.js";
import { createSubBot } from "./manager.js";

export async function syncSubBotsDatabase() {
  let synced = 0;
  for (const session of detectSubBotSessions()) {
    const running = subBots.get(session.id);
    if (!session.valid && !running) {
      logger?.warn?.(`[SubBot Sync] Lewati +${session.number}: creds.json tidak valid/korup.`);
      continue;
    }
    try {
      const primaryJid = `${session.number}@s.whatsapp.net`;
      const botName = session.name || `SubBot (+${session.number})`;
      const jids = new Set([primaryJid]);
      const fullJid = session.meJid ? db.normalizeJid(session.meJid) : "";
      if (fullJid) jids.add(fullJid);

      for (const jid of jids) db.registerBotJid(jid);

      db.ensureSubStore(primaryJid, { botName });
      db.runWithBot(primaryJid, () => {
        db.updateUser(primaryJid, { name: botName, registered: true });
        for (const jid of jids) {
          if (jid !== primaryJid) db.updateUser(jid, { name: botName, registered: true });
        }
      });

      synced++;
      logger?.info?.(`[SubBot Sync] +${session.number} tersinkron (database terisolasi).`);
    } catch (err) {
      logger?.error?.(`[SubBot Sync] Gagal menyinkronkan +${session.number}: ${err.message}`);
    }
  }
  return synced;
}

export async function autoRestoreSubBots() {
  try {
    await syncSubBotsDatabase();
    let restored = 0;
    for (const session of detectSubBotSessions()) {
      if (!session.registered) {
        logger?.warn?.(`[SubBot Restore] Lewati +${session.number}: sesi belum terdaftar/tidak valid.`);
        continue;
      }
      if (subBots.has(session.id)) continue;
      logger?.info?.(`[SubBot Restore] Memulihkan sesi +${session.number}...`);
      createSubBot(session.number).catch((err) => {
        logger?.error?.(`[SubBot Restore] Gagal memulihkan +${session.number}: ${err.message}`);
      });
      restored++;
    }
    if (restored > 0) logger?.info?.(`[SubBot Restore] ${restored} sesi sub-bot dipulihkan otomatis.`);
  } catch (err) {
    logger?.error?.("[Auto Restore SubBots Error]", err.message);
  }
}
