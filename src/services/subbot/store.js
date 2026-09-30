import path from "path";
import fs from "fs";

export const subBots = new Map(); // id -> { sock, number, status, startedAt }
export const baseSessionsDir = path.join(process.cwd(), "assets", "sessions", "sub_bots");

if (!fs.existsSync(baseSessionsDir)) {
  fs.mkdirSync(baseSessionsDir, { recursive: true });
}

/**
 * Check if a socket instance belongs to a sub-bot
 */
export function isSubBotSocket(sock) {
  if (!sock) return false;
  if (sock.isSubBot) return true;
  for (const entry of subBots.values()) {
    if (entry.sock === sock) return true;
  }
  return false;
}

/**
 * Check if a phone number or JID is an active/configured sub-bot
 */
export function isSubBotNumber(jidOrPhone) {
  if (!jidOrPhone) return false;
  const digits = String(jidOrPhone).replace(/[^0-9]/g, "");
  if (!digits) return false;
  const botId = `sub_${digits}`;
  if (subBots.has(botId)) return true;
  const sessionDir = path.join(baseSessionsDir, botId);
  if (fs.existsSync(sessionDir)) return true;
  return false;
}

/**
 * Get all active sub bots
 */
export function getSubBotsList() {
  const list = [];
  for (const [id, entry] of subBots.entries()) {
    list.push({
      id,
      number: entry.number,
      status: entry.status,
      uptime: Math.floor((Date.now() - entry.startedAt) / 1000),
    });
  }
  return list;
}
