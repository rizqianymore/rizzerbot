import path from "path";
import fs from "fs";

export const subBots = new Map();
export const baseSessionsDir = path.join(process.cwd(), "assets", "sessions", "sub_bots");

if (!fs.existsSync(baseSessionsDir)) {
  fs.mkdirSync(baseSessionsDir, { recursive: true });
}

export function isSubBotSocket(sock) {
  if (!sock) return false;
  if (sock.isSubBot) return true;
  for (const entry of subBots.values()) {
    if (entry.sock === sock) return true;
  }
  return false;
}

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
