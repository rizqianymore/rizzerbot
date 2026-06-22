import { fetchBuffer } from '@/lib/scraping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export default {
    description: 'Downloader Instagram Universal (Post, Reels, Story, IGTV) dengan support slide.',
    usage: '<link> [opsional: nomor slide]',
    example: '.igpost https://instagram.com/p/xyz 1,3\n.igpost https://instagram.com/stories/username',
    name: 'igpost',
    aliases: ['igdl', 'instadl'],
    category: 'Downloader',
    cooldown: 5000,
    premiumOnly: true,
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];

        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link Instagram!\nContoh:\n• *.igpost https://www.instagram.com/p/...*\n• *.igpost https://www.instagram.com/stories/...*'
            }, { quoted: msg });
            return;
        }

        if (!/instagram\.com\/(p|reel|reels|stories|tv)\//i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Pastikan link dari Post, Reels, Stories, atau TV Instagram.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: '⏳ Sedang memproses... Mohon tunggu.'
        }, { quoted: msg });

        let mediaItems = [];

        try {
            // Fetch token dari halaman utama
            let token = 'eKVRTJxZDqas7iGG06cmJwWHfjd4TRNXYC6VPh9a';

            try {
                const pageResponse = await fetch('https://kol.id/download-video/instagram', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    }
                });

                if (pageResponse.ok) {
                    const html = await pageResponse.text();
                    const tokenMatch = html.match(/name="_token"\s+value="([^"]+)"/);
                    if (tokenMatch && tokenMatch[1]) {
                        token = tokenMatch[1];
                    }
                }
            } catch (err) {
                console.log('Using fallback token');
            }

            const apiUrl = 'https://kol.id/api/v2/downloader/instagram';

            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('_token', token);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://kol.id',
                    'Referer': 'https://kol.id/download-video/instagram',
                    'Accept': '*/*',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData.toString()
            });

            if (!response.ok) throw new Error('Gagal menghubungi server downloader.');

            const result = await response.json();

            if (!result.meta || !result.meta.success) {
                throw new Error(result.meta?.message || 'Gagal mengambil data dari Instagram.');
            }

            const data = result.data;

            // Handle video tunggal
            if (data.video_url) {
                mediaItems.push({
                    url: data.video_url,
                    type: 'video',
                    filename: 'video.mp4'
                });
            }

            // Handle slides (carousel)
            if (data.slides && Array.isArray(data.slides)) {
                for (const slide of data.slides) {
                    if (slide.url) {
                        mediaItems.push({
                            url: slide.url,
                            type: slide.type === 'video' ? 'video' : 'image',
                            filename: slide.filename || 'media'
                        });
                    }
                }
            }

            if (mediaItems.length === 0) {
                throw new Error('Tidak ada media yang bisa diunduh.');
            }

            // --- LOGIKA PEMILIHAN SLIDE ---
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
                    text: `✅ Ditemukan ${totalSlides} media. Mengunduh ${finalMedia.length} slide terpilih: _${selectedIndices.map(i => i + 1).join(', ')}_`,
                    edit: loadingMsg.key
                });
            } else {
                if (totalSlides > 1) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `✅ Ditemukan ${totalSlides} media. Mengunduh semuanya...\n💡 _Tips: Tambahkan angka di belakang link (ex: .igpost link 1,3) untuk memilih._`,
                        edit: loadingMsg.key
                    });
                }
            }

            // --- PENGIRIMAN DENGAN DELAY ---
            for (let i = 0; i < finalMedia.length; i++) {
                const item = finalMedia[i];

                try {
                    if (i > 0) {
                        const delayTime = randomInt(2000, 4000);
                        await delay(delayTime);
                    }

                    const buffer = await fetchBuffer(item.url);

                    if (!buffer) continue;

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

                } catch (err) {
                    console.error(`Error sending media ${i + 1}:`, err);
                }
            }

        } catch (err) {
            console.error('Instagram Downloader Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal mengambil media: ${err.message}`,
                edit: loadingMsg.key
            });
        }
    }
};