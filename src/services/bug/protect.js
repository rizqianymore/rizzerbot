// src/services/bug/protect.js — proteksi target perintah bug.
// Aturan:
// 1. DILARANG menyerang bot sendiri (self-bot / nomor bot mana pun) — selalu diblokir, tanpa kecuali.
// 2. DILARANG menyerang nomor yang terdaftar di database (owner/admin/premium)
//    tanpa izin Primary SuperOwner.
import { db } from "@/src/core/database.js";

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Kembalikan string alasan penolakan jika target dilarang diserang, atau null jika aman.
 */
export function getBugTargetBlockReason(sock, targetJid, { isPrimarySuperOwner = false } = {}) {
  const target = db.normalizeJid(targetJid);
  if (!target) return "❌ Target tidak valid.";
  if (target.endsWith("@g.us")) return null; // target grup ditangani terpisah

  // 1. Self-bot / nomor bot — mutlak diblokir.
  const botJid = db.normalizeJid(sock?.user?.id || "");
  if (botJid && (target === botJid || (digits(target) && digits(target) === digits(botJid)))) {
    return "❌ Ditolak: target adalah bot ini sendiri (self-bot).";
  }
  try {
    if (db.isAnyBotJid(target)) {
      return "❌ Ditolak: target terdaftar sebagai nomor bot.";
    }
  } catch (_) {}

  // 2. Nomor di database — butuh izin Primary SuperOwner.
  if (!isPrimarySuperOwner) {
    try {
      if (db.isOwner(target)) {
        return "❌ Ditolak: target terdaftar sebagai Owner di database. Serangan ke nomor database butuh izin Primary Owner.";
      }
      if (db.isAdmin(target)) {
        return "❌ Ditolak: target terdaftar sebagai Admin di database. Serangan ke nomor database butuh izin Primary Owner.";
      }
      if (db.isPremium(target)) {
        return "❌ Ditolak: target terdaftar sebagai Premium di database. Serangan ke nomor database butuh izin Primary Owner.";
      }
    } catch (_) {}
  }

  return null;
}
