import { db } from "@/src/core/database.js";
import { getCachedGroupMeta } from "@/src/utils/helper.js";
import { isGroupJid, resolveSenderJid, findParticipant } from "./identity.js";

const BASE_LINK_PATTERN = "chat\\.whatsapp\\.com\\/[A-Za-z0-9]{16,26}|whatsapp\\.com\\/channel\\/[A-Za-z0-9]+|wa\\.me\\/settings";
const EXTRA_LINK_PATTERN = "wa\\.me\\/[0-9]{8,16}|t\\.me\\/[A-Za-z0-9_]{3,}|discord\\.(gg|com\\/invite)\\/[A-Za-z0-9]+|telegram\\.me\\/[A-Za-z0-9_]{3,}";
const BASE_LINK_RE = new RegExp(`(${BASE_LINK_PATTERN})`, "i");
const EXTRA_LINK_RE = new RegExp(`(${BASE_LINK_PATTERN}|${EXTRA_LINK_PATTERN})`, "i");

export async function checkAntilink(sock, msg, logger, remoteJid, messageContent) {
  if (isGroupJid(remoteJid) && db.isAntilink(remoteJid)) {
    const extra = db.getSettings()?.antilinkExtra !== false;
    const linkRegex = extra ? EXTRA_LINK_RE : BASE_LINK_RE;
    if (linkRegex.test(messageContent)) {
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
  }
  return false;
}
