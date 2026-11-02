import fs from "fs";
import { db } from "@/src/core/database.js";

export function cleanNumber(input) {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "");
}

export function formatToWhatsAppJid(input) {
  if (!input) return "";
  let clean = cleanNumber(input);
  if (!clean) return "";
  if (clean.startsWith("08")) {
    clean = "628" + clean.slice(2);
  } else if (clean.startsWith("8") && clean.length >= 9) {
    clean = "62" + clean;
  }
  return clean.length >= 7 ? `${clean}@s.whatsapp.net` : "";
}

export function samePhoneJid(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const da = String(a).split("@")[0].split(":")[0].replace(/\D/g, "");
  const dbb = String(b).split("@")[0].split(":")[0].replace(/\D/g, "");
  return Boolean(da && dbb && da === dbb);
}

export function findGroupParticipant(meta, jid) {
  const parts = meta?.participants || [];
  for (const p of parts) {
    if (!p) continue;
    const cands = typeof p === "string" ? [p] : [p.id, p.phoneNumber, p.lid];
    for (const c of cands) {
      try {
        if (c && db.sameUser(c, jid)) return p;
      } catch (_) {}
    }
  }
  return null;
}

export function parsePhoneNumbers(args) {
  if (!args) return [];
  const list = Array.isArray(args) ? args.join(" ") : String(args);
  const rawTokens = list.split(/[\s,;|]+/).filter(Boolean);
  const results = new Set();

  for (const token of rawTokens) {
    if (token.includes("@g.us")) continue;
    const jid = formatToWhatsAppJid(token);
    if (jid) results.add(jid);
  }
  return Array.from(results);
}

export function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (_) {}
  }
}

export function getUptimeString() {
  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  let s = "";
  if (hours > 0) s += `${hours}j `;
  if (minutes > 0 || hours > 0) s += `${minutes}m `;
  s += `${seconds}s`;
  return s.trim();
}
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function randomDelay(min, max) {
  return sleep(Math.floor(min + Math.random() * (max - min)));
}
const GROUP_META_TTL_MS = 30_000;
const _groupMetaStore = new Map();
export async function getCachedGroupMeta(sock, jid) {
  const now = Date.now();
  const sockId = sock?.user?.id || sock?.user?.lid || "default";
  const cacheKey = `${sockId}::${jid}`;
  const entry = _groupMetaStore.get(cacheKey);

  if (entry && now < entry.expireAt) {
    return entry.data;
  }

  try {
    const meta = await sock.groupMetadata(jid);

    try {
      db.learnGroupLidMap(meta);
    } catch (_) {}
    _groupMetaStore.set(cacheKey, { data: meta, expireAt: now + GROUP_META_TTL_MS });
    return meta;
  } catch (_) {
    return null;
  }
}
export function invalidateGroupMeta(jid, sock) {
  if (sock) {
    const sockId = sock?.user?.id || sock?.user?.lid || "default";
    _groupMetaStore.delete(`${sockId}::${jid}`);
    return;
  }
  for (const key of [..._groupMetaStore.keys()]) {
    if (key === jid || key.endsWith(`::${jid}`)) _groupMetaStore.delete(key);
  }
}

export const broadcastLock = new Map();

export function isValidUrl(s) {
  try {
    const u = new URL(String(s || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (_) {
    return false;
  }
}

export function sanitizeFilename(name, maxLen = 80) {
  const base = String(name || "file").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, maxLen);
  return base || "file";
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function parseDuration(str) {
  const s = String(str || "").trim().toLowerCase();
  const m = s.match(/^(\d+)\s*([smhd])$/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = m[2] === "s" ? 1000 : m[2] === "m" ? 60000 : m[2] === "h" ? 3600000 : 86400000;
  return n * mult;
}

export function getRandomElement(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
