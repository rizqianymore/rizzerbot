import { db } from "@/src/core/database.js";

export const AI_MEMORY_TURNS = 5;
const MAX_MSGS = AI_MEMORY_TURNS * 2;
const MAX_CHARS = 500;

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const content = String(m.content || "").trim().slice(0, MAX_CHARS);
    if (!content) continue;
    out.push({ role: m.role, content });
  }
  return out.slice(-MAX_MSGS);
}

export function getHistory(jid) {
  try {
    if (!jid) return [];
    return sanitizeHistory(db.getUser(jid)?.aiMemory);
  } catch {
    return [];
  }
}

export function pushTurn(jid, userText, assistantText) {
  try {
    if (!jid) return;
    const hist = getHistory(jid);
    const u = String(userText || "").trim().slice(0, MAX_CHARS);
    const a = String(assistantText || "").trim().slice(0, MAX_CHARS);
    if (u) hist.push({ role: "user", content: u });
    if (a) hist.push({ role: "assistant", content: a });
    db.updateUser(jid, { aiMemory: hist.slice(-MAX_MSGS) });
  } catch {}
}

export function clearHistory(jid) {
  try {
    if (!jid) return false;
    db.updateUser(jid, { aiMemory: [] });
    return true;
  } catch {
    return false;
  }
}

export default { getHistory, pushTurn, clearHistory, AI_MEMORY_TURNS };
