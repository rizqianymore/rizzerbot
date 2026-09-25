import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import path from "path";

const categoryOrder = ["News", "Social Media", "AI", "Sticker", "Tools", "Group", "User", "Premium", "Owner", "General"];

export default {
  name: "listplugins",
  aliases: ["plugins", "cmds", "commandslist"],
  description: "Menampilkan daftar semua plugin yang ter-load beserta detailnya",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, isOwner, isAdmin, isPremium, prefix }) => {
    await sendTyping();

    const activeSettings = db.getSettings();

    const seen = new Set();
    const pluginsData = [];

    commands.forEach((cmd) => {
      if (seen.has(cmd.name)) return;
      seen.add(cmd.name);

      if (cmd.ownerOnly && !isOwner) return;
      if (cmd.adminOnly && !isAdmin) return;
      if (cmd.premiumOnly && !isPremium) return;

      const cat = cmd.category || "General";
      const fileName = cmd.filePath ? path.basename(cmd.filePath) : "unknown";

      pluginsData.push({
        name: cmd.name,
        category: cat,
        description: cmd.description || "Tidak ada deskripsi",
        aliases: cmd.aliases || [],
        file: fileName,
        ownerOnly: cmd.ownerOnly || false,
        adminOnly: cmd.adminOnly || false,
        premiumOnly: cmd.premiumOnly || false,
        groupOnly: cmd.groupOnly || false,
        groupAdminOnly: cmd.groupAdminOnly || false,
        botAdminOnly: cmd.botAdminOnly || false,
      });
    });

    if (pluginsData.length === 0) {
      return reply("❌ Tidak ada plugin yang ter-load.");
    }

    const categories = {};
    for (const p of pluginsData) {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category].push(p);
    }

    let text = `*${activeSettings.botName} - Daftar Plugin*\n`;
    text += `• Prefix : [ *${prefix}* ]\n`;
    text += `• Status : *${isOwner ? "Owner" : isAdmin ? "Admin" : isPremium ? "Premium" : "Free User"}*\n`;
    text += `• Total  : *${pluginsData.length} Plugin*\n\n`;

    const catKeys = Object.keys(categories).sort((a, b) => {
      const ia = categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b);
      return ia - ib;
    });

    for (const cat of catKeys) {
      text += `┌───「 *${cat}* (${categories[cat].length}) 」\n`;
      for (const p of categories[cat]) {
        const badges = [];
        if (p.ownerOnly) badges.push("🔒Owner");
        if (p.adminOnly) badges.push("🛡️Admin");
        if (p.premiumOnly) badges.push("⭐Premium");
        if (p.groupOnly) badges.push("👥Group");
        if (p.groupAdminOnly) badges.push("👑GAdmin");
        if (p.botAdminOnly) badges.push("🤖BAdmin");
        const badgeStr = badges.length ? ` [${badges.join(", ")}]` : "";
        const aliasStr = p.aliases.length ? ` | Alias: ${p.aliases.map(a => `${prefix}${a}`).join(", ")}` : "";
        text += `│ • ${prefix}${p.name}${badgeStr}\n`;
        text += `│   ├ Desc: ${p.description}\n`;
        text += `│   ├ File: ${p.file}${aliasStr}\n`;
        text += `│   └\n`;
      }
      text += `└───\n\n`;
    }

    text += `💡 _Gunakan \`${prefix}help <command>\` untuk info detail._`;

    try {
      let imagePayload = null;
      if (activeSettings.image) {
        if (typeof activeSettings.image === "string" && (activeSettings.image.startsWith("http://") || activeSettings.image.startsWith("https://"))) {
          imagePayload = { url: activeSettings.image };
        } else {
          const { existsSync, readFileSync } = await import("fs");
          const { resolve } = await import("path");
          const localPath = resolve(process.cwd(), activeSettings.image);
          if (existsSync(localPath)) {
            imagePayload = readFileSync(localPath);
          }
        }
      }

      if (imagePayload) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { image: imagePayload, caption: text },
          { quoted: msg }
        );
      }
    } catch (_) {}

    await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
  },
};