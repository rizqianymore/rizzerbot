import { postJson, fetchBuffer } from '@/lib/scraping.js';

export default {
    description: 'Mencari lagu di Spotify.',
    usage: '<judul lagu>',
    example: 'Let It Be',
    name: 'spotify',
    aliases: ['sp', 'spot', 'spdl'],
    category: 'User',
    cooldown: 8000,
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link Spotify!\nContoh: *.spotify https://open.spotify.com/track/xxxx*'
            }, { quoted: msg });
            return;
        }

        if (!/spotify\.com/i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Pastikan link dari Spotify.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '⏳ Sedang memproses lagu Spotify...' 
        }, { quoted: msg });

        let downloadUrl = null;
        let title = "Spotify Track";
        let artist = "";

        try {
            // Step 1: Ambil Track Data
            const dataRes = await postJson('https://spotmate.online/getTrackData', {
                spotify_url: url
            });

            if (dataRes?.name) {
                title = dataRes.name;
                artist = dataRes.artists?.map(a => a.name).join(', ') || '';
            }

            // Step 2: Convert ke Download Link
            const convertRes = await postJson('https://spotmate.online/convert', {
                urls: url
            });

            if (convertRes?.url) {
                downloadUrl = convertRes.url;
            }

        } catch (err) {
            console.error('Spotify Error:', err.message);
        }

        if (!downloadUrl) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal mendapatkan link download Spotify. Coba lagi nanti.'
            }, { quoted: msg });
            return;
        }

        try {
            const buffer = await fetchBuffer(downloadUrl);

            await sock.sendMessage(msg.key.remoteJid, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                caption: `🎵 *Spotify Downloader*\n` +
                         `📌 *Judul:* ${title}\n` +
                         `👤 *Artist:* ${artist || 'Unknown'}\n` +
                         `⚡ _Via Rizzer API_`
            }, { quoted: msg });

        } catch (err) {
            console.error('Download Error:', err);
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal mengunduh file audio.'
            }, { quoted: msg });
        }
    }
};