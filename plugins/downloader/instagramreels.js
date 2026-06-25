import { fetchBuffer } from '@/lib/scraping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export default {
    description: 'Downloader Instagram Reels & Post.',
    usage: '<link Reels/Post>',
    example: '.reels https://www.instagram.com/reel/C8XyZ9yyXyz/\n.reels https://www.instagram.com/p/xyz/',
    name: 'reels',
    aliases: ['igreels', 'instagramreels', 'igpost'],
    category: 'Downloader',
    cooldown: 5000,
    premiumOnly: true,
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];

        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link Instagram!\nContoh:\n• *.reels https://www.instagram.com/reel/...*\n• *.reels https://www.instagram.com/p/...*'
            }, { quoted: msg });
            return;
        }

        if (!/instagram\.com\/(p|reel|reels)\//i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: '⏳ Sedang memproses... Mohon tunggu.'
        }, { quoted: msg });

        try {
            // Generate timestamp
            const ts = Date.now();
            const _ts = 1781691802136;
            const _tsc = 0;
            const _sv = 2;

            // Signature perlu diextract dari halaman fastdl.app atau hardcoded sementara
            // Untuk production, sebaiknya fetch halaman dulu untuk dapat signature yang valid
            const _s = '53ae2b37332ef6e65b1cf501cac8bec465bb215467524f710b66d9b4cfbe03e7';

            const formData = new URLSearchParams();
            formData.append('sf_url', url);
            formData.append('ts', ts.toString());
            formData.append('_ts', _ts.toString());
            formData.append('_tsc', _tsc.toString());
            formData.append('_sv', _sv.toString());
            formData.append('_s', _s);

            const response = await fetch('https://api-wh.fastdl.app/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://fastdl.app',
                    'Referer': 'https://fastdl.app/',
                    'Accept': 'application/json, text/plain, */*'
                },
                body: formData.toString()
            });

            if (!response.ok) throw new Error('Gagal menghubungi server.');

            const result = await response.json();

            let mediaItems = [];

            // Parse response fastdl.app
            if (result.medias && Array.isArray(result.medias)) {
                for (const media of result.medias) {
                    if (media.url || media.url_downloadable) {
                        // Prioritaskan url_downloadable jika ada (lebih stabil)
                        const downloadUrl = media.url_downloadable || media.url;
                        mediaItems.push({
                            url: downloadUrl,
                            type: media.ext === 'mp4' ? 'video' : 'image',
                            filename: media.filename || 'media'
                        });
                    }
                }
            } else if (result.url) {
                // Single media fallback
                mediaItems.push({
                    url: result.url_downloadable || result.url,
                    type: result.ext === 'mp4' ? 'video' : 'image',
                    filename: result.filename || 'media'
                });
            }

            if (mediaItems.length === 0) {
                throw new Error('Tidak ada media ditemukan.');
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

            // --- PENGIRIMAN DENGAN DELAY ---
            for (let i = 0; i < finalMedia.length; i++) {
                const item = finalMedia[i];

                try {
                    if (i > 0) {
                        const delayTime = randomInt(2000, 4000);
                        await delay(delayTime);
                    }

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

                } catch (err) {
                    console.error(`Error sending media ${i + 1}:`, err);
                }
            }

        } catch (err) {
            console.error('Instagram Downloader Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal: ${err.message}`,
                edit: loadingMsg.key
            });
        }
    }
};