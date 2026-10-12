import { db } from "@/src/core/database.js";

export function isGroupJid(jid) {
  return Boolean(jid?.endsWith("@g.us"));
}

export function getPhoneDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

export function samePhoneJid(a, b) {
  return db.sameUser(a, b);
}

export function isSameBotJid(a, b) {
  return db.sameUser(a, b);
}

export function findParticipant(meta, jid) {
  const parts = meta?.participants || [];
  for (const p of parts) {
    if (!p) continue;
    const cands = typeof p === "string" ? [p] : [p.id, p.phoneNumber, p.lid];
    for (const c of cands) {
      if (c && db.sameUser(c, jid)) return p;
    }
  }
  return null;
}

export function resolveSenderJid(msg) {
  const key = msg?.key || {};
  const primary = db.normalizeJid(key.participant || "");
  const remote = db.normalizeJid(key.remoteJid || "");
  const alt = db.pickPhoneJid(key.participantAlt, key.remoteJidAlt, key.participantPn, key.senderPn);
  if (primary.endsWith("@lid") && alt) db.rememberLidPn(primary, alt);
  if (alt) return alt;
  if (primary) {
    const viaMap = db.resolvePhoneJid(primary);
    if (viaMap.endsWith("@s.whatsapp.net")) return viaMap;

    if (!isGroupJid(key.remoteJid) && remote.endsWith("@s.whatsapp.net")) {
      if (primary.endsWith("@lid")) db.rememberLidPn(primary, remote);
      return remote;
    }
    if (viaMap) return viaMap;
    return primary;
  }
  if (!isGroupJid(key.remoteJid) && remote) return db.resolvePhoneJid(remote);
  return remote;
}

export function resolveBotJid(sock) {
  const raw = sock?.user?.id || "";
  const norm = raw ? db.normalizeJid(raw) : "";
  if (norm) return norm;

  if (sock?.isSubBot && sock?.subBotNumber) {
    return db.normalizeJid(`${String(sock.subBotNumber).replace(/\D/g, "")}@s.whatsapp.net`);
  }
  return "";
}

export function resolveBotIdentity(sock) {
  const jid = resolveBotJid(sock);
  if (jid) return jid;
  if (sock?.isSubBot) return `sub_${sock?.subBotNumber || "unknown"}`;
  return "main";
}
