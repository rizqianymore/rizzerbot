import { connectionState, getPrimarySock } from "@/src/core/connection/state.js";

let started = false;
let stopFn = null;
let inactiveFired = false;

function checkMs() {
  const m = Number(process.env.ACTIVE_CHECK_MINUTES) || 15;
  return Math.max(5, Math.min(180, m)) * 60 * 1000;
}

function botDigits(sock) {
  try {
    return String(sock?.user?.id || "").split("@")[0].split(":")[0].replace(/\D/g, "");
  } catch (_) {
    return "";
  }
}

async function handleInactive(sock, logger, reason) {
  if (inactiveFired) return;
  inactiveFired = true;
  try {
    logger?.error?.(`[ActiveCheck] nomor bot tidak aktif (${reason}). Koneksi dihentikan, reconnect otomatis dimatikan.`);
  } catch (_) {}
  try {
    const { notifyOwner } = await import("@/src/services/system/health.js");
    await notifyOwner(`[ActiveCheck] Nomor bot tidak aktif (${reason}). Pairing ulang diperlukan. Auto-reconnect dimatikan.`);
  } catch (_) {}
  try {
    if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
    connectionState.reconnectTimer = null;
  } catch (_) {}
  try {
    await sock?.end?.();
  } catch (_) {}
  try {
    if (connectionState.primarySock === sock) connectionState.primarySock = null;
    connectionState.isStarting = false;
  } catch (_) {}
}

async function tick(logger) {
  let sock = null;
  try {
    sock = getPrimarySock() || null;
  } catch (_) {
    return;
  }
  if (!sock) return;
  try {
    if (!sock?.authState?.creds?.registered) return;
  } catch (_) {
    return;
  }
  const digits = botDigits(sock);
  if (!digits) return;
  let res = null;
  try {
    res = await Promise.race([
      sock.onWhatsApp(digits),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
    ]);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/logged.?out|401|forbidden|banned/i.test(msg)) {
      await handleInactive(sock, logger, msg.slice(0, 120));
    }
    return;
  }
  const entry = Array.isArray(res) ? res[0] : null;
  if (entry && entry.exists === false) {
    await handleInactive(sock, logger, "nomor tidak terdaftar di WhatsApp");
    return;
  }
  inactiveFired = false;
}

export function startActiveCheck(logger) {
  if (started) return stopFn;
  started = true;
  const run = () => {
    tick(logger).catch(() => {});
  };
  setTimeout(run, 2 * 60 * 1000);
  const timer = setInterval(run, checkMs());
  if (timer && typeof timer.unref === "function") timer.unref();
  try {
    logger?.info?.(`[ActiveCheck] aktif (cek nomor tiap ${Math.round(checkMs() / 60000)} menit).`);
  } catch (_) {}
  stopFn = () => {
    try {
      clearInterval(timer);
    } catch (_) {}
    started = false;
  };
  return stopFn;
}
