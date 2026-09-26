import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";

// Panduan contoh penggunaan untuk masing-masing command
const COMMAND_USAGES = {
  // News
  cnn: "<topik berita>",
  inews: "<topik / link berita>",
  kompastv: "[topik / link / jumlah]",

  // Social Media
  tiktok: "<url> [mp3]",
  igdl: "<url>",
  ytdlpro: "<url> [mp3]",

  // AI
  deepseek: "<pertanyaan> [--think / --search]",
  duckduckgo: "<pertanyaan> [--claude / --mistral]",

  // Sticker
  brat: "<teks> [--green]",
  bratvid: "<teks>",
  bratgojo: "<teks>",
  bratgojovid: "<teks>",
  bratvermeil: "<teks>",
  bratvermeilvid: "<teks>",

  // Tools
  jkt48: "<nama/id member>",
  jkt48news: "[jumlah berita]",
  jkt48schedule: "[tanggal/kode show]",
  jkt48theater: "",
  jkt48showroom: "",
  rvo: "(reply media view once)",
  bloombergstock: "<kode ticker / GC1:COM / saham>",
  dnslookup: "<domain>",
  whois: "<domain>",
  subdomainlookup: "<domain>",
  ipgeo: "<ip / domain>",
  pinterest: "<kata kunci>",
  image: "<kata kunci>",
  listplugins: "",

  // Group
  hidetag: "<pesan>",
  tagall: "[pesan]",
  kick: "@user",
  add: "628xxx",
  promote: "@user",
  demote: "@user",
  group: "<open / close>",
  linkgroup: "",
  revoke: "",
  setname: "<nama baru>",
  setdesc: "<deskripsi baru>",
  infogrup: "",
  listadmin: "",
  antilink: "<on / off>",

  // User
  ping: "",
  owner: "",
  uptime: "",
  quote: "",
  sticker: "[teks atas | bawah] (reply/kirim gambar)",
  stiker: "[teks atas | bawah] (reply/kirim gambar)",
  toimg: "(reply stiker)",
  lyrics: "<judul lagu>",
  translate: "[kode_bahasa] <teks>",
  report: "<isi pesan laporan>",
  profile: "[@user / nomor / reply]",

  // Premium
  hd: "(reply gambar)",
  tts: "<teks>",
  stickernowm: "[teks atas | bawah] (reply gambar)",
  aipro: "<prompt>",
  customprofile: "<teks bio>",
  statspro: "",
  searchpro: "<query>",
  animepro: "<judul anime>",

  // Owner
  eval: "<kode js>",
  addowner: "<nomor>",
  delowner: "<nomor>",
  listowner: "",
  addadmin: "<nomor>",
  deladmin: "<nomor>",
  listadmin: "",
  addprem: "<nomor> [hari]",
  delprem: "<nomor>",
  listprem: "",
  access: "[nomor]",
  broadcast: "<pesan>",
  setprefix: "<simbol>",
  block: "<nomor>",
  unblock: "<nomor>",
  join: "<link group>",
  leave: "",
  self: "",
  public: "",
  addbot: "<nomor whatsapp>",
  listbot: "",
  delbot: "<nomor bot>",
  botstatus: "",
  cleartmp: "",
  restart: "",
};

export default {
  name: "menu",
  aliases: ["help", "panduan"],
  description: "Menampilkan daftar seluruh perintah dan panduan cara penggunaannya.",
  category: "General",
  run: async (sock, msg, args, { reply, sendTyping, isOwner, isAdmin, isPremium, prefix }) => {
    await sendTyping();

    const activeSettings = db.getSettings();
    let rawArg = args[0]?.toLowerCase() || "";
    if (rawArg.startsWith(prefix)) rawArg = rawArg.slice(prefix.length);

    // 1. Cek apakah user meminta kategori tertentu (misal: .menu owner, .menu premium, .menu user)
    const categoryAliases = {
      owner: "Owner",
      own: "Owner",
      creator: "Owner",
      prem: "Premium",
      premium: "Premium",
      pro: "Premium",
      user: "User",
      usr: "User",
      pengguna: "User",
      group: "Group",
      grup: "Group",
      grub: "Group",
      gc: "Group",
      tools: "Tools",
      tool: "Tools",
      alat: "Tools",
      sticker: "Sticker",
      stiker: "Sticker",
      ai: "AI",
      socialmedia: "Social Media",
      socmed: "Social Media",
      sosmed: "Social Media",
      news: "News",
      berita: "News",
    };

    const targetCategory = rawArg ? categoryAliases[rawArg] : null;

    // 2. Jika user meminta bantuan spesifik satu command (misal: .help tiktok atau .menu jkt48)
    if (rawArg && !targetCategory) {
      const targetCmd = commands.get(rawArg);
      if (targetCmd) {
        const usage = COMMAND_USAGES[targetCmd.name] ? ` *${prefix}${targetCmd.name} ${COMMAND_USAGES[targetCmd.name]}*` : ` *${prefix}${targetCmd.name}*`;
        const aliases = targetCmd.aliases && targetCmd.aliases.length > 0 ? targetCmd.aliases.map((a) => `*${prefix}${a}*`).join(", ") : "-";

        const detailText =
          `*Panduan Perintah: ${prefix}${targetCmd.name}*\n\n` +
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

      if (cmd.ownerOnly && !isOwner) return;
      if (cmd.adminOnly && !isAdmin) return;
      if (cmd.premiumOnly && !isPremium) return;

      const cat = cmd.category || "General";

      // Filter jika user memilih kategori tertentu
      if (targetCategory && cat.toLowerCase() !== targetCategory.toLowerCase()) {
        return;
      }

      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    });

    if (targetCategory && Object.keys(categories).length === 0) {
      if (targetCategory === "Owner" && !isOwner) {
        return reply("❌ Kategori *Owner* hanya dapat diakses oleh Pemilik Bot!");
      }
      return reply(`❌ Kategori *${rawArg}* tidak ditemukan atau tidak tersedia.`);
    }

    let menuText = `*${activeSettings.botName}*\n`;
    menuText += `• Prefix : [ *${prefix}* ]\n`;
    menuText += `• Status : *${isOwner ? "Owner" : isAdmin ? "Admin" : isPremium ? "Premium" : "Free User"}*\n`;
    if (targetCategory) {
      menuText += `• Kategori : *${targetCategory}*\n`;
    }
    // 4. Tampilkan Top 10 Fitur Terpopuler jika menu utama (bukan kategori)
    if (!targetCategory) {
      const usage = db.data?.usage || {};
      const sortedUsage = Object.entries(usage)
        .filter(([name]) => commands.has(name))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Jika belum ada record usage, ambil 10 command populer default
      const topList = sortedUsage.length > 0
        ? sortedUsage.map(([name, count], i) => `│ ${i + 1}. *${prefix}${name}* _(${count}x)_`)
        : ["sticker", "tiktok", "igdl", "ytdlpro", "deepseek", "brat", "jkt48", "kompastv", "ping", "profile"]
            .filter((c) => commands.has(c))
            .map((name, i) => `│ ${i + 1}. *${prefix}${name}*`);

      menuText += `🔥 *10 FITUR TERPOPULER*\n`;
      menuText += topList.join("\n") + "\n\n";
    }

    const order = ["News", "Social Media", "AI", "Sticker", "Tools", "Group", "User", "Premium", "Owner", "General"];
    const catKeys = Object.keys(categories).sort((a, b) => {
      const ia = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
      const ib = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
      return ia - ib;
    });

    for (const cat of catKeys) {
      menuText += `┌───「 *${cat}* 」\n`;
      for (const cmd of categories[cat]) {
        menuText += `│ • ${prefix}${cmd.name}\n`;
      }
      menuText += `└───\n\n`;
    }

    if (!targetCategory) {
      menuText += `💡 *Pilihan Kategori Menu:*\n`;
      menuText += `• ${prefix}menu news\n`;
      menuText += `• ${prefix}menu socmed\n`;
      menuText += `• ${prefix}menu ai\n`;
      menuText += `• ${prefix}menu sticker\n`;
      menuText += `• ${prefix}menu tools\n`;
      menuText += `• ${prefix}menu group\n`;
      menuText += `• ${prefix}menu user\n`;
      menuText += `• ${prefix}menu premium\n`;
      if (isOwner) {
        menuText += `• ${prefix}menu owner\n`;
      }
      menuText += `\n_Ketik *${prefix}help <command>* untuk info detail fitur._`;
    } else {
      menuText += `_Ketik *${prefix}menu* untuk melihat seluruh daftar menu._`;
    }

    const finalCaption = menuText.trim();

    // Coba kirim dengan gambar jika file lokal atau URL gambar tersedia
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
