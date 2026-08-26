import { settings } from "@/config/settings.js";
import { db } from "@/src/core/database.js";
import { commands as defaultCommandsMap } from "@/src/core/loader.js";

function getHeader(title) {
  return `╭─── . ݁₊ ⊹ *${title}* ⊹ ₊ ݁.`;
}

export function buildDynamicMenuCategory(categoryName, commandsMap = defaultCommandsMap, filterFn) {
  const activePrefix = db.data.settings?.prefix || settings.prefix;
  const list = [];
  const map = commandsMap || defaultCommandsMap;

  if (map) {
    for (const [key, cmd] of map.entries()) {
      if (cmd && cmd.name && cmd.name.toLowerCase() === key) {
        const catMatches = (cmd.category || "Utilities").toLowerCase() === categoryName.toLowerCase();
        const matchesFilter = filterFn ? filterFn(cmd) : true;
        if (catMatches && matchesFilter) {
          list.push(cmd);
        }
      }
    }
  }

  if (list.length === 0) return "";

  let res = `├─  *${categoryName}*\n`;
  for (const cmd of list) {
    const usage = cmd.usage ? ` ${cmd.usage}` : "";
    res += `│ ${activePrefix}${cmd.name}${usage}\n`;
  }
  return res + "│\n";
}

export function getMenu(senderName = settings.ownerName) {
  const activePrefix = db.data.settings?.prefix || settings.prefix;
  const botName = settings.botName;

  return `
Welcome ${senderName} back to ${botName} 

╭─── . ݁₊ ⊹ *List Menu* ⊹ ₊ ݁.
│ ${activePrefix}usermenu
│ ${activePrefix}premiummenu
│ ${activePrefix}ownermenu
│ ${activePrefix}plugins
╰──────────────

💡 *Tips:* Ketik salah satu perintah di atas untuk melihat menu secara detail.
`.trim();
}

export function getUserMenu(commandsMap = defaultCommandsMap) {
  const map = commandsMap || defaultCommandsMap;
  const userCategoryText = buildDynamicMenuCategory("User", map);
  if (userCategoryText) {
    return `${getHeader("User Menu")}\n│\n${userCategoryText}╰──────────────`.trim();
  }

  const activePrefix = db.data.settings?.prefix || settings.prefix;
  return `
${getHeader("User Menu")}
│ ${activePrefix}help
│ ${activePrefix}usermenu
│ ${activePrefix}ping
│ ${activePrefix}register
│ ${activePrefix}donate
│ ${activePrefix}developer
╰──────────────
`.trim();
}

export function getPremiumMenu(commandsMap = defaultCommandsMap) {
  const map = commandsMap || defaultCommandsMap;
  const dlText = buildDynamicMenuCategory("Downloader", map);
  const mediaText = buildDynamicMenuCategory("Media", map);
  const osintText = buildDynamicMenuCategory("OSINT", map);

  let body = "";
  if (dlText) body += dlText;
  if (mediaText) body += mediaText;
  if (osintText) body += osintText;

  if (body) {
    return `${getHeader("Premium Menu")}\n│\n${body}╰──────────────`.trim();
  }

  const activePrefix = db.data.settings?.prefix || settings.prefix;
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
│ ${activePrefix}plugins
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
│ ${activePrefix}jkt48 <nama member>
│ ${activePrefix}nik <nik>
│ ${activePrefix}numberlookup <nomor>
│ ${activePrefix}whois <domain>
╰──────────────
`.trim();
}

export function getOwnerMenu(commandsMap = defaultCommandsMap) {
  const map = commandsMap || defaultCommandsMap;
  const ownerCatText = buildDynamicMenuCategory("Owner", map);
  if (ownerCatText) {
    return `${getHeader("Owner Menu")}\n│\n${ownerCatText}╰──────────────`.trim();
  }

  const activePrefix = db.data.settings?.prefix || settings.prefix;
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

export function getPluginsMenu(commandsMap = defaultCommandsMap) {
  const activePrefix = db.data.settings?.prefix || settings.prefix;
  const map = commandsMap || defaultCommandsMap;
  const categories = {};

  if (map) {
    for (const [name, cmd] of map.entries()) {
      if (cmd && cmd.name && cmd.name.toLowerCase() === name) {
        const cat = cmd.category || "Utilities";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd);
      }
    }
  }

  let text = `${getHeader("Plugins Menu")}\n│\n`;
  for (const [cat, cmds] of Object.entries(categories)) {
    text += `├─  *${cat}*\n`;
    for (const cmd of cmds) {
      const usage = cmd.usage ? ` ${cmd.usage}` : "";
      text += `│ ${activePrefix}${cmd.name}${usage}\n`;
    }
    text += "│\n";
  }
  text += "╰──────────────";
  return text.trim();
}
