import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { sortCategoryKeys, resolveCategoryAlias } from "@/src/core/categories.js";
import { resolveImagePayload, sendWithImage } from "@/src/utils/imagePayload.js";

export function renderMenu(data) {
  const { botName, prefix, role, totalCmds, categories, catKeys, targetCategory } = data;
  let text = "";

  text += `╭───「 *${botName.toUpperCase()}* 」\n`;
  text += `│ • Status: Aktif (Online)\n`;
  text += `│ • Prefix: [ ${prefix} ]\n`;
  text += `│ • Role: ${role}\n`;
  text += `│ • Total: ${totalCmds} Perintah\n`;
  text += `╰───\n\n`;

  if (targetCategory && categories[targetCategory]) {
    const cmds = categories[targetCategory] || [];
    text += `╭───「 *${targetCategory.toUpperCase()}* (${cmds.length}) 」\n`;
    for (const c of cmds) {
      text += `│ • ${prefix}${c.name}\n`;
    }
    text += `╰───\n\n`;
    text += `_Ketik ${prefix}menu <command> untuk panduan detail_`;
    return text;
  }

  for (const cat of catKeys) {
    const cmds = categories[cat] || [];
    if (!cmds || cmds.length === 0) continue;
    text += `╭───「 *${cat.toUpperCase()}* (${cmds.length}) 」\n`;
    for (const c of cmds) {
      text += `│ • ${prefix}${c.name}\n`;
    }
    text += `╰───\n\n`;
  }

  text += `_Ketik ${prefix}menu <command> untuk panduan detail perintah_`;

  return text;
}

export default {
  name: "menu",
  aliases: ["help", "panduan"],
  description: "Menampilkan daftar seluruh perintah dan panduan cara penggunaannya.",
  usage: "[command / kategori]",
  category: "General",
  run: async (
    sock,
    msg,
    args,
    { reply, sendTyping, isOwner, isAdmin, isPremium, prefix, activeSettings: ctxSettings }
  ) => {
    await sendTyping();

    const activeSettings = ctxSettings || db.getSettings();
    let rawArg = args.join(" ").trim().toLowerCase();
    if (rawArg.startsWith(prefix)) rawArg = rawArg.slice(prefix.length).trim();

    const showAll = rawArg === "all" || rawArg === "semua" || rawArg === "full";
    const targetCategory = rawArg && !showAll ? resolveCategoryAlias(rawArg) : null;

    if (rawArg && !targetCategory) {
      const targetCmd = commands.get(rawArg);

      if (targetCmd) {
        const hiddenForStranger =
          !isOwner &&
          !isAdmin &&
          !isPremium &&
          (targetCmd.groupOnly || targetCmd.groupAdminOnly || targetCmd.botAdminOnly);
        if (
          (targetCmd.ownerOnly && !isOwner) ||
          (targetCmd.adminOnly && !isAdmin) ||
          (targetCmd.premiumOnly && !isPremium) ||
          hiddenForStranger
        ) {
          return await reply(`*${rawArg}* tidak ditemukan.\n\nKetik ${prefix}menu untuk daftar perintah.`);
        }

        const usageArgs = targetCmd.usage || "";
        const usage = usageArgs ? ` *${prefix}${targetCmd.name} ${usageArgs}*` : ` *${prefix}${targetCmd.name}*`;
        const aliases =
          targetCmd.aliases && targetCmd.aliases.length > 0
            ? targetCmd.aliases.map((a) => `*${prefix}${a}*`).join(", ")
            : "-";

        const detailText =
          `*PANDUAN PERINTAH: ${prefix}${targetCmd.name}*\n\n` +
          `• *Kategori:* ${targetCmd.category || "General"}\n` +
          `• *Deskripsi:* ${targetCmd.description || "Tidak ada deskripsi."}\n` +
          `• *Format Penggunaan:*${usage}\n` +
          `• *Alias Singkat:* ${aliases}\n` +
          (targetCmd.premiumOnly ? `• *Akses:* Khusus Premium User\n` : "") +
          (targetCmd.adminOnly ? `• *Akses:* Khusus Admin Bot\n` : "") +
          (targetCmd.ownerOnly ? `• *Akses:* Khusus Pemilik Bot\n` : "");

        return await reply(detailText.trim());
      }
    }

    const categories = {};
    const seen = new Set();

    commands.forEach((cmd) => {
      if (seen.has(cmd.name)) return;
      seen.add(cmd.name);

      if (cmd.ownerOnly && !isOwner) return;
      if (cmd.adminOnly && !isAdmin) return;
      if (cmd.premiumOnly && !isPremium) return;
      if (!isOwner && !isAdmin && !isPremium && (cmd.groupOnly || cmd.groupAdminOnly || cmd.botAdminOnly)) return;

      const cat = cmd.category || "General";

      if (targetCategory && cat.toLowerCase() !== targetCategory.toLowerCase()) {
        return;
      }

      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    });

    if (targetCategory && Object.keys(categories).length === 0) {
      return reply(`Kategori *${rawArg}* tidak ditemukan atau tidak tersedia.`);
    }

    const catKeys = sortCategoryKeys(Object.keys(categories));

    const role = isOwner ? "Owner" : isAdmin ? "Admin" : isPremium ? "Premium" : "User";
    const totalCmds = catKeys.reduce((n, k) => n + (categories[k]?.length || 0), 0);
    const jid = msg.key.remoteJid;
    const botName = activeSettings.botName || "Rizzer Bot";

    const body = renderMenu({
      botName,
      prefix,
      role,
      totalCmds,
      categories,
      catKeys,
      targetCategory: targetCategory || null,
    }).trim();

    try {
      const imagePayload = await resolveImagePayload(activeSettings);
      return await sendWithImage(sock, jid, imagePayload, body, msg);
    } catch (_) {
      return await reply(body);
    }
  },
};
