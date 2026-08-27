import fs from "fs";

export function cleanNumber(input) {
  if (!input) return "";
  return String(input).replace(/[^0-9]/g, "");
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
  const entry = _groupMetaStore.get(jid);

  if (entry && now < entry.expireAt) {
    return entry.data;
  }

  try {
    const meta = await sock.groupMetadata(jid);
    _groupMetaStore.set(jid, { data: meta, expireAt: now + GROUP_META_TTL_MS });
    return meta;
  } catch (_) {
    return null;
  }
}
export function invalidateGroupMeta(jid) {
  _groupMetaStore.delete(jid);
}

export const broadcastLock = new Map();
