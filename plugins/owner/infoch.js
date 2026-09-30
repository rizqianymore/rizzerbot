// plugins/owner/infoch.js — perintah "infoch" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "infoch",
  "aliases": ["chinfo","saluraninfo"],
  "description": "Cek informasi saluran yang terhubung dengan bot",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const settings = db.getSettings();
      const channelJid = settings.channelJid;

      if (!channelJid) {
        return reply(
          `📢 *Informasi Saluran*\n\n` +
          `Status: 🔴 Belum terhubung\n\n` +
          `Gunakan \`.setch <JID_SALURAN>\` untuk menghubungkan bot ke saluran.`
        );
      }

      let infoText =
        `📢 *Informasi Saluran*\n\n` +
        `• JID Saluran: \`${channelJid}\`\n` +
        `• Nama Label: *${settings.channelName || "Official Channel"}*\n` +
        `• Auto Post TRX: *${settings.autoForwardTrxToChannel !== false ? "Aktif" : "Mati"}*\n`;

      try {
        if (sock.newsletterMetadata) {
          const meta = await sock.newsletterMetadata("jid", channelJid);
          if (meta) {
            infoText += `• Nama Asli Saluran: *${meta.name || "-"}*\n`;
            infoText += `• Subscribers: *${meta.subscribers || "-"}*\n`;
            infoText += `• Dibuat: *${meta.creation_time ? new Date(meta.creation_time * 1000).toLocaleDateString("id-ID") : "-"}*\n`;
          }
        }
      } catch (_) {}

      infoText += `\n_Gunakan \`.postch <pesan>\` untuk posting atau \`.delch\` untuk melepas._`;

      reply(infoText);
    },
};
