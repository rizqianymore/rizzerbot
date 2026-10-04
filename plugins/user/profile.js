import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  createSticker,
  webpToImage,
  findDownloadableTarget,
} from '@/src/services/media.js';
import {
  fetchLyrics,
  translateText,
} from '@/src/services/scrape.js';

import { getUptimeString } from '@/src/utils/helper.js';

export default {
  "name": "profile",
  "aliases": ["cekuser","userinfo","whois"],
  "description": "Cek informasi profil WhatsApp dan status data bot pengguna",
  "usage": "[@user / nomor / reply]",
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, getTargetJid, prefix }) => {
      await sendTyping();

      let targetJid = getTargetJid(args) || senderJid;
      targetJid = db.normalizeJid(targetJid);

      const isSelf = targetJid === senderJid;
      const targetUser = db.getUser(targetJid);
      if (!targetUser) return reply("❌ Nomor target tidak valid.");

      const targetAccess = db.getAccess(targetJid);
      const targetIsOwner = targetAccess.owner;
      const targetIsPremium = targetAccess.premium;

      let ppUrl = null;
      try {
        ppUrl = await sock.profilePictureUrl(targetJid, "image");
      } catch (_) {
        ppUrl = null;
      }

      let waStatus = "-";
      let waStatusSetAt = null;
      try {
        const statusRes = await sock.fetchStatus(targetJid);
        if (statusRes?.status) {
          waStatus = statusRes.status;
          waStatusSetAt = statusRes.setAt ? new Date(statusRes.setAt).toLocaleDateString("id-ID") : null;
        }
      } catch (_) { }

      const phoneNum = targetJid.split("@")[0];

      let displayName = targetUser.name || (isSelf ? (msg.pushName || "Pengguna") : "Pengguna");

      const regDate = targetUser.createdAt
        ? new Date(targetUser.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "-";

      const lines = [
        `*INFORMASI PROFIL PENGGUNA*`,
        ``,
        `• *Nama:* ${displayName}`,
        `• *Nomor:* +${phoneNum}`,
        `• *Status Bot:* ${targetIsOwner ? "Owner Bot" : targetAccess.admin ? "Admin Bot" : targetIsPremium ? "Premium User" : "Free User"}`,
        `• *Status Akun:* ${targetUser.banned ? "Diblokir (Banned)" : "Aktif"}`,
        `• *Terdaftar Bot:* ${regDate}`,
        ``,
        `*Bio / Status WhatsApp:*`,
        `"${waStatus}"${waStatusSetAt ? ` _(Diperbarui: ${waStatusSetAt})_` : ""}`,
      ];

      if (targetUser.profile) {
        lines.push(``, `*Custom Bio Bot:*`, `"${targetUser.profile}"`);
      }

      lines.push(
        ``,
        `• *Tautan Langsung:* wa.me/${phoneNum}`,
        ``,
        `_Ketik \`${prefix}profile @tag\` atau \`${prefix}profile 628xxx\` untuk lookup pengguna lain._`
      );

      const captionText = lines.join("\n");

      if (ppUrl) {
        try {
          const { fetchBuffer } = await import("@/src/services/scrape.js");
          const imgBuffer = await fetchBuffer(ppUrl);
          return await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: imgBuffer,
              caption: captionText,
              mentions: [targetJid],
            },
            { quoted: msg }
          );
        } catch (_) { }
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: captionText,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
    },
};
