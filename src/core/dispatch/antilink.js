import { db } from "@/src/core/database.js";
import { getCachedGroupMeta } from "@/src/utils/helper.js";
import { isGroupJid, resolveSenderJid, findParticipant } from "./identity.js";

const BASE_LINK_PATTERN = "chat\\.whatsapp\\.com\\/[A-Za-z0-9]{16,26}|whatsapp\\.com\\/channel\\/[A-Za-z0-9]+|wa\\.me\\/settings";
const EXTRA_LINK_PATTERN = "wa\\.me\\/[0-9]{8,16}|t\\.me\\/[A-Za-z0-9_]{3,}|discord\\.(gg|com\\/invite)\\/[A-Za-z0-9]+|telegram\\.me\\/[A-Za-z0-9_]{3,}";
const BASE_LINK_RE = new RegExp(`(${BASE_LINK_PATTERN})`, "i");
const EXTRA_LINK_RE = new RegExp(`(${BASE_LINK_PATTERN}|${EXTRA_LINK_PATTERN})`, "i");

function normalizeContent(raw) {
  let s = String(raw || "");
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");
  s = s.replace(/[\uFF0E\u30FB\u2024]/g, ".");
  s = s.replace(/\s*\.\s*/g, ".").replace(/\s*\/\s*/g, "/").replace(/\s*:\s*/g, ":");
  s = s.replace(/\bhxxps\b/gi, "https").replace(/\bhxxp\b/gi, "http");
  return s;
}

export async function checkAntilink(sock, msg, logger, remoteJid, messageContent) {
  if (!isGroupJid(remoteJid) || !db.isAntilink(remoteJid)) return false;
  try {
    const botJid = db.normalizeJid(sock.user?.id);
    const meta0 = await getCachedGroupMeta(sock, remoteJid).catch(() => null);
    const botP = findParticipant(meta0, botJid);
    const isBotAdmin = Boolean(botP && (botP.admin === "admin" || botP.admin === "superadmin"));
    if (!isBotAdmin) return false;
  } catch (_) {
    return false;
  }
  let content = normalizeContent(messageContent);
  try {
    const m = msg.message || {};
    if (m.groupInviteMessage || m.groupInviteMessageV4 || m.inviteLinkGroupType) {
      content += " chat.whatsapp.com/invite";
    }
    const cap = m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption || "";
    if (cap) content += " " + normalizeContent(cap);
  } catch (_) {}
  const extra = db.getSettings()?.antilinkExtra !== false;
  const linkRegex = extra ? EXTRA_LINK_RE : BASE_LINK_RE;
  if (linkRegex.test(content)) {
    const senderJid = resolveSenderJid(msg);
    const isOwner = db.isOwner(senderJid);
    if (!isOwner) {
      const meta = await getCachedGroupMeta(sock, remoteJid).catch(() => null);
      const participant = findParticipant(meta, senderJid);
      const isGroupAdmin = participant && (participant.admin === "admin" || participant.admin === "superadmin");
      if (!isGroupAdmin) {
        logger?.warn?.(`[Anti-Link] Menghapus link grup dari non-admin: ${senderJid} di grup ${remoteJid}`);
        try {
          await sock.sendMessage(remoteJid, { delete: msg.key });
          await sock.sendMessage(remoteJid, {
            text: `⚠️ *Anti-Link*\n\nMaaf @${senderJid.split("@")[0]}, dilarang mengirim tautan grup WhatsApp di sini. Pesan Anda telah dihapus.`,
            mentions: [senderJid],
          });
        } catch (_) {}
        return true;
      }
    }
  }
  return false;
}
