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
  claudehaiku: "<pertanyaan>",

  // Sticker
  brat: "<teks> [--green]",
  bratvid: "<teks>",
  bratgojo: "<teks>",
  bratgojovid: "<teks>",
  bratvermeil: "<teks>",
  bratvermeilvid: "<teks>",
  stikerteks: "[teks atas | bawah] (kirim/reply gambar)",
  stikermeme: "[teks atas | bawah] (kirim/reply gambar)",

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
  trx: "<barang> | <harga> | <buyer> | [metode]",
  cektrx: "<id_trx>",
  settrx: "<id_trx> <status>",
  listtrx: "[jumlah]",
  deltrx: "<id_trx>",
  qris: "[nominal / bebas]",

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
  setch: "<jid/link saluran>",
  delch: "",
  infoch: "",
  autotrxch: "<on / off>",
  postch: "<pesan>",
  setqris: "<string qris>",
  botstatus: "",
  cleartmp: "",
  restart: "",
};

export default {
  name: "menu",
  aliases: ["help", "panduan"],
  description: "Menampilkan daftar seluruh perintah dan panduan cara penggunaannya.",
  usage: "[command / kategori]",
  category: "General",
  run: async (sock, msg, args, { reply, sendTyping, isOwner, isAdmin, isPremium, prefix, activeSettings: ctxSettings }) => {
    await sendTyping();

    const activeSettings = ctxSettings || db.getSettings();
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
        // Sumber kebenaran: field `usage` di masing-masing file plugin.
        // COMMAND_USAGES di atas hanya fallback kompatibilitas (misal alias lama).
        const usageArgs = targetCmd.usage ?? COMMAND_USAGES[targetCmd.name] ?? "";
        const usage = usageArgs ? ` *${prefix}${targetCmd.name} ${usageArgs}*` : ` *${prefix}${targetCmd.name}*`;
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

    let menuText = `*${activeSettings.botName || "WhatsApp Bot"}*\n`;
    menuText += `Prefix: [ ${prefix} ] • Status: ${isOwner ? "Owner" : isAdmin ? "Admin" : isPremium ? "Premium" : "User"}\n\n`;

    const order = ["News", "Social Media", "AI", "Sticker", "Tools", "Group", "User", "Premium", "Owner", "General"];
    const catKeys = Object.keys(categories).sort((a, b) => {
      const ia = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
      const ib = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
      return ia - ib;
    });

    // List polos ke bawah: semua perintah tanpa penjelasan.
    // (.menu = semua kategori, .menu <kategori> = filter 1 kategori)
    let totalCmds = 0;
    for (const cat of catKeys) {
      menuText += `*${cat.toUpperCase()}:*\n`;
      for (const cmd of categories[cat]) {
        menuText += `• ${prefix}${cmd.name}\n`;
        totalCmds++;
      }
      menuText += `\n`;
    }
    menuText += `_Total: ${totalCmds} perintah._`;

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
