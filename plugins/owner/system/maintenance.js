import { db } from "@/src/core/database.js";
export default {
  name: "maintenance",
  description: "Aktifkan/nonaktifkan mode maintenance bot",
  usage: "[--on | --off]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply }) => {
    const mode = String(args?.[0] || "").toLowerCase();
    const botJid = db.normalizeJid(sock.user?.id || "");
    if (mode === "--on") {
      db.updateBotSettings(botJid, { maintenance: true });
      await reply("🔧 Bot dimasukkan ke mode maintenance");
    } else if (mode === "--off") {
      db.updateBotSettings(botJid, { maintenance: false });
      await reply("✅ Bot kembali normal");
    } else {
      const cur = db.getBotSettings(botJid)?.maintenance ? "ON" : "OFF";
      await reply(`Mode maintenance: ${cur}\nGunakan: .maintenance --on  atau  .maintenance --off`);
    }
  },
};
