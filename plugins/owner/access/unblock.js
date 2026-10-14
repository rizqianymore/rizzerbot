import { db } from "@/src/core/database.js";

export default {
  name: "unblock",
  description: "Unblock user",
  usage: "<nomor>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, getTargetJid, senderJid }) => {
    const jid = getTargetJid(args);
    if (!jid) return reply("Balas pesan user atau masukkan nomor!");
    await sock.updateBlockStatus(jid, "unblock");
    db.setBanned(jid, false, senderJid);
    reply(`*${jid.split("@")[0]}* dibuka blokirnya dan di-unban.`);
  },
};
