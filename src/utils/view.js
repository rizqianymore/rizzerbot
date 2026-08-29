import fs from "fs";
import path from "path";
import { settings } from "@/config/settings.js";
import { db } from "@/src/core/database.js";
import { commands as defaultCommandsMap } from "@/src/core/loader.js";

export function getMenuBanner() {
  const imgPath = settings.linkImage || settings.image;
  if (!imgPath) return null;
  if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
    return { url: imgPath };
  }
  const resolvedPath = path.resolve(process.cwd(), imgPath);
  if (fs.existsSync(resolvedPath)) {
    return { url: resolvedPath };
  }
  const relativePath = path.join(process.cwd(), imgPath);
  if (fs.existsSync(relativePath)) {
    return { url: relativePath };
  }
  return null;
}

export async function sendMenuMessage(sock, msg, menuText) {
  const bannerImage = getMenuBanner();
  if (bannerImage) {
    return await sock.sendMessage(
      msg.key.remoteJid,
      { image: bannerImage, caption: menuText },
      { quoted: msg }
    );
  }
  return await sock.sendMessage(
    msg.key.remoteJid,
    { text: menuText },
    { quoted: msg }
  );
}

function getHeader(title) {
  return `╭─── . ݁₊ ⊹ *${title}* ⊹ ₊ ݁.`;
}

export function buildDynamicMenuCategory(categoryName, commandsMap = defaultCommandsMap, filterFn) {
  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  const list = [];
  const map = commandsMap || defaultCommandsMap;
  const seen = new Set();

  if (map) {
    for (const [key, cmd] of map.entries()) {
      if (cmd && cmd.name && cmd.name.toLowerCase() === key && !seen.has(cmd.name)) {
        const catMatches = (cmd.category || "Utilities").toLowerCase() === categoryName.toLowerCase();
        const matchesFilter = filterFn ? filterFn(cmd) : true;
        if (catMatches && matchesFilter) {
          seen.add(cmd.name);
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
  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  const botName = settings.botName || "Kyros-MD";

  return `
Halo *${senderName}*, selamat datang di *${botName}*

╭─── . ݁₊ ⊹ *Daftar Menu* ⊹ ₊ ݁.
│ ${activePrefix}usermenu
│ ${activePrefix}premiummenu
│ ${activePrefix}ownermenu
│ ${activePrefix}plugins
╰──────────────

💡 *Tips:* Ketik salah satu perintah di atas untuk melihat detail fitur.
`.trim();
}

export function getUserMenu(commandsMap = defaultCommandsMap) {
  const map = commandsMap || defaultCommandsMap;
  const userCategoryText = buildDynamicMenuCategory("User", map);
  if (userCategoryText) {
    return `${getHeader("User Menu")}\n│\n${userCategoryText}╰──────────────`.trim();
  }

  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  return `
${getHeader("User Menu")}
│
├─  *User*
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
  const aiText = buildDynamicMenuCategory("AI", map);
  const dlText = buildDynamicMenuCategory("Downloader", map);
  const mediaText = buildDynamicMenuCategory("Media", map);
  const toolsText = buildDynamicMenuCategory("Tools", map);
  const osintText = buildDynamicMenuCategory("OSINT", map);

  let body = "";
  if (aiText) body += aiText;
  if (dlText) body += dlText;
  if (mediaText) body += mediaText;
  if (toolsText) body += toolsText;
  if (osintText) body += osintText;

  if (body) {
    return `${getHeader("Premium Menu")}\n│\n${body}╰──────────────`.trim();
  }

  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  return `
${getHeader("Premium Menu")}
│
├─  *AI*
│ ${activePrefix}qwen3 <pertanyaan>
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
│ ${activePrefix}confess
│ ${activePrefix}qr <teks>
│ ${activePrefix}ss <url>
│ ${activePrefix}rvo <balas media sekali lihat>
│
├─  *OSINT / Intel*
│ ${activePrefix}cctvlantas <lokasi/id>
│ ${activePrefix}github <username>
│ ${activePrefix}iplookup <ip>
│ ${activePrefix}whois <domain>
│ ${activePrefix}numberlookup <nomor>
╰──────────────
`.trim();
}

export function getOwnerMenu(commandsMap = defaultCommandsMap) {
  const map = commandsMap || defaultCommandsMap;
  const ownerCatText = buildDynamicMenuCategory("Owner", map);
  if (ownerCatText) {
    return `${getHeader("Owner Menu")}\n│\n${ownerCatText}╰──────────────`.trim();
  }

  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  return `
${getHeader("Owner Menu")}
│
├─  *Owner*
│ ${activePrefix}mode <self/maint/onlygc/onlypc/antispam>
│ ${activePrefix}admin <add/remove/list>
│ ${activePrefix}premium <add/remove/list>
│ ${activePrefix}limited <add/remove/list>
│ ${activePrefix}user <ban/unban/register/unregister/list>
│ ${activePrefix}cctv <snap/video/list/alias>
│ ${activePrefix}bot <add/stop/del/list/status>
│ ${activePrefix}addplugin <nama>
╰──────────────
`.trim();
}

export function getPluginsMenu(commandsMap = defaultCommandsMap) {
  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  const map = commandsMap || defaultCommandsMap;
  const categories = {};
  const seen = new Set();

  if (map) {
    for (const [name, cmd] of map.entries()) {
      if (cmd && cmd.name && cmd.name.toLowerCase() === name && !seen.has(cmd.name)) {
        seen.add(cmd.name);
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
