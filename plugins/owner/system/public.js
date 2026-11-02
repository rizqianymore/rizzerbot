import { db } from "@/src/core/database.js";

export default {
  name: "public",
  aliases: ["pub"],
  description: "Set bot to public mode (bisa diakses semua orang) atau private",
  usage: "[--all | --private]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply }) => {
    const mode = String(args?.[0] || "").toLowerCase();
    const botJid = db.normalizeJid(sock.user?.id || "");
    if (mode === "--all") {
      db.updateBotSettings(botJid, { public: true });
      await reply("✅ Bot sekarang mode PUBLIC (semua orang bisa chat)");
    } else if (mode === "--private") {
      db.updateBotSettings(botJid, { public: false });
      await reply("✅ Bot sekarang mode PRIVATE (hanya owner)");
    } else {
      const cur = db.getBotSettings(botJid)?.public;
      const current = cur ? "public" : "private";
      await reply(`Mode saat ini: ${current}\nGunakan \`.public --all\` untuk public atau \`.public --private\` untuk private`);
    }
  }
};
