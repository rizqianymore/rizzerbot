import http from "node:http";
import { db } from "@/src/core/database.js";

const PORT = Number(process.env.HEALTH_PORT || 3001);
let server = null;
let primaryOnline = false;
let bootTime = Date.now();

export function setPrimaryOnline(v) {
  primaryOnline = Boolean(v);
}

/** Kirim pesan ke owner: via primary, fallback subbot online mana pun. */
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

function healthPayload() {
  const mem = process.memoryUsage();
  return {
    status: primaryOnline ? "ok" : "degraded",
    uptimeSec: Math.floor((Date.now() - bootTime) / 1000),
    primaryOnline,
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    time: new Date().toISOString(),
  };
}

export function startHealthServer(logger) {
  if (server) return server;
  server = http.createServer((req, res) => {
    try {
      if (req.url === "/health") {
        const body = JSON.stringify(healthPayload());
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
      } else {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("rizzerbot ok");
      }
    } catch (_) {
      try { res.writeHead(500); res.end("err"); } catch (_) {}
    }
  });
  server.on("error", (err) => {
    logger?.warn?.(`[health] port ${PORT} gagal dipakai: ${err.message}`);
  });
  server.listen(PORT, () => {
    logger?.info?.(`[health] endpoint aktif di port ${PORT} (/health)`);
  });
  return server;
}
