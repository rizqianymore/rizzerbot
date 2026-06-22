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
    premiumOnly: false, // Bisa diubah true jika mau dibatasi
    description: 'Mengunduh video TikTok tanpa watermark (via Kol.id).',
    usage: '<link TikTok>',
    example: '.tiktok https://www.tiktok.com/@user/video/123',
    name: 'tiktok',
    aliases: ['tt', 'ttdl', 'tiktokdl'],
    category: 'Downloader',
    cooldown: 5000,
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

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: '⏳ Sedang memproses download TikTok...'
        }, { quoted: msg });

        let videoData = null;

        try {
            // 1. Ambil Token CSRF dari halaman utama
            let token = 'eKVRTJxZDqas7iGG06cmJwWHfjd4TRNXYC6VPh9a';
            try {
                const pageRes = await fetchWithTimeout('https://kol.id/download-video/tiktok', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36'
                    }
                }, 10000);

                if (pageRes.ok) {
                    const html = await pageRes.text();
                    const match = html.match(/name="_token"\s+value="([^"]+)"/);
                    if (match) token = match[1];
                }
            } catch (e) {
                console.log('Token fetch failed, using fallback');
            }

            // 2. Submit Request (POST)
            const apiUrl = 'https://kol.id/api/v2/downloader/tiktok';
            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('_token', token);
            // Opsional: Jika API mendukung parameter no_wm, bisa ditambahkan di sini
            // formData.append('type', 'nowm'); 

            const submitRes = await fetchWithTimeout(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://kol.id',
                    'Referer': 'https://kol.id/download-video/tiktok',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData.toString()
            }, 15000);

            if (!submitRes.ok) throw new Error('Gagal menghubungi server.');

            const submitData = await submitRes.json();

            // Cek apakah langsung jadi atau perlu polling
            let finalData = null;

            if (submitData.meta?.success && submitData.data?.video) {
                // Langsung jadi (cached)
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
                const maxAttempts = 12; // Max 60 detik

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

            // 3. Parse Data Video
            if (finalData) {
                // Cari URL video tanpa watermark jika ada array video
                let targetVideoUrl = null;

                if (Array.isArray(finalData.video)) {
                    // Prioritaskan yang Watermark: false jika ada
                    const noWm = finalData.video.find(v => !v.Watermark);
                    targetVideoUrl = noWm ? noWm.url : finalData.video[0].url;
                } else if (typeof finalData.video === 'string') {
                    targetVideoUrl = finalData.video;
                }

                if (!targetVideoUrl) throw new Error('URL Video tidak ditemukan.');

                videoData = {
                    url: targetVideoUrl,
                    author: finalData.author || 'unknown',
                    desc: finalData.description || '',
                    audio: finalData.audio || null,
                    thumbnail: finalData.thumbnail || null
                };
            }

            if (!videoData) throw new Error('Data video kosong.');

            // 4. Download Buffer
            await sock.sendMessage(msg.key.remoteJid, {
                text: '📥 Sedang mengunduh file...',
                edit: loadingMsg.key
            });

            const videoBuffer = await fetchBuffer(videoData.url);

            if (!videoBuffer || videoBuffer.length === 0) {
                throw new Error('Gagal mendownload buffer video.');
            }

            // 5. Kirim Video
            const caption = `📥 *TikTok Downloader*\n\n` +
                `👤 *Username:* @${videoData.author}\n` +
                `📝 *Desc:* ${videoData.desc.substring(0, 100)}${videoData.desc.length > 100 ? '...' : ''}\n` +
                `⚡ _Via Kol.id API_`;

            await sock.sendMessage(msg.key.remoteJid, {
                video: videoBuffer,
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            // Opsional: Kirim Audio terpisah jika ingin
            /*
            if (videoData.audio) {
                await delay(2000);
                const audioBuf = await fetchBuffer(videoData.audio);
                if (audioBuf) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        audio: audioBuf,
                        mimetype: 'audio/mpeg',
                        ptt: false
                    }, { quoted: msg });
                }
            }
            */

        } catch (err) {
            console.error('TikTok Downloader Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal: ${err.message}`,
                edit: loadingMsg.key
            });
        }
    }
};