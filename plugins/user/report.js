import { db } from "@/src/core/database.js";

export default {
  name: "report",
  description: "Report bug to owner",
  usage: "<isi pesan laporan>",
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping, senderJid }) => {
    await sendTyping();
    const activeSettings = db.getSettings();
    const ownerJid = db.normalizeJid(activeSettings.ownerNumber);
    const data =
      `*LAPORAN MASUK*\n\n` +
      `*Dari:* ${msg.pushName || "User"}\n` +
      `*Nomor:* ${senderJid}\n\n` +
      `*Laporan:* ${args.join(" ") || "(kosong)"}`;
    if (!ownerJid) return reply("Nomor owner belum dikonfigurasi.");
    await sock.sendMessage(ownerJid, { text: data });
    await reply("Laporan telah dikirim ke Owner.");
  },
};
