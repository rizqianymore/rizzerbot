import { fetchBuffer, postForm, fetchJson } from '@/lib/scraping.js';

// Helper to parse slide/image selections from arguments (e.g. "1,3" or "2-4")
function parseSelection(args, totalSlides) {
    const selectionStr = args.slice(1).join('').replace(/\s+/g, '');
    if (!selectionStr || selectionStr.toLowerCase() === 'all') {
        return null;
    }

    const selected = new Set();
    const parts = selectionStr.split(',');

    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end)) {
                const min = Math.min(start, end);
                const max = Math.max(start, end);
                for (let i = min; i <= max; i++) {
                    if (i >= 1 && i <= totalSlides) {
                        selected.add(i - 1); // convert to 0-indexed
                    }
                }
            }
        } else {
            const index = parseInt(part, 10);
            if (!isNaN(index) && index >= 1 && index <= totalSlides) {
                selected.add(index - 1); // convert to 0-indexed
            }
        }
    }

    return selected.size > 0 ? Array.from(selected).sort((a, b) => a - b) : null;
}

export default {
    description: 'Mengunduh media dari link post Instagram.',
    usage: '<link post Instagram> [pilihan slide]',
    example: 'https://www.instagram.com/p/... 1,3',
    name: 'instagram',
    aliases: ['ig', 'igdl', 'instagramdl'],
    category: 'User',
    cooldown: 8000,
    premiumOnly: true,
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link post Instagram!\nContoh:\n• Post Instagram: *.ig https://www.instagram.com/p/...\n• Pilih slide: *.ig https://www.instagram.com/p/... 1,3'
            }, { quoted: msg });
            return;
        }

        if (!/instagram\.com/i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Pastikan link dari post Instagram.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '⏳ Sedang memproses post Instagram via Palantir API...' 
        }, { quoted: msg });

        let mediaItems = []; // Array of { url: string, isVideo: boolean }

        try {
            // 1. Fetch main page using fetchJson to retrieve headers/cookies
            const mainPageRes = await fetchJson('https://kol.id/download-video/instagram');
            const setCookie = mainPageRes.headers['set-cookie'];
            let cookies = '';
            if (setCookie) {
                cookies = setCookie.map(c => c.split(';')[0]).join('; ');
            }

            // 2. Submit download task request
            const postResponse = await postForm('https://kol.id/api/v2/downloader/instagram', {
                url: url
            }, {
                headers: {
                    'Cookie': cookies,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://kol.id',
                    'Referer': 'https://kol.id/download-video/instagram'
                }
            });

            if (!postResponse?.data || postResponse.data.meta?.success === false) {
                const errMsg = postResponse?.data?.meta?.message || 'Gagal mengirim permintaan download.';
                throw new Error(errMsg);
            }

            const requestId = postResponse.data.data?.request_id;
            if (!requestId) {
                throw new Error('Gagal mendapatkan ID permintaan dari server.');
            }

            // 3. Poll status until completed or failed
            let completed = false;
            let resData = null;
            let attempts = 0;
            const maxAttempts = 12;
            const pollAfterSeconds = postResponse.data?.poll_after || 5;
            
            // Wait for the initially suggested delay before the first check
            await new Promise(resolve => setTimeout(resolve, pollAfterSeconds * 1000));

            while (!completed && attempts < maxAttempts) {
                attempts++;

                const statusResponse = await fetchJson(`https://kol.id/api/v2/downloader/status/${requestId}`, {
                    headers: {
                        'Cookie': cookies,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://kol.id/download-video/instagram'
                    }
                });

                const statusData = statusResponse?.data;
                if (!statusData) {
                    // If response structure was resolved, adapt to returned type
                    const rawData = statusResponse;
                    if (rawData?.meta?.success === false) {
                        throw new Error(rawData.meta?.message || 'Permintaan gagal diproses.');
                    }
                    const status = rawData?.data?.status;
                    if (status === 'completed') {
                        completed = true;
                        resData = rawData.data;
                        break;
                    } else if (status === 'failed') {
                        throw new Error(rawData.data?.error?.message || 'Proses pengunduhan gagal.');
                    }
                } else {
                    if (statusResponse.meta?.success === false) {
                        throw new Error(statusResponse.meta?.message || 'Permintaan gagal diproses.');
                    }
                    const status = statusResponse.data?.status;
                    if (status === 'completed') {
                        completed = true;
                        resData = statusResponse.data;
                        break;
                    } else if (status === 'failed') {
                        throw new Error(statusResponse.data?.error?.message || 'Proses pengunduhan gagal.');
                    }
                }

                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            if (!completed || !resData) {
                throw new Error('Waktu pemrosesan habis (Timeout). Silakan coba lagi.');
            }

            // 4. Parse the results and handle slides if present
            if (Array.isArray(resData.slides) && resData.slides.length > 0) {
                const totalSlides = resData.slides.length;
                const selectedIndices = parseSelection(args, totalSlides);
                
                let slidesToDownload = resData.slides;
                if (selectedIndices !== null) {
                    slidesToDownload = selectedIndices.map(idx => resData.slides[idx]);
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `⏳ Mengunduh ${slidesToDownload.length} slide terpilih dari total ${totalSlides}...`
                    }, { quoted: msg });
                } else if (totalSlides > 1) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `⏳ Menemukan ${totalSlides} slide. Mengunduh semua...\n💡 _Tips: Gunakan *.ig <link> 1,3* untuk memilih slide tertentu._`
                    }, { quoted: msg });
                }

                for (const slide of slidesToDownload) {
                    mediaItems.push({
                        url: slide.url || slide.thumbnail,
                        isVideo: slide.type === 'video'
                    });
                }
            } else if (resData.video_url) {
                mediaItems.push({
                    url: resData.video_url,
                    isVideo: true
                });
            } else if (resData.url) {
                mediaItems.push({
                    url: resData.url,
                    isVideo: false
                });
            } else if (resData.thumbnail) {
                mediaItems.push({
                    url: resData.thumbnail,
                    isVideo: false
                });
            }

        } catch (err) {
            console.error('Instagram Downloader Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal mengambil media: ${err.message}`
            }, { quoted: msg });
            return;
        }

        if (mediaItems.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal menemukan media yang bisa diunduh.'
            }, { quoted: msg });
            return;
        }

        // 5. Send all resolved media items
        try {
            for (const item of mediaItems) {
                const buffer = await fetchBuffer(item.url);
                if (item.isVideo) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        video: buffer,
                        caption: `📥 *Instagram Downloader*\n⚡ _Via Palantir API_`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, {
                        image: buffer,
                        caption: `📥 *Instagram Downloader*\n⚡ _Via Palantir API_`
                    }, { quoted: msg });
                }
            }
        } catch (err) {
            console.error('Send Media Error:', err);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal mengirim media: ${err.message}`
            }, { quoted: msg });
        }
    }
};