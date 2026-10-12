import { db } from '@/src/core/database.js';

export default {
  "name": "access",
  "aliases": ["checkaccess","useraccess"],
  "description": "Check user access",
  "usage": "[nomor]",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, senderJid }) => {
      const jid = getTargetJid(args) || senderJid;
      const access = db.getAccess(jid);
      const user = db.getUser(jid);
      if (!user) return reply("Nomor target tidak valid.");
      const until = user.premiumUntil
        ? new Date(user.premiumUntil).toLocaleDateString("id-ID")
        : "Tanpa batas waktu";
      reply(
        `*STATUS AKSES ${jid.split("@")[0]}*\n` +
        `Role: *${access.role}*\n` +
        `Owner: *${access.owner ? "Ya" : "Tidak"}*\n` +
        `Admin: *${access.admin ? "Ya" : "Tidak"}*\n` +
        `Premium: *${access.premium ? "Ya" : "Tidak"}*\n` +
        `Banned: *${access.banned ? "Ya" : "Tidak"}*\n` +
        `Berlaku: *${until}*`
      );
    },
};
