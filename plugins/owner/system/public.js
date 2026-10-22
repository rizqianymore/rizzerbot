import { db } from "@/src/core/database.js";

export default {
  name: "public",
  aliases: ["pub"],
  description: "Set bot to public mode (bisa diakses semua orang) atau private",
  usage: "[--all]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, { reply }) => {
    const mode = args?.[0];
    if (mode === "--all") {
      db?.put("botMode", "public-all");
      await reply("✅ Bot sekarang mode PUBLIC (semua orang bisa chat)");
    } else if (mode === "--private") {
      db?.put("botMode", "private");
      await reply("✅ Bot sekarang mode PRIVATE (hanya owner)");
    } else {
      const current = db?.get("botMode") || "private";
      await reply(`Mode saat ini: ${current}\nGunakan \`.public --all\` untuk public atau \`.public --private\` untuk private`);
    }
  }
};
