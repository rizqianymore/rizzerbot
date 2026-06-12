import axios from 'axios';
import { fetchBuffer } from '@/lib/scraping.js';

export default {
    description: 'Mengunduh media (post/reel/story) dari link Instagram.',
    usage: '<link Instagram>',
    example: 'https://www.instagram.com/p/...',
    name: 'instagram',
    aliases: ['ig', 'igdl', 'instagramdl'],
    category: 'User',
    cooldown: 8000,
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link Instagram!\nContoh:\n• Post/Reel: *.ig https://www.instagram.com/p/...\n• Story: *.ig https://www.instagram.com/stories/.../'
            }, { quoted: msg });
            return;
        }

        if (!/instagram\.com/i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Pastikan link dari Instagram.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '⏳ Sedang memproses download Instagram...' 
        }, { quoted: msg });

        let mediaItems = []; // Array of { url: string, isVideo: boolean }

        try {
            // 1. Fetch kol.id home page to get CSRF token and cookies
            const getRes = await axios.get('https://kol.id/download-video/instagram', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });

            const cookies = getRes.headers['set-cookie'] || [];
            const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

            const match = getRes.data.match(/name="_token"\s+value="([^"]+)"/) || getRes.data.match(/csrf-token"\s+content="([^"]+)"/);
            if (!match) {
                throw new Error('Gagal mendapatkan token CSRF.');
            }
            const csrfToken = match[1];

            // 2. Send POST request to kol.id downloader API
            const params = new URLSearchParams();
            params.append('url', url);
            params.append('_token', csrfToken);

            const postRes = await axios.post('https://kol.id/api/v2/downloader/instagram', params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://kol.id/download-video/instagram',
                    'Origin': 'https://kol.id',
                    'Cookie': cookieString,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

            let downloadData = postRes.data?.data;
            if (!downloadData) {
                throw new Error('Gagal mengambil data dari API.');
            }

            // 3. If the download is queued, poll the status URL
            if (postRes.data?.meta?.code === 2020 && downloadData.status_url) {
                const statusUrl = downloadData.status_url;
                let completed = false;

                for (let i = 0; i < 15; i++) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    const statusRes = await axios.get(statusUrl, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': 'https://kol.id/download-video/instagram',
                            'Cookie': cookieString,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        timeout: 10000
                    });

                    if (statusRes.data?.data?.status === 'completed') {
                        downloadData = statusRes.data.data;
                        completed = true;
                        break;
                    } else if (statusRes.data?.data?.status === 'failed') {
                        throw new Error(statusRes.data?.data?.error?.message || 'Download gagal diproses.');
                    }
                }

                if (!completed) {
                    throw new Error('Timeout saat menunggu proses download.');
                }
            }

            // 4. Extract URLs from completed download data
            if (Array.isArray(downloadData.slides) && downloadData.slides.length > 0) {
                for (const slide of downloadData.slides) {
                    const mediaUrl = slide.video_url || slide.image_url || slide.url;
                    if (mediaUrl) {
                        mediaItems.push({
                            url: mediaUrl,
                            isVideo: slide.type === 'video'
                        });
                    }
                }
            } else {
                const mediaUrl = downloadData.video_url || downloadData.url;
                if (mediaUrl) {
                    mediaItems.push({
                        url: mediaUrl,
                        isVideo: downloadData.type === 'video'
                    });
                }
            }

        } catch (err) {
            console.error('KOL.id API Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal mengambil media dari link tersebut: ${err.message}`
            }, { quoted: msg });
            return;
        }

        if (mediaItems.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal menemukan media yang bisa diunduh.'
            }, { quoted: msg });
            return;
        }

        // 5. Download and send all media items
        try {
            for (const item of mediaItems) {
                const buffer = await fetchBuffer(item.url);
                if (item.isVideo) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        video: buffer,
                        caption: `📥 *Instagram Downloader*\n⚡ _Via Rizzer API_`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, {
                        image: buffer,
                        caption: `📥 *Instagram Downloader*\n⚡ _Via Rizzer API_`
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