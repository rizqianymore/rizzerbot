import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '@/lib/database.js';
import { settings } from '@/config/settings.js';
import { getOwnerMenu } from '@/lib/menu.js';
import { getThumbnailBuffer } from '@/lib/imageHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'ownermenu',
    description: 'Menampilkan menu perintah khusus owner.',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const activePrefix = db.data.settings.prefix || settings.prefix;
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        let uptimeString = '';
        if (hours > 0) uptimeString += `${hours}j `;
        if (minutes > 0 || hours > 0) uptimeString += `${minutes}m `;
        uptimeString += `${seconds}s`;

        const userCount = Object.keys(db.data.users).filter(k => db.data.users[k].registered).length;
        const totalHits = db.data.stats.totalCommands || 0;

        const statsBody = `Owner: ${settings.ownerName} | Prefix: [ ${activePrefix} ] | Uptime: ${uptimeString} | User: ${userCount} | Hits: ${totalHits}`;

        const menuText = getOwnerMenu();
        const adReplyOptions = {
            title: settings.linkTitle,
            body: statsBody,
            sourceUrl: settings.linkUrl,
            mediaType: 1,
            renderLargerThumbnail: true
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
