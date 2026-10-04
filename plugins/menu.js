import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";

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

    // 1. Cek apakah user meminta kategori tertentu (misal: .menu owner, .menu premium, .menu user)
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

    // 2. Jika user meminta bantuan spesifik satu command (misal: .help tiktok atau .menu jkt48)
    if (rawArg && !targetCategory) {
      const targetCmd = commands.get(rawArg);
      // Sembunyikan command yang tak boleh dipakai role ini (anti-intip command premium/owner).
      // Orang asing (tak terdaftar): grup-gated pun disembunyikan, mereka hanya boleh yang publik.
      if (targetCmd) {
        const hiddenForStranger = !isOwner && !isAdmin && !isPremium &&
          (targetCmd.groupOnly || targetCmd.groupAdminOnly || targetCmd.botAdminOnly);
        if ((targetCmd.ownerOnly && !isOwner) || (targetCmd.adminOnly && !isAdmin) || (targetCmd.premiumOnly && !isPremium) || hiddenForStranger) {
          return await reply(`❌ *${rawArg}* tidak ditemukan.\n\nKetik ${prefix}menu untuk daftar perintah.`);
        }
        // Sumber kebenaran: field `usage` di masing-masing file plugin
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

    // 3. Bangun kategori perintah
    const categories = {};
    const seen = new Set();

    commands.forEach((cmd) => {
      if (seen.has(cmd.name)) return;
      seen.add(cmd.name);

      // Tampilkan hanya command yang boleh dipakai role pengirim (seperti listplugins).
      // Orang asing: hanya command publik (tanpa gate apapun) yang terlihat.
      if (cmd.ownerOnly && !isOwner) return;
      if (cmd.adminOnly && !isAdmin) return;
      if (cmd.premiumOnly && !isPremium) return;
      if (!isOwner && !isAdmin && !isPremium && (cmd.groupOnly || cmd.groupAdminOnly || cmd.botAdminOnly)) return;

      const cat = cmd.category || "General";

      // Filter jika user memilih kategori tertentu
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
    let menuText = "";

    // .menu = cuma list kategori, berformat: * <Nama> — .menu <nama>
    if (!rawArg) {
      menuText += `*${activeSettings.botName || "Rizzer Bot"}* [${prefix}]\n\n`;
      for (const cat of catKeys) {
        menuText += `* ${cat} — ${prefix}menu ${cat.toLowerCase()}\n`;
      }
      menuText += `\nContoh: ${prefix}menu ai`;
    } else if (targetCategory) {
      // .menu <kategori> = list perintah kategori ke bawah (baris per baris)
      const cat = catKeys[0];
      const listCmds = categories[cat].map((c) => `* ${prefix}${c.name}`).join("\n");
      menuText += `*${cat.toUpperCase()} (${categories[cat].length})*\n\n${listCmds}\n\nKetik ${prefix}menu <nama> untuk panduan`;
    } else if (showAll) {
      // .menu all = semua kategori inline (khusus yang butuh)
      menuText += `*${activeSettings.botName || "WhatsApp Bot"}* [${prefix}] • ${role}\n`;
      menuText += `_Total ${totalCmds} perintah_\n\n`;
      for (const cat of catKeys) {
        menuText += `*${cat.toUpperCase()} (${categories[cat].length}):*\n`;
        menuText += categories[cat].map((c) => `${prefix}${c.name}`).join(", ") + `\n\n`;
      }
      menuText += `_Ketik ${prefix}menu <nama> untuk panduan_`;
    } else {
      // arg tidak dikenal → balas list kategori + hint
      menuText += `❌ *${rawArg}* tidak ditemukan.\n\n`;
      menuText += `*${activeSettings.botName || "WhatsApp Bot"}* [${prefix}]\n`;
      menuText += `${totalCmds} perintah • ${catKeys.length} kategori\n\n`;
      for (const cat of catKeys) {
        menuText += `• *${cat}* (${categories[cat].length}) — ${prefix}menu ${cat.toLowerCase()}\n`;
      }
    }

    const finalCaption = menuText.trim();

    // Coba kirim dengan gambar jika file lokal atau URL gambar tersedia
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

      // Fallback otomatis jika ada file banner di folder assets/image/
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
