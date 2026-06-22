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
    const premiumCmds = {};

    for (const cmd of commands.values()) {
        if (cmd && cmd.name && !seen.has(cmd.name)) {
            seen.add(cmd.name);
            if (cmd.premiumOnly && !cmd.ownerOnly && cmd.name !== 'plugins') {
                let cat = 'Premium';
                if (cmd.filePath) {
                    try {
                        const parts = cmd.filePath.replace(/\\/g, '/').split('/plugins/');
                        if (parts.length > 1) {
                            const subPath = parts[1];
                            const folder = subPath.split('/')[0];
                            if (folder) {
                                cat = folder.charAt(0).toUpperCase() + folder.slice(1).toLowerCase();
                            }
                        }
                    } catch (_) {}
                }
                
                if (!premiumCmds[cat]) {
                    premiumCmds[cat] = [];
                }
                premiumCmds[cat].push(cmd);
            }
        }
    }

    let menuText = `${getHeader()}\n\n*🤖 ${settings.botName} — Premium Menu*\n` +
                   `🎯 *Prefix:* [ ${activePrefix} ]\n\n`;

    const sortedCats = Object.keys(premiumCmds).sort();
    sortedCats.forEach(cat => {
        menuText += `╭─── . ݁₊ ⊹ *${cat} Menu* ⊹ ₊ ݁.\n`;
        const cmds = premiumCmds[cat];
        cmds.sort((a, b) => a.name.localeCompare(b.name));
        cmds.forEach((cmd) => {
            const usage = cmd.usage ? ` ${cmd.usage}` : '';
            menuText += `│ ${activePrefix}${cmd.name}${usage}\n`;
        });
        menuText += `╰──────────────\n\n`;
    });

    return menuText.trim();
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
