import { getTransactionsDb, saveTransactionsDb, normalizeStatus } from "./store.js";

export function getStatusBadge(status) {
  switch (status) {
    case "LUNAS":
      return { text: "✅ LUNAS (BERHASIL)", color: "#10b981", bg: "#064e3b" };
    case "PROSES":
      return { text: "🔄 SEDANG DIPROSES", color: "#38bdf8", bg: "#0c4a6e" };
    case "BATAL":
      return { text: "❌ DIBATALKAN", color: "#f87171", bg: "#7f1d1d" };
    case "PENDING":
    default:
      return { text: "⏳ MENUNGGU PEMBAYARAN", color: "#fbbf24", bg: "#78350f" };
  }
}

export function getTransaction(id) {
  const list = getTransactionsDb();
  const q = String(id || "").trim().toUpperCase();
  if (!q) return null;
  const exact = list.find((t) => t.id === q);
  if (exact) return exact;
  const prefixed = list.filter((t) => t.id.startsWith(q));
  if (prefixed.length === 1) return prefixed[0];
  return null;
}

export function updateTransaction(id, updates = {}) {
  const list = getTransactionsDb();
  const q = String(id || "").trim().toUpperCase();
  const idx = list.findIndex((t) => t.id === q);
  if (idx === -1) return null;

  if (updates.status) {
    updates.status = normalizeStatus(updates.status);
  }
  list[idx] = { ...list[idx], ...updates, updatedAt: Date.now() };
  saveTransactionsDb(list);
  return list[idx];
}

export function listTransactions({ limit = 10, groupJid = null } = {}) {
  const list = getTransactionsDb();
  let filtered = list;
  if (groupJid) {
    filtered = filtered.filter((t) => t.groupJid === groupJid);
  }
  return filtered.slice(0, Math.min(limit, 50));
}

export function deleteTransaction(id) {
  const list = getTransactionsDb();
  const q = String(id || "").trim().toUpperCase();
  const idx = list.findIndex((t) => t.id === q);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveTransactionsDb(list);
  return true;
}
