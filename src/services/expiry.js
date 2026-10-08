import fs from "fs";
import path from "path";
import { db } from "@/src/core/database.js";

const RENTALS_PATH = path.join(process.cwd(), "database", "rentals.json");

function loadRentals() {
  try {
    if (!fs.existsSync(RENTALS_PATH)) return { groups: {} };
    const raw = JSON.parse(fs.readFileSync(RENTALS_PATH, "utf-8"));
    if (raw && typeof raw === "object" && raw.groups && typeof raw.groups === "object") return raw;
  } catch (_) {}
  return { groups: {} };
}

function saveRentals(data) {
  fs.mkdirSync(path.dirname(RENTALS_PATH), { recursive: true });
  fs.writeFileSync(RENTALS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function addRental(groupJid, days, addedBy = "") {
  const d = Number(days);
  if (!groupJid?.endsWith("@g.us")) throw new Error("JID grup tidak valid");
  if (!Number.isFinite(d) || d <= 0 || d > 3650) throw new Error("Durasi hari tidak valid (1-3650)");
  const data = loadRentals();
  data.groups[groupJid] = {
    until: Date.now() + d * 24 * 60 * 60 * 1000,
    addedBy,
    addedAt: Date.now(),
    warned: false,
  };
  saveRentals(data);
  return data.groups[groupJid];
}

export function removeRental(groupJid) {
  const data = loadRentals();
  const existed = Boolean(data.groups[groupJid]);
  delete data.groups[groupJid];
  saveRentals(data);
  return existed;
}

export function listRentals() {
  return loadRentals().groups;
}

export function cleanupExpiredPremium(logger) {
  let cleaned = 0;
  const stores = [{ key: "", jid: "" }];
  try {
    for (const digits of db.getKnownSubDigits()) {
      stores.push({ key: digits, jid: `${digits}@s.whatsapp.net` });
    }
  } catch (_) {}

  for (const s of stores) {
    try {
      db.runWithBot(s.jid, () => {
        const users = db.data.users || {};
        for (const [jid, u] of Object.entries(users)) {
          try {
            if (!u?.premium || !u.premiumUntil) continue;
            if (Number(u.premiumUntil) > Date.now()) continue;
            if (db.isOwner(jid) || db.isAdmin(jid)) continue;
            db.setPremium(jid, false);
            cleaned++;
          } catch (_) {}
        }
      });
    } catch (err) {
      logger?.warn?.(`[expiry] cleanup gagal untuk store ${s.key || "main"}: ${err.message}`);
    }
  }
  if (cleaned > 0) logger?.info?.(`[expiry] ${cleaned} premium kedaluwarsa dibersihkan.`);
  return cleaned;
}

export async function checkRentals(logger) {
  const data = loadRentals();
  const ids = Object.keys(data.groups);
  if (!ids.length) return { left: 0, warned: 0 };
  let left = 0;
  let warned = 0;

  let sock = null;
  let notify = null;
  try {
    const { getPrimarySock } = await import("@/src/core/connection.js");
    sock = getPrimarySock?.() || null;
    ({ notifyOwner: notify } = await import("@/src/services/health.js"));
  } catch (_) {}

  for (const gid of ids) {
    const r = data.groups[gid];
    if (!r) continue;
    try {
      if (r.until <= Date.now()) {
        if (!sock) continue;
        try { await sock.groupLeave(gid); } catch (_) {}
        delete data.groups[gid];
        left++;
        try { await notify?.(`Sewa grup ${gid} habis, bot keluar otomatis.`); } catch (_) {}
      } else if (!r.warned && r.until - Date.now() < 24 * 60 * 60 * 1000) {
        r.warned = true;
        warned++;
        try {
          await notify?.(
            `Sewa grup ${gid} habis <24 jam (${new Date(r.until).toLocaleString("id-ID")}).`
          );
        } catch (_) {}
      }
    } catch (_) {}
  }
  saveRentals(data);
  if (left > 0 || warned > 0) {
    logger?.info?.(`[expiry] sewa: ${left} grup expired keluar, ${warned} peringatan H-1.`);
  }
  return { left, warned };
}

let _started = false;

export function startExpiryCron(logger) {
  if (_started) return;
  _started = true;
  const run = async () => {
    try {
      cleanupExpiredPremium(logger);
    } catch (_) {}
    try {
      await checkRentals(logger);
    } catch (_) {}
  };
  setTimeout(run, 60 * 1000);
  const timer = setInterval(run, 60 * 60 * 1000);
  if (timer && typeof timer.unref === "function") timer.unref();
  logger?.info?.("[expiry] cron aktif (cek tiap 1 jam).");
}
