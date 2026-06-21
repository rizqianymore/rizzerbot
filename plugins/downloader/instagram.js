import { fetchBuffer } from '@/lib/scraping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export default {
    description: 'Mengunduh media dari link post Instagram dengan delay aman.',
    usage: '<link post Instagram> [opsional: nomor slide]',
    example: 'https://www.instagram.com/p/... 1,3',
    name: 'instagram',
    aliases: ['ig', 'igdl', 'instagramdl'],
    category: 'Downloader',
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

        const loadingMsg = await sock.sendMessage(msg.key.remoteJid, {
            text: '⏳ Sedang memproses... Mohon tunggu sebentar.'
        }, { quoted: msg });

        let mediaItems = [];

        try {
            const apiUrl = 'https://api-wh.fastdl.app/api/convert';

            const formData = new URLSearchParams();
            formData.append('sf_url', url);
            formData.append('ts', Date.now().toString());

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
                    'Origin': 'https://fastdl.app',
                    'Referer': 'https://fastdl.app/'
                },
                body: formData.toString()
            });

            if (!response.ok) throw new Error('Gagal menghubungi server downloader.');

            const result = await response.json();

            if (!Array.isArray(result) || result.length === 0) {
                throw new Error('Media tidak ditemukan atau akun diprivat.');
            }

            for (const item of result) {
                if (item.url && Array.isArray(item.url) && item.url.length > 0) {
                    const downloadUrl = item.url[0].url;
                    const type = item.url[0].type || 'jpg';

                    mediaItems.push({
                        url: downloadUrl,
                        type: type.includes('mp4') || type.includes('video') ? 'video' : 'image',
                        filename: item.url[0].filename || 'media'
                    });
                }
            }

            if (mediaItems.length === 0) {
                throw new Error('Tidak ada media yang bisa diunduh.');
            }

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
                        text: `✅ Ditemukan ${totalSlides} media. Mengunduh semuanya...\n💡 _Tips: Tambahkan angka di belakang link (ex: .ig link 1,3) untuk memilih._`,
                        edit: loadingMsg.key
                    });
                }
            }

            for (let i = 0; i < finalMedia.length; i++) {
                const item = finalMedia[i];

                try {
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

                    if (i < finalMedia.length - 1) {
                        const delayTime = randomInt(3000, 5000);
                        await delay(delayTime);
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