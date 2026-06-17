import { fetchBuffer, postForm } from '@/lib/scraping.js';

// Helper decoding functions for SnapInsta packer
function _0xe0c(d, e, f) {
    const _0xc0e = ["", "split", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/", "slice", "indexOf", "", "", ".", "pow", "reduce", "reverse", "0"];
    var g = _0xc0e[2][_0xc0e[1]](_0xc0e[0]);
    var h = g[_0xc0e[3]](0, e);
    var i = g[_0xc0e[3]](0, f);
    var j = d[_0xc0e[1]](_0xc0e[0])[_0xc0e[10]]()[_0xc0e[9]](function (a, b, c) {
        if (h[_0xc0e[4]](b) !== -1)
            return a += h[_0xc0e[4]](b) * (Math[_0xc0e[8]](e, c));
    }, 0);
    var k = _0xc0e[0];
    while (j > 0) {
        k = i[j % f] + k;
        j = (j - (j % f)) / f;
    }
    return k || _0xc0e[11];
}

function snapDecode(h, u, n, t, e, r) {
    r = "";
    for (var i = 0, len = h.length; i < len; i++) {
        var s = "";
        while (h[i] !== n[e]) {
            s += h[i];
            i++;
        }
        for (var j = 0; j < n.length; j++) {
            s = s.replace(new RegExp(n[j], "g"), j);
        }
        r += String.fromCharCode(_0xe0c(s, e, 10) - t);
    }
    return decodeURIComponent(r);
}

function decryptSnapInsta(data) {
    const match = data.match(/\}\("([^"]+)",\s*(\d+),\s*(\[[^\]]+\]),\s*(\d+),\s*(\d+),\s*(\d+)\)\)/);
    if (!match) return null;
    
    const h = match[1];
    const u = parseInt(match[2]);
    const n = JSON.parse(match[3]);
    const t = parseInt(match[4]);
    const e = parseInt(match[5]);
    const r = parseInt(match[6]);
    
    return snapDecode(h, u, n, t, e, r);
}

export default {
    description: 'Mengunduh media (post/reel/story) dari link Instagram.',
    usage: '<link Instagram>',
    example: 'https://www.instagram.com/p/...',
    name: 'instagram',
    aliases: ['ig', 'igdl', 'instagramdl'],
    category: 'User',
    cooldown: 8000,
    premiumOnly: true,
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
            text: '⏳ Sedang memproses download Instagram via SnapInsta...' 
        }, { quoted: msg });

        let mediaItems = []; // Array of { url: string, isVideo: boolean }

        try {
            // Call snapinsta.to/api/ajaxSearch using postForm to bypass Cloudflare challenge fingerprint checks
            const res = await postForm('https://snapinsta.to/api/ajaxSearch', {
                q: url,
                t: 'media',
                v: 'v2',
                lang: 'en'
            }, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://snapinsta.to',
                    'Referer': 'https://snapinsta.to/en2'
                }
            });

            if (res.status !== 200 || !res.data) {
                throw new Error(`Server response error (HTTP ${res.status})`);
            }

            const resData = res.data;
            if (resData.status !== 'ok') {
                throw new Error(resData.message || 'Gagal memproses link di SnapInsta.');
            }

            let htmlContent = '';
            if (resData.v === 'v1') {
                htmlContent = resData.data;
            } else if (resData.v === 'v2') {
                // Decrypt the packed JavaScript to get the HTML content
                htmlContent = decryptSnapInsta(resData.data);
                if (!htmlContent) {
                    throw new Error('Gagal mendeskripsi data respon.');
                }
            } else {
                htmlContent = resData.data;
            }

            // Extract download links and media types from HTML content
            const blocks = htmlContent.split('class="download-items"');
            for (let i = 1; i < blocks.length; i++) {
                const block = blocks[i];
                const hrefMatch = block.match(/href="([^"]+)"[^>]*class="[^"]*abutton/i);
                if (hrefMatch) {
                    const mediaUrl = hrefMatch[1];
                    const isVideo = /download\s*video/i.test(block) || /icon-dlvideo/i.test(block);
                    mediaItems.push({
                        url: mediaUrl,
                        isVideo
                    });
                }
            }

        } catch (err) {
            console.error('SnapInsta API Error:', err.message);
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

        // Send all media items
        try {
            for (const item of mediaItems) {
                const buffer = await fetchBuffer(item.url);
                if (item.isVideo) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        video: buffer,
                        caption: `📥 *Instagram Downloader*\n⚡ _Via SnapInsta_`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, {
                        image: buffer,
                        caption: `📥 *Instagram Downloader*\n⚡ _Via SnapInsta_`
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