import { db } from '@/src/core/database.js';

export default {
  "name": "listowner",
  "aliases": ["owners"],
  "description": "Lihat daftar semua Owner bot",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, botJid }) => {
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      const botConfig = db.getBotSettings(activeBotJid);
      const primary = db.normalizeJid(db.getSettings().ownerNumber);
      const botDedicatedOwner = db.normalizeJid(botConfig.ownerNumber);

      const ownerList = [
        primary,
        botDedicatedOwner,
        ...(Array.isArray(botConfig.ownerNumbers) ? botConfig.ownerNumbers : []),
        ...(Array.isArray(db.getSettings().ownerNumbers) ? db.getSettings().ownerNumbers : []),
      ].filter(Boolean);
      const uniqueOwners = [...new Set(ownerList.map(j => db.normalizeJid(j)))];

      let text = `*DAFTAR OWNER (+${activeBotJid.split("@")[0]})*\n\n`;
      uniqueOwners.forEach((j, i) => {
        const num = j.split("@")[0];
        const isMain = j === primary;
        const isDedicated = j === botDedicatedOwner && !isMain;
        text += `${i + 1}. +${num} ${isMain ? "_(Primary SuperOwner)_" : isDedicated ? "_(Bot Owner)_" : "_(Owner)_"}\n`;
      });
      text += `\nTotal: ${uniqueOwners.length} owner terdaftar`;
      reply(text);
    },
};
