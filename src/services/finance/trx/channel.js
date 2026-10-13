import { getPrimarySock } from "@/src/core/connection.js";

const channelAdminCache = new Map();

export async function checkIsChannelAdmin(targetSock, channelJid) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;
  const now = Date.now();
  const cached = channelAdminCache.get(channelJid);
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return cached.isAdmin;
  }

  let isAdmin = true;
  try {
    if (typeof targetSock?.newsletterMetadata === "function") {
      const meta = await targetSock.newsletterMetadata("jid", channelJid);
      const role = meta?.viewer_metadata?.role;
      if (role) {
        isAdmin = role === "ADMIN" || role === "OWNER";
      }
    }
  } catch (_) {
    isAdmin = true;
  }

  channelAdminCache.set(channelJid, { isAdmin, timestamp: now });
  return isAdmin;
}

export async function forwardTrxToChannel(sock, channelJid, payload) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;

  let sent = false;
  try {
    const isChannelAdmin = await checkIsChannelAdmin(sock, channelJid);
    if (isChannelAdmin) {
      await sock.sendMessage(channelJid, payload);
      sent = true;
    }
  } catch (err) {
    console.error("[TRX-Channel] Gagal kirim via socket aktif:", err.message);
  }

  if (!sent) {
    try {
      const primary = getPrimarySock();
      if (primary && primary !== sock) {
        await primary.sendMessage(channelJid, payload);
        sent = true;
      }
    } catch (err2) {
      console.error("[TRX-Channel] Fallback kirim via primary bot juga gagal:", err2.message);
    }
  }

  return sent;
}
