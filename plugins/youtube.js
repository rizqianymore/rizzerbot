import { postForm, fetchBuffer } from '@/lib/scraping.js';

export default {
    premiumOnly: true,
    description: 'Mengunduh video atau audio dari tautan YouTube.',
    usage: '<link YouTube>',
    example: 'https://youtube.com/watch?v=...',
    name: 'youtube',
    aliases: ['yt', 'ytmp4', 'ytmp3', 'play'],
    category: 'User',
    cooldown: 8000,
    run: async (sock, msg, args, { sendTyping, commandName }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link YouTube!\nContoh:\n• *.yt https://youtu.be/xxxx*\n• *.ytmp3 https://youtube.com/watch?v=xxxx*'
            }, { quoted: msg });
            return;
        }

        if (!/youtube\.com|youtu\.be/i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Pastikan link dari YouTube.'
            }, { quoted: msg });
            return;
        }

        // Determine type based on invoked command name
        const isAudio = commandName === 'ytmp3' || commandName === 'play';

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `⏳ Sedang memproses ${isAudio ? 'audio' : 'video'} YouTube...` 
        }, { quoted: msg });

        try {
            // POST Request to ytdown.to proxy
            const res = await postForm('https://app.ytdown.to/proxy.php', {
                url: url
            });

            if (res.data?.api?.status !== 'ok' || !res.data.api.mediaItems?.length) {
                throw new Error('Tidak ada media ditemukan');
            }

            const items = res.data.api.mediaItems;
            let mediaUrl = null;
            let quality = '';

            if (!isAudio) {
                // Prioritas Video: FHD → HD → SD
                const video = items.find(item => 
                    item.type === 'Video' && 
                    (item.mediaQuality === 'FHD' || item.mediaQuality === 'HD')
                ) || items.find(item => item.type === 'Video');

                if (video) {
                    mediaUrl = video.mediaUrl;
                    quality = video.mediaQuality || 'HD';
                }
            } else {
                // Audio (128k atau 48k)
                const audio = items.find(item => 
                    item.type === 'Audio' && item.mediaQuality === '128K'
                ) || items.find(item => item.type === 'Audio');
                
                if (audio) {
                    mediaUrl = audio.mediaUrl;
                    quality = audio.mediaQuality || '128K';
                }
            }

            if (!mediaUrl) throw new Error('Link media tidak ditemukan');

            // Download media file using secure fetchBuffer
            const buffer = await fetchBuffer(mediaUrl);
            const isVideoFile = !isAudio;

            const caption = `📥 *YouTube Downloader*\n` +
                `🎵 *Title:* ${res.data.api.title}\n` +
                `👤 *Channel:* ${res.data.api.userInfo.name}\n` +
                `📊 *Quality:* ${quality}\n` +
                `⚡ _Via Palantir API_`;

            await sock.sendMessage(msg.key.remoteJid, {
                [isVideoFile ? 'video' : 'audio']: buffer,
                caption: isVideoFile ? caption : undefined,
                mimetype: isVideoFile ? 'video/mp4' : 'audio/mpeg'
            }, { quoted: msg });

        } catch (err) {
            console.error('YouTube Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal memproses link YouTube. Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};