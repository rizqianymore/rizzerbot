import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { sortCategoryKeys, resolveCategoryAlias } from "@/src/core/categories.js";
import { resolveImagePayload, sendWithImage } from "@/src/utils/imagePayload.js";

export const MENU_INTERACTIVE_MAX = 900;

export function buildMenuButtons(catKeys, prefix) {
  return [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text: "Semua Menu", id: `${prefix}menu all` }),
    },
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "Kategori",
        sections: [
          {
            title: "Kategori",
            rows: catKeys.map((k) => ({ title: k, id: `${prefix}menu ${k}` })),
          },
        ],
      }),
    },
  ];
}

async function resolveMenuImage(activeSettings = {}) {
  try {
    const p = await resolveImagePayload(activeSettings);
    if (!p) return undefined;
    if (Buffer.isBuffer(p)) return p;
    if (p?.url) return { url: p.url };
  } catch (_) {}
  return undefined;
}

export function shouldUseInteractive(bodyText) {
  return typeof bodyText === "string" && bodyText.length > 0 && bodyText.length <= MENU_INTERACTIVE_MAX;
}

export function renderMenu(data) {
  const { botName, prefix, role, totalCmds, categories, catKeys, targetCategory } = data;
  let text = "";

  text += `╭───「 *${botName}* 」\n`;
  text += `│ • Prefix: [ ${prefix} ]\n`;
  text += `│ • Role: ${role}\n`;
  text += `│ • Total: ${totalCmds} Perintah\n`;
  text += `╰───\n\n`;

  if (targetCategory && categories[targetCategory]) {
    const cmds = categories[targetCategory];
    text += `╭───「 *${targetCategory.toUpperCase()}* (${cmds.length}) 」\n`;
    for (const c of cmds) {
      text += `│ • ${prefix}${c.name}\n`;
    }
    text += `╰───\n\n`;
    text += `_Ketik ${prefix}menu <command> untuk panduan detail_`;
    return text;
  }

  for (const cat of catKeys) {
    const cmds = categories[cat];
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
    const totalCmds = catKeys.reduce((n, k) => n + categories[k].length, 0);
    const jid = msg.key.remoteJid;
    const botName = activeSettings.botName || "Rizzer Bot";

    if (showAll || !targetCategory) {
      const body = renderMenu({
        botName,
        prefix,
        role,
        totalCmds,
        categories,
        catKeys,
        targetCategory: null,
      }).trim();

      // Satu perintah = satu pesan. Sebelumnya menu lengkap dikirim lalu
      // disusul kartu navigasi kedua dengan header + tombol yang sama,
      // sehingga hasilnya terlihat dobel.
      if (shouldUseInteractive(body)) {
        const image = await resolveMenuImage(activeSettings);
        try {
          return await sock.sendMessage(
            jid,
            {
              interactiveMessage: {
                title: body,
                footer: `Total: ${totalCmds} perintah • ${prefix}menu all = semua`,
                buttons: buildMenuButtons(catKeys, prefix),
                ...(image ? { image } : {}),
              },
            },
            { quoted: msg }
          );
        } catch (_) {
          const imagePayload = await resolveImagePayload(activeSettings);
          return await sendWithImage(sock, jid, imagePayload, body, msg);
        }
      }

      const imagePayload = await resolveImagePayload(activeSettings);
      return await sendWithImage(sock, jid, imagePayload, body, msg);
    }

    const body = renderMenu({ botName, prefix, role, totalCmds, categories, catKeys, targetCategory }).trim();
    if (shouldUseInteractive(body)) {
      const image = await resolveMenuImage(activeSettings);
      const im = {
        title: body,
        footer: `${targetCategory} • ${prefix}menu = kembali`,
        buttons: buildMenuButtons(catKeys, prefix),
      };
      if (image) im.image = image;
      try {
        return await sock.sendMessage(jid, { interactiveMessage: im }, { quoted: msg });
      } catch (_) {}
    }
    const imagePayload = await resolveImagePayload(activeSettings);
    await sendWithImage(sock, jid, imagePayload, body, msg);
  },
};
