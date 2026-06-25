import { fetchBuffer } from '@/lib/scraping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
    premiumOnly: true,
    description: 'Mengunduh video atau audio dari YouTube via HighReach API.',
    usage: '<link YouTube>',
    example: '.yt https://youtu.be/...\n.ytmp3 https://youtube.com/watch?v=...',
    name: 'youtube',
    aliases: ['yt', 'ytmp4', 'ytmp3', 'play'],
    category: 'Downloader',
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
                text: '❌ Link tidak valid.'
            }, { quoted: msg });
            return;
        }

        const isAudio = ['ytmp3', 'play'].includes(commandName);

        await sendTyping();

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Sedang memproses ${isAudio ? 'audio' : 'video'} YouTube...`
        }, { quoted: msg });

        try {
            // Call highreach.ai API
            const apiRes = await fetch('https://highreach.ai/api/tools/twitter-gif-download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://highreach.ai',
                    'Referer': 'https://highreach.ai/tools/youtube-video-downloader'
                },
                body: JSON.stringify({ tweet_url: url })
            });

            if (!apiRes.ok) throw new Error('Gagal menghubungi server.');

            const data = await apiRes.json();

            if (!data.formats || data.formats.length === 0) {
                throw new Error('Tidak ada format yang tersedia.');
            }

            let selectedFormat;
            let qualityLabel;

            if (isAudio) {
                // Pick best audio (prefer higher bitrate)
                const audioFormats = data.formats.filter(f => f.is_audio);
                if (audioFormats.length === 0) throw new Error('Format audio tidak ditemukan.');

                // Sort by quality string to get highest bitrate
                audioFormats.sort((a, b) => {
                    const aKbps = parseInt(a.quality.match(/\d+/)?.[0] || 0);
                    const bKbps = parseInt(b.quality.match(/\d+/)?.[0] || 0);
                    return bKbps - aKbps;
                });

                selectedFormat = audioFormats[0];
                qualityLabel = selectedFormat.quality;
            } else {
                // Pick best video with reasonable quality (prefer 720p or 1080p mp4)
                const videoFormats = data.formats.filter(f => !f.is_audio && f.content_type === 'mp4');
                if (videoFormats.length === 0) throw new Error('Format video MP4 tidak ditemukan.');

                // Sort by resolution (descending)
                videoFormats.sort((a, b) => {
                    const aRes = parseInt(a.quality.match(/\d+/)?.[0] || 0);
                    const bRes = parseInt(b.quality.match(/\d+/)?.[0] || 0);
                    return bRes - aRes;
                });

                // Prefer 720p or lower for faster download, fallback to highest
                selectedFormat = videoFormats.find(v => {
                    const res = parseInt(v.quality.match(/\d+/)?.[0] || 0);
                    return res <= 720;
                }) || videoFormats[0];

                qualityLabel = selectedFormat.quality;
            }

            await sock.sendMessage(msg.key.remoteJid, {
                text: '📥 Sedang mengunduh file...',
                edit: loadingMsg.key
            });

            const buffer = await fetchBuffer(selectedFormat.url);

            if (!buffer || buffer.length === 0) {
                throw new Error('Gagal mendownload buffer.');
            }

            const title = 'YouTube Video'; // API doesn't provide title in this response
            const thumbnail = data.thumbnail || '';

            if (isAudio) {
                await sock.sendMessage(msg.key.remoteJid, {
                    audio: buffer,
                    mimetype: 'audio/mpeg',
                    fileName: `audio.${selectedFormat.content_type}`,
                    contextInfo: {
                        externalAdReply: {
                            title: 'YouTube Audio',
                            body: qualityLabel,
                            thumbnailUrl: thumbnail,
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
            } else {
                const caption = `📥 *YouTube Downloader*\n\n` +
                    `📊 *Quality:* ${qualityLabel}\n` +
                    `⚡ _Via HighReach API_`;

                await sock.sendMessage(msg.key.remoteJid, {
                    video: buffer,
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: msg });
            }

        } catch (err) {
            console.error('YouTube Downloader Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal: ${err.message}`,
                edit: loadingMsg?.key
            });
        }
    }
};