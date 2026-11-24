import { db } from "@/src/core/database.js";

function digits(jid) {
  return String(jid || "").split("@")[0] || "-";
}

export function resolveOwnerJid() {
  try {
    const s = db.main?.().getSettings?.() || db.getSettings() || {};
    const jid = db.normalizeJid(s.ownerNumber || s.pairingNumber || process.env.OWNER_NUMBER || "");
    if (jid) return jid;
  } catch (_) {}
  try {
    const jid = db.normalizeJid(process.env.OWNER_NUMBER || "");
    if (jid) return jid;
  } catch (_) {}
  return "";
}

export async function sendSafe(sock, jid, payload, options, logger, label = "send") {
  if (!sock?.sendMessage) {
    logger?.warn?.(`[${label}] sock tidak siap, pesan tidak dikirim ke ${digits(jid)}`);
    return { ok: false, error: "sock tidak siap" };
  }
  if (!jid) {
    logger?.warn?.(`[${label}] JID kosong, pesan tidak dikirim`);
    return { ok: false, error: "JID kosong" };
  }
  try {
    const result = await sock.sendMessage(jid, payload, options);
    return { ok: true, result };
  } catch (err) {
    const msg = err?.message || String(err);
    logger?.warn?.(`[${label}] Gagal kirim ke ${digits(jid)}: ${msg}`);
    return { ok: false, error: msg };
  }
}

export async function notifyOwnerSafe(text, logger, label = "notify") {
  const jid = resolveOwnerJid();
  if (!jid) {
    logger?.warn?.(`[${label}] ownerNumber kosong, notifikasi tidak dikirim`);
    return false;
  }

  const candidates = [];
  try {
    const { getPrimarySock } = await import("@/src/core/connection.js");
    const primary = getPrimarySock?.();
    if (primary) candidates.push(["primary", primary]);
  } catch (_) {}
  try {
    const { subBots } = await import("@/src/services/system/subbot/store.js");
    for (const [key, entry] of subBots.entries()) {
      if (entry?.status === "online" && entry?.sock) candidates.push([key, entry.sock]);
    }
  } catch (_) {}

  for (const [name, sock] of candidates) {
    const res = await sendSafe(sock, jid, { text }, undefined, logger, `${label}:${name}`);
    if (res.ok) return true;
  }
  logger?.warn?.(`[${label}] Semua kandidat sock gagal mengirim notifikasi ke owner.`);
  return false;
}
