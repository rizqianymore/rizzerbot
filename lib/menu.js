import { commands } from '@/lib/plugins.js';
import { settings } from '@/config/settings.js';
import { db } from '@/lib/database.js';

function getHeader() {
    const activePrefix = db.data.settings.prefix || settings.prefix;

    // 1. Calculate dynamic uptime
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    let uptimeString = '';
    if (hours > 0) uptimeString += `${hours} jam `;
    if (minutes > 0 || hours > 0) uptimeString += `${minutes} menit `;
    uptimeString += `${seconds} detik`;

    // 2. Fetch db stats
    const userCount = Object.keys(db.data.users).filter(k => db.data.users[k].registered).length;
    const totalHits = db.data.stats.totalCommands || 0;

    return `
*${settings.botName}*
*Owner:* ${settings.ownerName}
*Prefix:* [ ${activePrefix} ]
*Uptime:* ${uptimeString}
*Pengguna:* ${userCount} terdaftar
*Hits:* ${totalHits} kali dipanggil
`.trim();
}

export function getMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    return `
╭─── . ݁₊ ⊹ *List Menu* ⊹ ₊ ݁.
│ ${activePrefix}usermenu
│ ${activePrefix}premiummenu
│ ${activePrefix}ownermenu
╰──────────────────

💡 *Tips:* Ketik salah satu perintah di atas untuk melihat menu secara detail.
`.trim();
}

export function getUserMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    return `
${getHeader()}

╭─── . ݁₊ ⊹ *User Menu* ⊹ ₊ ݁.
│ ${activePrefix}help
│ ${activePrefix}ping
│ ${activePrefix}register <nama>
│ ${activePrefix}donate
╰──────────────────
`.trim();
}

export function getPremiumMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    return `
${getHeader()}

╭─── . ݁₊ ⊹ *Premium Menu* ⊹ ₊ ݁.
│ ${activePrefix}ai <pertanyaan>
│ ${activePrefix}pushkontak <teks>
│ ${activePrefix}jpm <teks>
│ ${activePrefix}jpmch <teks>
│ ${activePrefix}addjpmch <link/JID>
│ ${activePrefix}deljpmch <JID>
│ ${activePrefix}listjpmch
│ ${activePrefix}checkdb
│ ${activePrefix}sticker <balas media>
│ ${activePrefix}brat <teks>
│ ${activePrefix}bratvid <teks>
│ ${activePrefix}ssweb <link>
│ ${activePrefix}tiktok <link>
│ ${activePrefix}youtube <link>
│ ${activePrefix}instagram <link>
│ ${activePrefix}spotify <judul>
│ ${activePrefix}twitter <link>
│ ${activePrefix}webshot <link>
│ ${activePrefix}collage <balas media>
│ ${activePrefix}rvo
│ ${activePrefix}qc <teks>
│ ${activePrefix}qr <teks>
│ ${activePrefix}statusdownloader
│ ${activePrefix}plugins
╰──────────────────
`.trim();
}

export function getOwnerMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;
    return `
${getHeader()}

╭─── . ݁₊ ⊹ *Owner Menu* ⊹ ₊ ݁.
│ ${activePrefix}self
│ ${activePrefix}public
│ ${activePrefix}maintenance
│ ${activePrefix}addprem <@tag/reply/nomor>
│ ${activePrefix}delprem <@tag/reply/nomor>
│ ${activePrefix}ban <@tag/reply/nomor>
│ ${activePrefix}unban <@tag/reply/nomor>
│ ${activePrefix}addadmin <@tag/reply/nomor>
│ ${activePrefix}deladmin <@tag/reply/nomor>
│ ${activePrefix}listadmin
│ ${activePrefix}setprefix <prefix baru>
│ ${activePrefix}broadcast <teks>
│ ${activePrefix}addbot <62xxx>
│ ${activePrefix}delbot <62xxx>
│ ${activePrefix}listuser
│ ${activePrefix}listbot
│ ${activePrefix}stats
│ ${activePrefix}exportstatus <clear>
│ ${activePrefix}block <@tag/reply/nomor>
│ ${activePrefix}unblock <@tag/reply/nomor>
│ ${activePrefix}kickall
│ ${activePrefix}getdb
│ ${activePrefix}resetdb
│ ${activePrefix}setbotname <nama>
│ ${activePrefix}setownername <nama>
│ ${activePrefix}shutdown
│ ${activePrefix}antilink <on/off>
│ ${activePrefix}antibot <on/off>
│ ${activePrefix}jagagrup <on/off>
│ ${activePrefix}hidetag <teks>
│ ${activePrefix}tagall <teks>
│ ${activePrefix}delmember <62xxx/tag>
│ ${activePrefix}add <62xxx>
│ ${activePrefix}promote <@tag/reply>
│ ${activePrefix}demote <@tag/reply>
│ ${activePrefix}group <open/close>
│ ${activePrefix}groupinfo
│ ${activePrefix}linkgc
│ ${activePrefix}revoke
│ ${activePrefix}setname <nama>
│ ${activePrefix}setdesc <deskripsi>
│ ${activePrefix}follow <link/newsletterJid>
│ ${activePrefix}getbio <@tag/reply>
╰──────────────────
`.trim();
}

export function getPluginsMenu() {
    const activePrefix = db.data.settings.prefix || settings.prefix;

    // Filter commands that come from external plugin files (have filePath)
    const pluginCmds = {};
    const seen = new Set();

    // Define all hardcoded command names and their aliases to avoid duplication
    const hardcodedCommands = new Set([
        'help', 'menu', 'plugins', 'pluginmenu', 'pl', 'usermenu', 'premiummenu', 'ownermenu',
        'register', 'daftar', 'ping', 'owner', 'runtime', 'uptime', 'checkuser', 'profile', 'me',
        'jkt84', 'jkt48', 'memberjkt', 'numberlookup', 'lookup', 'checknum',
        'ai', 'pushkontak', 'jpm', 'jpmch', 'addjpmch', 'deljpmch', 'listjpmch', 'checkdb',
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

        // Skip if it is a hardcoded command or its aliases match
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
        // Render category name in title case
        const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        menuText += `╭─── . ݁₊ ⊹ *${displayCat} Menu* ⊹ ₊ ݁.\n`;
        const cmds = pluginCmds[cat];
        cmds.forEach((cmd) => {
            const usage = cmd.usage ? ` ${cmd.usage}` : '';
            menuText += `│ ${activePrefix}${cmd.name}${usage}\n`;
        });
        menuText += `╰──────────────────\n\n`;
    });

    return menuText.trim();
}
