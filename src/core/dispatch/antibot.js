import { db } from "@/src/core/database.js";
import { looksLikeExternalBot } from "./message.js";

export function checkAntiBot(sock, msg, logger, { isFromMe, normalizedRawSender, messageContent }) {
  const _g = db.getSettings();
  if (!isFromMe && _g.antiBotLuar !== false) {
    if (db.isExternalBotJid(normalizedRawSender)) {
      logger?.warn?.(`[Anti-Bot] Abaikan perintah dari bot luar: ${normalizedRawSender}`);
      return true;
    }

    if (!db.isOwner(normalizedRawSender) && !db.isAdmin(normalizedRawSender) && looksLikeExternalBot(msg, messageContent) && messageContent.startsWith(_g.prefix || ".")) {
      logger?.warn?.(`[Anti-Bot] Heuristik bot luar cocok: ${normalizedRawSender} (${msg.pushName})`);
      return true;
    }
  }
  return false;
}
