// plugins/owner/listadmin.js — perintah "listadmin" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "listadmin",
  "aliases": ["admins","botadmins"],
  "description": "Lihat daftar semua Admin bot",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      const settings = db.getSettings();
      const adminList = Array.isArray(settings.adminNumbers) ? settings.adminNumbers : [];
      const uniqueAdmins = [...new Set(adminList.map(j => db.normalizeJid(j)))].filter(j => !db.isOwner(j));

      if (uniqueAdmins.length === 0) {
        return reply("ℹ️ Belum ada Admin Bot tambahan yang terdaftar.");
      }

      let text = `🛡️ *Daftar Admin*\n\n`;
      uniqueAdmins.forEach((j, i) => {
        const num = j.split("@")[0];
        text += `${i + 1}. +${num}\n`;
      });
      text += `\nTotal: ${uniqueAdmins.length} admin`;
      reply(text);
    },
};
