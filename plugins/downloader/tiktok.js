import { postJson, fetchBuffer } from '@/lib/scraping.js';

export default {
    premiumOnly: true,
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
        let successAPI = 'Kyros-MD API';

        try {
            // Berikan delay 1 detik agar tidak terkena limit API (1 request/second)
            await new Promise(resolve => setTimeout(resolve, 1000));

            const res = await postJson('https://tiktok-api.rakarizqi-cv.workers.dev/api/download/tiktok', {
                url: url
            });

            if (res?.status && res?.data) {
                const data = res.data;
                videoUrl = data.url;
                authorUsername = data.author || 'unknown';
                successAPI = data.source || 'Kyros-MD API';
            } else if (res?.status === false && res?.message) {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `❌ API Error: ${res.message}`
                }, { quoted: msg });
                return;
            }
        } catch (err) {
            console.error('TikTok API Error:', err.message);
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