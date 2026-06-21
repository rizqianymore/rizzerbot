import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';
import { getThumbnailBuffer } from '@/lib/imageHelper.js';
import { getUptimeString } from '@/lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'help',
    description: 'Menampilkan daftar menu utama bot.',
    usage: '',
    example: '',
    aliases: ['menu'],
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const activePrefix = db.data.settings.prefix || settings.prefix;
        const userCount = Object.keys(db.data.users).filter(k => db.data.users[k].registered).length;
        const totalHits = db.data.stats.totalCommands || 0;

        // Beautiful premium text-based menu layout
        const statsBody = `Owner: ${settings.ownerName} | Prefix: [ ${activePrefix} ] | Uptime: ${getUptimeString()} | User: ${userCount} | Hits: ${totalHits}`;

        const menuText = `🤖 *${settings.botName}* 🤖
━━━━━━━━━━━━━━━━━━
📊 *INFO BOT*
• *Owner:* ${settings.ownerName}
• *Prefix:* [ ${activePrefix} ]
• *Uptime:* ${getUptimeString()}
• *Pengguna:* ${userCount} terdaftar
• *Total Hits:* ${totalHits} kali dipanggil

📂 *DAFTAR MENU*
Silakan ketik perintah di bawah ini:

• *${activePrefix}usermenu*
  └ _Melihat daftar perintah umum user_

• *${activePrefix}premiummenu*
  └ _Melihat fitur premium & downloader_

• *${activePrefix}ownermenu*
  └ _Melihat panel kontrol owner & admin_

• *${activePrefix}plugins*
  └ _Melihat modul plugin eksternal_
━━━━━━━━━━━━━━━━━━
💡 *Tips:* Ketik salah satu menu di atas untuk melihat perintah secara lengkap.`.trim();

        const adReplyOptions = {
            title: settings.linkTitle,
            body: statsBody,
            sourceUrl: settings.linkUrl,
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: true
        };

        if (settings.linkImage && (settings.linkImage.startsWith('http://') || settings.linkImage.startsWith('https://'))) {
            adReplyOptions.thumbnailUrl = settings.linkImage;
        } else if (settings.linkImage) {
            const bannerPath = path.join(__dirname, '..', '..', settings.linkImage);
            const thumb = await getThumbnailBuffer(bannerPath);
            if (thumb) adReplyOptions.thumbnail = thumb;
        }

        const msgOptions = {
            text: menuText,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: settings.newsletterJid,
                    newsletterName: settings.newsletterName,
                    serverMessageId: -1
                },
                externalAdReply: adReplyOptions
            }
        };

        await sock.sendMessage(msg.key.remoteJid, msgOptions, { quoted: msg });
    }
};
