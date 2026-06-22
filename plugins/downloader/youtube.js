import { fetchBuffer } from '@/lib/scraping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch dengan timeout protection
const fetchWithTimeout = async (url, options, timeout = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
};

export default {
    premiumOnly: false,
    description: 'Mengunduh video atau audio dari YouTube via Kol.id (Async).',
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

        // Tentukan tipe download berdasarkan command
        const isAudio = ['ytmp3', 'play'].includes(commandName);

        await sendTyping();

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Sedang memproses ${isAudio ? 'audio' : 'video'} YouTube...`
        }, { quoted: msg });

        let finalData = null;

        try {
            // 1. Ambil Token CSRF
            let token = 'eKVRTJxZDqas7iGG06cmJwWHfjd4TRNXYC6VPh9a';
            try {
                const pageRes = await fetchWithTimeout('https://kol.id/download-video/youtube', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36'
                    }
                }, 10000);

                if (pageRes.ok) {
                    const html = await pageRes.text();
                    const match = html.match(/name="_token"\s+value="([^"]+)"/);
                    if (match) token = match[1];
                }
            } catch (e) { console.log('Token fetch failed, using fallback'); }

            // 2. Submit Request (POST)
            const apiUrl = 'https://kol.id/api/v2/downloader/youtube';
            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('_token', token);

            const submitRes = await fetchWithTimeout(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://kol.id',
                    'Referer': 'https://kol.id/download-video/youtube',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData.toString()
            }, 15000);

            if (!submitRes.ok) throw new Error('Gagal menghubungi server.');

            const submitData = await submitRes.json();

            // Cek apakah langsung jadi atau perlu polling
            if (submitData.meta?.success && submitData.data?.video) {
                finalData = submitData.data;
            } else if (submitData.meta?.status === 'accepted' && submitData.data?.request_id) {
                // Perlu Polling (Async)
                const requestId = submitData.data.request_id;
                const statusUrl = `https://kol.id/api/v2/downloader/status/${requestId}`;
                const pollInterval = (submitData.data.poll_after || 5) * 1000;

                await sock.sendMessage(msg.key.remoteJid, {
                    text: '🔄 Sedang mengambil data dari server... (Async)',
                    edit: loadingMsg.key
                });

                let attempts = 0;
                const maxAttempts = 15; // Max 75 detik

                while (attempts < maxAttempts) {
                    await delay(pollInterval);

                    const statusRes = await fetchWithTimeout(statusUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    }, 10000);

                    if (statusRes.ok) {
                        const statusJson = await statusRes.json();

                        if (statusJson.meta?.success && statusJson.data?.status === 'completed') {
                            finalData = statusJson.data;
                            break;
                        } else if (statusJson.meta?.status === 'failed') {
                            throw new Error('Proses download gagal di server.');
                        }
                    }
                    attempts++;
                }

                if (!finalData) throw new Error('Timeout: Server terlalu lama merespon.');
            } else {
                throw new Error(submitData.meta?.message || 'Format response tidak dikenali.');
            }

            if (!finalData) throw new Error('Data kosong.');

            // 3. Pilih Media Terbaik
            const videos = finalData.video || [];
            let selectedMedia = null;
            let qualityLabel = '';

            if (isAudio) {
                // Cari Audio Only (Prioritas MP4A lalu Opus)
                selectedMedia = videos.find(v => v.format === 'audio' && v.quality.includes('mp4a')) ||
                    videos.find(v => v.format === 'audio');
                qualityLabel = selectedMedia ? selectedMedia.quality : 'Audio';
            } else {
                // Cari Video dengan Audio (Combined/Hybrid) - Biasanya itag 18 (360p) atau 22 (720p)
                // Di response kol.id, combined biasanya ditandai dengan audio: true pada object video
                selectedMedia = videos.find(v => v.format === 'video' && v.audio === true);

                // Fallback jika tidak ada combined (jarang terjadi di endpoint ini tapi jaga-jaga)
                if (!selectedMedia) {
                    selectedMedia = videos.find(v => v.format === 'video');
                }
                qualityLabel = selectedMedia ? selectedMedia.quality : 'Video';
            }

            if (!selectedMedia) {
                throw new Error(`Format ${isAudio ? 'audio' : 'video'} tidak ditemukan.`);
            }

            // 4. Download Buffer
            await sock.sendMessage(msg.key.remoteJid, {
                text: '📥 Sedang mengunduh file...',
                edit: loadingMsg.key
            });

            const buffer = await fetchBuffer(selectedMedia.url);

            if (!buffer || buffer.length === 0) {
                throw new Error('Gagal mendownload buffer.');
            }

            // 5. Kirim Media
            const title = finalData.title || 'YouTube Video';
            const channel = finalData.channel?.name || 'Unknown Channel';

            const caption = `📥 *YouTube Downloader*\n\n` +
                `🎬 *Title:* ${title}\n` +
                `👤 *Channel:* ${channel}\n` +
                `📊 *Quality:* ${qualityLabel}\n` +
                `⚡ _Via Kol.id API_`;

            if (isAudio) {
                await sock.sendMessage(msg.key.remoteJid, {
                    audio: buffer,
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`,
                    contextInfo: {
                        externalAdReply: {
                            title: title,
                            body: channel,
                            thumbnailUrl: finalData.thumbnail,
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
            } else {
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
                edit: loadingMsg.key
            });
        }
    }
};