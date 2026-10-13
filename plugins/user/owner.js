import { db } from "@/src/core/database.js";

export default {
  name: "owner",
  aliases: ["ownerinfo", "creator"],
  description: "Get owner info",
  usage: "",
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const activeSettings = db.getSettings();
    const ownerNumber = db.normalizeJid(activeSettings.ownerNumber).split("@")[0] || activeSettings.ownerNumber;
    const text =
      `*OWNER INFO*\n\n` +
      `*Nama:* ${activeSettings.ownerName}\n` +
      `*Nomor:* wa.me/${ownerNumber}\n\n` +
      `Hubungi owner jika ada kendala / ingin sewa bot atau upgrade premium.`;
    await reply(text);
  },
};
