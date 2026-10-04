import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";

export function renderMenu(data) {
  const { botName, prefix, role, totalCmds, categories, catKeys, targetCategory } = data;
  let text = "";

  text += `╭───「 *${botName}* 」\n`;
  text += `│ • Prefix: [ ${prefix} ]\n`;
  text += `│ • Role: ${role}\n`;
  text += `│ • Total: ${totalCmds} Perintah\n`;
  text += `╰──────────────────\n\n`;

  if (targetCategory && categories[targetCategory]) {
    const cmds = categories[targetCategory];
    text += `╭───「 *${targetCategory.toUpperCase()}* (${cmds.length}) 」\n`;
    for (const c of cmds) {
      text += `│ • ${prefix}${c.name}\n`;
    }
    text += `╰──────────────────\n\n`;
    text += `_Ketik ${prefix}menu <command> untuk panduan detail_`;
    return text;
  }

  for (const cat of catKeys) {
    const cmds = categories[cat];
    text += `╭───「 *${cat.toUpperCase()}* (${cmds.length}) 」\n`;
    for (const c of cmds) {
      text += `│ • ${prefix}${c.name}\n`;
    }
    text += `╰──────────────────\n\n`;
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
  run: async (sock, msg, args, { reply, sendTyping, isOwner, isAdmin, isPremium, prefix, activeSettings: ctxSettings }) => {
    await sendTyping();

    const activeSettings = ctxSettings || db.getSettings();
    let rawArg = args.join(" ").trim().toLowerCase();
    if (rawArg.startsWith(prefix)) rawArg = rawArg.slice(prefix.length).trim();

    const categoryAliases = {
      bug: "Bug",
      bugs: "Bug",
      exploit: "Bug",
      news: "News",
      berita: "News",
      "social media": "Social Media",
      socialmedia: "Social Media",
      socmed: "Social Media",
      sosmed: "Social Media",
      ai: "AI",
      sticker: "Sticker",
      stiker: "Sticker",
      tools: "Tools",
      tool: "Tools",
      alat: "Tools",
      group: "Group",
      grup: "Group",
      grub: "Group",
      gc: "Group",
      user: "User",
      usr: "User",
      pengguna: "User",
      premium: "Premium",
      prem: "Premium",
      pro: "Premium",
      owner: "Owner",
      own: "Owner",
      creator: "Owner",
      general: "General",
      sports: "Sports",
      sport: "Sports",
      stalker: "Stalker",
      stalk: "Stalker",
      osint: "OSINT",
      recon: "OSINT",
      intel: "OSINT",
    };

    const showAll = rawArg === "all" || rawArg === "semua" || rawArg === "full";
    const targetCategory = rawArg && !showAll ? categoryAliases[rawArg] : null;

    if (rawArg && !targetCategory) {
      const targetCmd = commands.get(rawArg);

      if (targetCmd) {
        const hiddenForStranger = !isOwner && !isAdmin && !isPremium &&
          (targetCmd.groupOnly || targetCmd.groupAdminOnly || targetCmd.botAdminOnly);
        if ((targetCmd.ownerOnly && !isOwner) || (targetCmd.adminOnly && !isAdmin) || (targetCmd.premiumOnly && !isPremium) || hiddenForStranger) {
          return await reply(`❌ *${rawArg}* tidak ditemukan.\n\nKetik ${prefix}menu untuk daftar perintah.`);
        }

        const usageArgs = targetCmd.usage || "";
        const usage = usageArgs ? ` *${prefix}${targetCmd.name} ${usageArgs}*` : ` *${prefix}${targetCmd.name}*`;
        const aliases = targetCmd.aliases && targetCmd.aliases.length > 0 ? targetCmd.aliases.map((a) => `*${prefix}${a}*`).join(", ") : "-";

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
      return reply(`❌ Kategori *${rawArg}* tidak ditemukan atau tidak tersedia.`);
    }

    const order = [
      "Bug",
      "News",
      "Social Media",
      "AI",
      "Sticker",
      "Tools",
      "Group",
      "User",
      "Premium",
      "Owner",
      "General",
      "Sports",
      "Stalker",
      "OSINT",
    ];
    const catKeys = Object.keys(categories).sort((a, b) => {
      const ia = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
      const ib = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
      return ia - ib;
    });

    const role = isOwner ? "Owner" : isAdmin ? "Admin" : isPremium ? "Premium" : "User";
    const totalCmds = catKeys.reduce((n, k) => n + categories[k].length, 0);
    const finalCaption = renderMenu({
      botName: activeSettings.botName || "Rizzer Bot",
      prefix,
      role,
      totalCmds,
      categories,
      catKeys,
      targetCategory,
    }).trim();

    try {
      let imagePayload = null;
      const { existsSync, readFileSync } = await import("fs");
      const { resolve } = await import("path");

      if (activeSettings.image) {
        if (typeof activeSettings.image === "string" && (activeSettings.image.startsWith("http://") || activeSettings.image.startsWith("https://"))) {
          imagePayload = { url: activeSettings.image };
        } else {
          const localPath = resolve(process.cwd(), activeSettings.image);
          if (existsSync(localPath)) {
            imagePayload = readFileSync(localPath);
          }
        }
      }

      if (!imagePayload) {
        const defaultBannerPaths = [
          resolve(process.cwd(), "assets/image/banner.webp"),
          resolve(process.cwd(), "assets/image/banner.jpg"),
          resolve(process.cwd(), "assets/image/banner.jpeg"),
          resolve(process.cwd(), "assets/image/banner.png"),
        ];
        for (const p of defaultBannerPaths) {
          if (existsSync(p)) {
            imagePayload = readFileSync(p);
            break;
          }
        }
      }

      if (imagePayload) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: imagePayload,
            caption: finalCaption,
          },
          { quoted: msg }
        );
      }
    } catch (_) { }

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: finalCaption },
      { quoted: msg }
    );
  },
};
