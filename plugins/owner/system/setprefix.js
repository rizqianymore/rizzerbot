import { db } from "@/src/core/database.js";

export default {
  name: "setprefix",
  description: "Ubah prefix bot (opsional: tambahkan --all untuk semua bot)",
  usage: "<simbol> [--all]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
    const newPrefix = String(args?.[0] || "").trim();
    const all = args?.includes("--all");
    if (!newPrefix || newPrefix.length > 3) {
      return reply(`Gunakan: .setprefix <1-3 karakter> [--all]\nContoh: .setprefix .  atau  .setprefix ! --all`);
    }
    if (all && !isPrimarySuperOwner) return reply("❌ --all hanya untuk Super Owner.");
    try {
      if (all) db.updateSettings({ prefix: newPrefix });
      else {
        const botJid = db.normalizeJid(sock.user?.id || "");
        db.updateBotSettings(botJid, { prefix: newPrefix });
      }
      await reply(`✅ Prefix berhasil diubah menjadi: "${newPrefix}"${all ? " (semua bot)" : ""}`);
    } catch (e) {
      await reply(`❌ Gagal ubah prefix: ${e?.message || e}`);
    }
  },
};
