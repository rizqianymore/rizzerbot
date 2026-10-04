import { db } from "@/src/core/database.js";

let primaryOnline = false;

export function setPrimaryOnline(v) {
  primaryOnline = Boolean(v);
}

export async function notifyOwner(text) {
  let ownerJid = "";
  try {
    const s = db.main?.().getSettings?.() || db.getSettings();
    ownerJid = db.normalizeJid(s.ownerNumber || "");
  } catch (_) {}
  if (!ownerJid) return false;

  const candidates = [];
  try {
    const { getPrimarySock } = await import("@/src/core/connection.js");
    const primary = getPrimarySock?.();
    if (primary) candidates.push(primary);
  } catch (_) {}
  try {
    const { subBots } = await import("@/src/services/subbot/store.js");
    for (const entry of subBots.values()) {
      if (entry?.status === "online" && entry?.sock) candidates.push(entry.sock);
    }
  } catch (_) {}

  for (const sock of candidates) {
    try {
      await sock.sendMessage(ownerJid, { text });
      return true;
    } catch (_) {}
  }
  return false;
}
