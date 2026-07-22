import { settings } from "@/config/settings.js";
import { db } from "@/lib/database.js";

function getHeader(title) {
  return `╭─── . ݁₊ ⊹ *${title}* ⊹ ₊ ݁.`;
}

export function getMenu(senderName = "User") {
  const activePrefix = db.data.settings.prefix || settings.prefix;
  return `
Welcome ${senderName} back to 𝐊𝐲𝐫𝐨𝐬-𝐌𝐃 

╭─── . ݁₊ ⊹ *List Menu* ⊹ ₊ ݁.
│ ${activePrefix}usermenu
│ ${activePrefix}premiummenu
│ ${activePrefix}ownermenu
╰──────────────

💡 *Tips:* Ketik salah satu perintah di atas untuk melihat menu secara detail.
`.trim();
}

export function getUserMenu() {
  const activePrefix = db.data.settings.prefix || settings.prefix;
  return `
${getHeader("User Menu")}
│ ${activePrefix}help
│ ${activePrefix}usermenu
│ ${activePrefix}ping
│ ${activePrefix}register
│ ${activePrefix}donate
│ ${activePrefix}developer
│ ${activePrefix}cek-npsn <npsn>
╰──────────────
`.trim();
}

export function getPremiumMenu() {
  const activePrefix = db.data.settings.prefix || settings.prefix;
  return `
${getHeader("Premium Menu")}
│
├─  *Downloader*
│ ${activePrefix}instagram <link>
│ ${activePrefix}tiktok <link>
│ ${activePrefix}youtube <link>
│ ${activePrefix}sw <balas status>
│
├─  *Media / Tools*
│ ${activePrefix}sticker
│ ${activePrefix}brat <teks>
│ ${activePrefix}bratvid <teks>
│ ${activePrefix}chatmaker <teks>
│ ${activePrefix}kolase
│ ${activePrefix}addkolase
│ ${activePrefix}cancelkolase
│ ${activePrefix}confess
│ ${activePrefix}qr <teks>
│ ${activePrefix}react <emoji>
│ ${activePrefix}ss <url>
│ ${activePrefix}trx
│ ${activePrefix}delete
│ ${activePrefix}edit
│ ${activePrefix}rvo <balas media sekali lihat>
│
├─  *OSINT / Informasi*
│ ${activePrefix}cekpkl <nomor>
│ ${activePrefix}github <username>
│ ${activePrefix}iplookup <ip>
│ ${activePrefix}jkt84 <nama member>
│ ${activePrefix}nik <nik>
│ ${activePrefix}numberlookup <nomor>
│ ${activePrefix}whois <domain>
╰──────────────
`.trim();
}

export function getOwnerMenu() {
  const activePrefix = db.data.settings.prefix || settings.prefix;
  return `
${getHeader("Owner Menu")}
│
├─  *System / Bot Control*
│ ${activePrefix}addbot
│ ${activePrefix}delbot
│ ${activePrefix}listbot
│ ${activePrefix}addadmin
│ ${activePrefix}deladmin
│ ${activePrefix}listadmin
│ ${activePrefix}addprem
│ ${activePrefix}delprem
│ ${activePrefix}ban
│ ${activePrefix}unban
│ ${activePrefix}block
│ ${activePrefix}unblock
│ ${activePrefix}listuser
│ ${activePrefix}deluser
│ ${activePrefix}getdb
│ ${activePrefix}resetdb
│ ${activePrefix}shutdown
│ ${activePrefix}stats
│ ${activePrefix}self
│ ${activePrefix}public
│ ${activePrefix}setprefix
│ ${activePrefix}setbotname
│ ${activePrefix}setownername
│ ${activePrefix}maintenance
│ ${activePrefix}broadcast
│ ${activePrefix}addplugin
│
├─  *Group Control*
│ ${activePrefix}add
│ ${activePrefix}delmember
│ ${activePrefix}promote
│ ${activePrefix}demote
│ ${activePrefix}group
│ ${activePrefix}groupinfo
│ ${activePrefix}linkgc
│ ${activePrefix}revoke
│ ${activePrefix}setname
│ ${activePrefix}setdesc
│ ${activePrefix}tagall
│ ${activePrefix}hidetag
│ ${activePrefix}antilink
│ ${activePrefix}antibot
│ ${activePrefix}jagagrup
│
├─  *Marketing*
│ ${activePrefix}jpm
│ ${activePrefix}pushkontak
╰──────────────
`.trim();
}
