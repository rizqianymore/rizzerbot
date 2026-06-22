import { fetchBuffer } from '@/lib/scraping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Fetch dengan timeout
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
    description: 'Downloader Instagram Reels (mengunduh video Reels).',
    usage: '<link Reels>',
    example: '.reels https://www.instagram.com/reel/C8XyZ9yyXyz/',
    name: 'reels',
    aliases: ['igreels', 'instagramreels'],
    category: 'Downloader',
    cooldown: 5000,
    premiumOnly: true,
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];

        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link Instagram Reels!\nContoh:\n• *.reels https://www.instagram.com/reel/...*'
            }, { quoted: msg });
            return;
        }

        if (!/instagram\.com\/(reel|reels)\//i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Pastikan link dari Instagram Reels.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();
        await delay(1500);

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: '⏳ Sedang memproses... Mohon tunggu.'
        }, { quoted: msg });

        let mediaItems = [];

        try {
            // 1. Ambil Token CSRF
            let token = 'eKVRTJxZDqas7iGG06cmJwWHfjd4TRNXYC6VPh9a';
            try {
                const pageRes = await fetchWithTimeout('https://kol.id/download-video/instagram', {
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
            const apiUrl = 'https://kol.id/api/v2/downloader/instagram';
            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('_token', token);

            const submitRes = await fetchWithTimeout(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://kol.id',
                    'Referer': 'https://kol.id/download-video/instagram',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData.toString()
            }, 15000);

            if (!submitRes.ok) throw new Error('Gagal menghubungi server.');

            const submitData = await submitRes.json();
            
            // Cek apakah langsung jadi atau perlu polling
            let finalData = null;

            if (submitData.meta?.success && submitData.data?.slides) {
                // Langsung jadi (cached)
                finalData = submitData.data;
            } else if (submitData.meta?.status === 'accepted' && submitData.data?.request_id) {
                // Perlu Polling
                const requestId = submitData.data.request_id;
                const statusUrl = `https://kol.id/api/v2/downloader/status/${requestId}`;
                const pollInterval = (submitData.data.poll_after || 5) * 1000;
                
                await sock.sendMessage(msg.key.remoteJid, {
                    text: '🔄 Sedang mengambil data dari server... (Async)',
                    edit: loadingMsg.key
                });

                let attempts = 0;
                const maxAttempts = 12; // Max 60 detik (12 x 5 detik)

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

            // 3. Parse Media
            if (finalData) {
                // Handle Video Tunggal
                if (finalData.video_url) {
                    mediaItems.push({
                        url: finalData.video_url,
                        type: 'video',
                        filename: 'video.mp4'
                    });
                }

                // Handle Slides (Story/Carousel)
                if (finalData.slides && Array.isArray(finalData.slides)) {
                    for (const slide of finalData.slides) {
                        if (slide.url) {
                            mediaItems.push({
                                url: slide.url,
                                type: slide.type === 'video' ? 'video' : 'image',
                                filename: slide.filename || 'media'
                            });
                        }
                    }
                }
            }

            if (mediaItems.length === 0) {
                throw new Error('Tidak ada media ditemukan.');
            }

            // 4. Logika Pilih Slide
            const totalSlides = mediaItems.length;
            const selectionStr = args.slice(1).join(' ').trim();
            let selectedIndices = null;

            if (selectionStr && selectionStr.toLowerCase() !== 'all' && selectionStr.toLowerCase() !== 'semua') {
                const parts = selectionStr.split(',');
                const tempSelected = new Set();

                for (const part of parts) {
                    const cleanPart = part.trim();
                    if (cleanPart.includes('-')) {
                        const [startStr, endStr] = cleanPart.split('-');
                        const start = parseInt(startStr, 10);
                        const end = parseInt(endStr, 10);
                        if (!isNaN(start) && !isNaN(end)) {
                            const min = Math.min(start, end);
                            const max = Math.max(start, end);
                            for (let i = min; i <= max; i++) {
                                if (i >= 1 && i <= totalSlides) tempSelected.add(i - 1);
                            }
                        }
                    } else {
                        const index = parseInt(cleanPart, 10);
                        if (!isNaN(index) && index >= 1 && index <= totalSlides) {
                            tempSelected.add(index - 1);
                        }
                    }
                }

                if (tempSelected.size > 0) {
                    selectedIndices = Array.from(tempSelected).sort((a, b) => a - b);
                }
            }

            let finalMedia = mediaItems;
            if (selectedIndices !== null) {
                finalMedia = selectedIndices.map(idx => mediaItems[idx]);
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `✅ Ditemukan ${totalSlides} media. Mengunduh ${finalMedia.length} terpilih: _${selectedIndices.map(i => i + 1).join(', ')}_`,
                    edit: loadingMsg.key
                });
            } else {
                if (totalSlides > 1) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `✅ Ditemukan ${totalSlides} media. Mengunduh semuanya...`,
                        edit: loadingMsg.key
                    });
                }
            }

            // 5. Kirim Media
            for (let i = 0; i < finalMedia.length; i++) {
                const item = finalMedia[i];
                try {
                    await delay(500); // Jeda sebelum fetch buffer
                    const buffer = await fetchBuffer(item.url);

                    if (!buffer || buffer.length === 0) continue;

                    if (item.type === 'video') {
                        await sock.sendMessage(msg.key.remoteJid, {
                            video: buffer,
                            caption: `📥 *Instagram Video* (${i + 1}/${finalMedia.length})`,
                            mimetype: 'video/mp4'
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, {
                            image: buffer,
                            caption: `📥 *Instagram Photo* (${i + 1}/${finalMedia.length})`
                        }, { quoted: msg });
                    }

                    if (i < finalMedia.length - 1) {
                        await delay(randomInt(2500, 4500)); // Anti-spam delay
                    }

                } catch (err) {
                    console.error(`Error sending media ${i + 1}:`, err.message);
                }
            }

        } catch (err) {
            console.error('IG Downloader Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal: ${err.message}`,
                edit: loadingMsg.key
            });
        }
    }
};