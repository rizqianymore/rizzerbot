import { db } from "@/src/core/database.js";
import { notifyOwnerSafe, resolveOwnerJid } from "@/src/utils/send-safe.js";

let _primaryOnline = false;

export function setPrimaryOnline(v) {
  _primaryOnline = Boolean(v);
}

export function isPrimaryOnline() {
  return _primaryOnline;
}

export async function notifyOwner(text) {
  const jid = resolveOwnerJid();
  if (!jid) {
    console.warn("[notifyOwner] ownerNumber kosong, notifikasi tidak dikirim");
    return false;
  }
  return notifyOwnerSafe(text, console, "notifyOwner");
}
