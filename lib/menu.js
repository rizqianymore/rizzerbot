import { commands } from '@/lib/plugins.js';
import { settings } from '@/config/settings.js';
import { db } from '@/lib/database.js';
import { getUptimeString } from '@/lib/utils.js';

function getHeader() {
    return '';
}

export function getMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    return `
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
    const seen = new Set();
    const list = [];
    for (const cmd of commands.values()) {
        if (cmd && cmd.name && !seen.has(cmd.name)) {
            seen.add(cmd.name);
            if (!cmd.ownerOnly && !cmd.premiumOnly) {
                list.push(cmd);
            }
        }
    }
    list.sort((a, b) => a.name.localeCompare(b.name));

    let menu = `${getHeader()}\n\n╭─── . ݁₊ ⊹ *User Menu* ⊹ ₊ ݁.\n`;
    for (const cmd of list) {
        const usage = cmd.usage ? ` ${cmd.usage}` : '';
        menu += `│ ${activePrefix}${cmd.name}${usage}\n`;
    }
    menu += `╰──────────────`;
    return menu.trim();
}

export function getPremiumMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    const seen = new Set();
    const list = [];
    for (const cmd of commands.values()) {
        if (cmd && cmd.name && !seen.has(cmd.name)) {
            seen.add(cmd.name);
            if (cmd.premiumOnly && !cmd.ownerOnly) {
                list.push(cmd);
            }
        }
    }
    list.sort((a, b) => a.name.localeCompare(b.name));

    let menu = `${getHeader()}\n\n╭─── . ݁₊ ⊹ *Premium Menu* ⊹ ₊ ݁.\n`;
    for (const cmd of list) {
        const usage = cmd.usage ? ` ${cmd.usage}` : '';
        menu += `│ ${activePrefix}${cmd.name}${usage}\n`;
    }
    menu += `╰──────────────`;
    return menu.trim();
}

export function getOwnerMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    const seen = new Set();
    const list = [];
    for (const cmd of commands.values()) {
        if (cmd && cmd.name && !seen.has(cmd.name)) {
            seen.add(cmd.name);
            if (cmd.ownerOnly) {
                list.push(cmd);
            }
        }
    }
    list.sort((a, b) => a.name.localeCompare(b.name));

    let menu = `${getHeader()}\n\n╭─── . ݁₊ ⊹ *Owner Menu* ⊹ ₊ ݁.\n`;
    for (const cmd of list) {
        const usage = cmd.usage ? ` ${cmd.usage}` : '';
        menu += `│ ${activePrefix}${cmd.name}${usage}\n`;
    }
    menu += `╰──────────────`;
    return menu.trim();
}

export function getPluginsMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;

    
    const pluginCmds = {};
    const seen = new Set();

    
    const hardcodedCommands = new Set([
        'help', 'menu', 'plugins', 'pluginmenu', 'pl', 'usermenu', 'premiummenu', 'ownermenu',
        'register', 'daftar', 'ping', 'owner', 'runtime', 'uptime', 'checkuser', 'profile', 'me',
        'jkt84', 'jkt48', 'memberjkt', 'numberlookup', 'lookup', 'checknum',
        'pushkontak', 'jpm', 'jpmch', 'addjpmch', 'deljpmch', 'listjpmch', 'checkdb',
        'addjpmblacklist', 'addjpmbl', 'deljpmblacklist', 'deljpmbl', 'listjpmblacklist', 'listjpmbl',
        'developer', 'dev', 'creator',
        'sticker', 's', 'stiker', 'ssweb', 'tiktok', 'youtube', 'instagram', 'spotify', 'twitter', 'webshot',
        'collage', 'rvo', 'qc', 'qr', 'statusdownloader', 'brat', 'bratvid', 'donate', 'donasi', 'sawer',
        'self', 'public', 'maintenance', 'addprem', 'delprem', 'ban', 'unban', 'addadmin', 'deladmin', 'listadmin', 'admins',
        'setprefix', 'broadcast', 'bc', 'addbot', 'delbot', 'listbot', 'stats', 'exportstatus', 'block', 'unblock',
        'kickall', 'getdb', 'resetdb', 'setbotname', 'setownername', 'shutdown', 'antilink', 'antibot', 'jagagrup',
        'hidetag', 'ht', 'tagall', 'delmember', 'add', 'promote', 'demote', 'group', 'groupinfo', 'linkgc', 'revoke',
        'setname', 'setdesc', 'follow', 'getbio', 'listuser', 'listusers', 'daftaruser'
    ]);

    for (const cmd of commands.values()) {
        if (seen.has(cmd.name)) continue;
        seen.add(cmd.name);

        
        if (hardcodedCommands.has(cmd.name)) continue;
        if (cmd.aliases && cmd.aliases.some(alias => hardcodedCommands.has(alias))) continue;

        if (cmd.filePath) {
            const cat = cmd.category || 'Plugins';
            if (!pluginCmds[cat]) {
                pluginCmds[cat] = [];
            }
            pluginCmds[cat].push(cmd);
        }
    }

    if (Object.keys(pluginCmds).length === 0) {
        return `*🤖 ${settings.botName} — Plugins Menu*\n\n❌ Tidak ada plugin eksternal yang aktif saat ini.`;
    }

    let menuText = `*🤖 ${settings.botName} — Plugins Menu*\n` +
                   `🎯 *Prefix:* [ ${activePrefix} ]\n\n`;

    const sortedCats = Object.keys(pluginCmds).sort();
    sortedCats.forEach(cat => {
        
        const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        menuText += `╭─── . ݁₊ ⊹ *${displayCat} Menu* ⊹ ₊ ݁.\n`;
        const cmds = pluginCmds[cat];
        cmds.forEach((cmd) => {
            const usage = cmd.usage ? ` ${cmd.usage}` : '';
            menuText += `│ ${activePrefix}${cmd.name}${usage}\n`;
        });
        menuText += `╰──────────────\n\n`;
    });

    return menuText.trim();
}
