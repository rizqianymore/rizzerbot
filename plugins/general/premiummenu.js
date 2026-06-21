import path from 'path';
import { fileURLToPath } from 'url';
import { getPremiumMenu } from '@/lib/menu.js';
import { settings } from '@/config/settings.js';
import { getThumbnailBuffer } from '@/lib/imageHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'premiummenu',
    description: 'Menampilkan menu perintah khusus premium.',
    usage: '',
    example: '',
    category: 'Premium',
    run: async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const menuText = getPremiumMenu();
        const adReplyOptions = {
            title: settings.linkTitle,
            body: settings.linkBody,
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
