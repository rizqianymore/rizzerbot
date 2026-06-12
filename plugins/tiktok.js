import { postForm, fetchBuffer } from '@/lib/scraping.js';

export default {
    description: 'Mengunduh video TikTok tanpa tanda air/watermark.',
    usage: '<link TikTok>',
    example: 'https://vm.tiktok.com/...',
    name: 'tiktok',
    aliases: ['tt', 'ttdl', 'tiktokdl'],
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link video TikTok!\nContoh: *.tiktok https://www.tiktok.com/@user/video/123456789'
            }, { quoted: msg });
            return;
        }

        if (!/tiktok\.com|douyin\.com/i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Tautan tidak valid.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⏳ Sedang memproses download TikTok...'
        }, { quoted: msg });

        let videoUrl = null;
        let authorUsername = 'unknown';
        let successAPI = 'Rizzer API';

        try {
            const res = await postForm('https://www.tikwm.com/api/', {
                url: url
            });

            if (res?.data?.code === 0 && res?.data?.data) {
                const data = res.data.data;
                videoUrl = data.play || data.hdplay || data.wmplay;
                authorUsername = data.author?.unique_id || 'unknown';
                successAPI = 'Rizzer API';
            }
        } catch (err) {
            console.error('TikWM API Error:', err.message);
        }

        if (!videoUrl) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal mengambil video TikTok. Coba lagi nanti.'
            }, { quoted: msg });
            return;
        }

        try {
            const videoBuffer = await fetchBuffer(videoUrl);

            const caption = `📥 *TikTok Downloader*\n\n` +
                `👤 *Username:* @${authorUsername}\n` +
                `⚡ _Via ${successAPI}_`;

            await sock.sendMessage(msg.key.remoteJid, {
                video: videoBuffer,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Send Error:', err);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal mengirim video: ${err.message}`
            }, { quoted: msg });
        }
    }
};