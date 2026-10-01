// plugins/user/profile.js — perintah "profile" (1 file = 1 perintah).
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

      // Ambil foto profil dari WhatsApp (jika diizinkan privasi WA user)
      let ppUrl = null;
      try {
        ppUrl = await sock.profilePictureUrl(targetJid, "image");
      } catch (_) {
        ppUrl = null;
      }

      // Ambil Status / About / Bio dari WhatsApp
      let waStatus = "-";
      let waStatusSetAt = null;
      try {
        const statusRes = await sock.fetchStatus(targetJid);
        if (statusRes?.status) {
          waStatus = statusRes.status;
          waStatusSetAt = statusRes.setAt ? new Date(statusRes.setAt).toLocaleDateString("id-ID") : null;
        }
      } catch (_) { }

      // Nomor bersih
      const phoneNum = targetJid.split("@")[0];

      // Nama tampilan
      let displayName = targetUser.name || (isSelf ? (msg.pushName || "Pengguna") : "Pengguna");

      // Tanggal registrasi bot
      const regDate = targetUser.createdAt
        ? new Date(targetUser.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "-";

      const lines = [
        `👤 *Informasi Profil Pengguna*`,
        ``,
        `• *Nama:* ${displayName}`,
        `• *Nomor:* +${phoneNum}`,
        `• *Status Bot:* ${targetIsOwner ? "Owner Bot" : targetAccess.admin ? "Admin Bot" : targetIsPremium ? "Premium User" : "Free User"}`,
        `• *Status Banned:* ${targetUser.banned ? "🔴 Diblokir / Banned" : "🟢 Aktif (Normal)"}`,
        `• *Terdaftar Bot:* ${regDate}`,
        ``,
        `📝 *Bio / Status WhatsApp:*`,
        `"${waStatus}"${waStatusSetAt ? ` _(Diperbarui: ${waStatusSetAt})_` : ""}`,
      ];

      if (targetUser.profile) {
        lines.push(``, `📌 *Custom Bio Bot:*`, `"${targetUser.profile}"`);
      }

      lines.push(
        ``,
        `🔗 *Tautan Langsung:* wa.me/${phoneNum}`,
        ``,
        `_💡 Ketik \`${prefix}profile @tag\` atau \`${prefix}profile 628xxx\` untuk lookup pengguna lain._`
      );

      const captionText = lines.join("\n");

      // Kirim bersama gambar profil jika ada
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

      // Fallback pesan teks jika tidak ada foto profil / error fetch
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
