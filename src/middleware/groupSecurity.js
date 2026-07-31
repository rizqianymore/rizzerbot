import { db } from "@/lib/database.js";
import { getCachedGroupMeta } from "@/lib/utils.js";

export async function processGroupSecurity(sock, msg, messageContent, senderJid, remoteJid, isOwner, logger) {
  if (!remoteJid.endsWith("@g.us") || isOwner || msg.key.fromMe) return false;

  const groupConfig = db.getGroup(remoteJid);
  if (!groupConfig || (!groupConfig.antilink && !groupConfig.antibot)) return false;

  const groupMeta = await getCachedGroupMeta(sock, remoteJid);
  const participants = groupMeta?.participants || [];
  const senderEntry = participants.find(
    (p) => db.normalizeJid(p.id) === senderJid
  );
  const isSenderAdmin =
    senderEntry?.admin === "admin" || senderEntry?.admin === "superadmin";

  if (groupConfig.antilink) {
    const hasLink =
      /https?:\/\/\S+/i.test(messageContent) ||
      /chat\.whatsapp\.com/i.test(messageContent);
    if (hasLink && !isSenderAdmin) {
      if (logger) {
        logger.debug(
          `[Anti-Link] Deleting link message from ${senderJid} in ${remoteJid}`
        );
      }
      await sock.sendMessage(remoteJid, { delete: msg.key });

      const warnings = groupConfig.warnings || {};
      const warnCount = (warnings[senderJid] || 0) + 1;
      warnings[senderJid] = warnCount;
      db.updateGroup(remoteJid, { warnings });

      if (warnCount >= 3) {
        delete warnings[senderJid];
        db.updateGroup(remoteJid, { warnings });
        await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
        await sock.sendMessage(remoteJid, {
          text: `🚫 *[KICKED - ANTILINK]*\n\n@${senderJid.split("@")[0]} telah dikeluarkan karena mengabaikan peringatan antilink (3/3).`,
          mentions: [senderJid],
        });
      } else {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ *[PERINGATAN ANTILINK]*\n\n@${senderJid.split("@")[0]}, dilarang keras membagikan link di grup ini!\n\n• Peringatan: *${warnCount}/3*\n• Sanksi: Jika melanggar lagi sampai 3 kali, Anda akan dikeluarkan otomatis.`,
          mentions: [senderJid],
        });
      }
      return true;
    }
  }

  if (groupConfig.antibot) {
    const isBotMsg =
      msg.key.id.startsWith("BAE5") ||
      msg.key.id.startsWith("3EB0") ||
      (msg.key.id.startsWith("WA") && msg.key.id.length === 12);
    if (isBotMsg && !isSenderAdmin) {
      if (logger) {
        logger.debug(
          `[Antibot] Removing bot sender ${senderJid} in ${remoteJid}`
        );
      }
      await sock.sendMessage(remoteJid, { delete: msg.key });
      await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
      await sock.sendMessage(remoteJid, {
        text: `🛡️ *[ANTIBOT ACTION]*\n\nBot lain terdeteksi mengirimkan pesan di grup ini!\n\n• Target: @${senderJid.split("@")[0]}\n• Tindakan: Pesan dihapus & pelaku dikeluarkan otomatis.`,
        mentions: [senderJid],
      });
      return true;
    }
  }

  return false;
}
