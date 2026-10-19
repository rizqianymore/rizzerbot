import path from "path";
import fs from "fs";

export const subBots = new Map();
export const baseSessionsDir = path.join(process.cwd(), "assets", "sessions", "sub_bots");

if (!fs.existsSync(baseSessionsDir)) {
  fs.mkdirSync(baseSessionsDir, { recursive: true });
}

export function subBotDigits(folderName) {
  const name = String(folderName || "");
  if (!name.startsWith("sub_")) return "";
  return name.slice(4).replace(/[^0-9]/g, "");
}

function readSessionCreds(sessionDir) {
  const credsPath = path.join(sessionDir, "creds.json");
  if (!fs.existsSync(credsPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    if (!parsed || typeof parsed !== "object" || !parsed.noiseKey) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function detectSubBotSessions() {
  const sessions = [];
  try {
    if (!fs.existsSync(baseSessionsDir)) return sessions;
    for (const entry of fs.readdirSync(baseSessionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const number = subBotDigits(entry.name);
      if (!number) continue;
      const dir = path.join(baseSessionsDir, entry.name);
      const creds = readSessionCreds(dir);
      sessions.push({
        id: `sub_${number}`,
        number,
        dir,
        valid: Boolean(creds),
        registered: Boolean(creds?.registered),
        name: typeof creds?.me?.name === "string" ? creds.me.name : "",
        meJid: typeof creds?.me?.id === "string" ? creds.me.id : "",
      });
    }
  } catch (_) {}
  sessions.sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
  return sessions;
}

export function getAllSubBotNumbers() {
  const numbers = new Set();
  for (const session of detectSubBotSessions()) {
    if (session.valid) numbers.add(session.number);
  }
  for (const entry of subBots.values()) {
    const digits = String(entry?.number || "").replace(/[^0-9]/g, "");
    if (digits) numbers.add(digits);
  }
  return [...numbers];
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
  if (subBots.has(`sub_${digits}`)) return true;
  return fs.existsSync(path.join(baseSessionsDir, `sub_${digits}`));
}

export function getSubBotsList() {
  const list = [];
  for (const [id, entry] of subBots.entries()) {
    const startedAt = Number(entry.startedAt) || Date.now();
    list.push({
      id,
      number: entry.number,
      status: entry.status,
      uptime: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    });
  }
  return list;
}
