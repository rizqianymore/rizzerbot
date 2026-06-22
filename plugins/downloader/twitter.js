import axios from 'axios';
import { fetchBuffer } from '@/lib/scraping.js';

export default {
    premiumOnly: true,
    description: 'Mengunduh video/foto dari tautan postingan Twitter/X.',
    usage: '<link Twitter/X>',
    example: 'https://x.com/...',
    name: 'twitter',
    aliases: ['x', 'tw', 'twdl', 'xdl'],
    category: 'Downloader',
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link Twitter / X!\nContoh: *.twitter https://x.com/username/status/123456789'
            }, { quoted: msg });
            return;
        }

        if (!/x\.com|twitter\.com/i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid.'
            }, { quoted: msg });
            return;
        }

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '⏳ Sedang memproses download Twitter/X (HD Best)...' 
        }, { quoted: msg });

        let videoUrl = null;
        let successAPI = 'Kyros-MD API';

        try {
            
            const getRes = await axios.get('https://ssstwitter.com/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });

            const ttMatch = getRes.data.match(/tt:\s*['"]([^'"]+)['"]/);
            const tsMatch = getRes.data.match(/ts:\s*(\d+)/);
            const tt = ttMatch ? ttMatch[1] : null;
            const ts = tsMatch ? tsMatch[1] : null;

            const cookies = getRes.headers['set-cookie'] || [];
            const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

            if (!tt || !ts) {
                throw new Error('Gagal memuat token atau timestamp dari ssstwitter.');
            }

            
            const params = new URLSearchParams();
            params.append('id', url);
            params.append('locale', 'en');
            params.append('tt', tt);
            params.append('ts', ts);
            params.append('source', 'form');

            const postRes = await axios.post('https://ssstwitter.com/', params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'HX-Request': 'true',
                    'HX-Target': 'target',
                    'HX-Current-URL': 'https://ssstwitter.com/',
                    'Referer': 'https://ssstwitter.com/',
                    'Origin': 'https://ssstwitter.com',
                    'Cookie': cookieString,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400,
                timeout: 15000
            });

            const redirectUrl = postRes.headers.location;
            if (!redirectUrl) {
                throw new Error('Gagal mendapatkan url pengalihan hasil.');
            }

            const targetGetUrl = redirectUrl.startsWith('http') ? redirectUrl : 'https://ssstwitter.com' + redirectUrl;

            
            const postCookies = postRes.headers['set-cookie'] || [];
            const combinedCookies = [...cookies, ...postCookies].map(c => c.split(';')[0]).join('; ');

            
            const resultRes = await axios.get(targetGetUrl, {
                headers: {
                    'Cookie': combinedCookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://ssstwitter.com/',
                    'HX-Request': 'true',
                    'HX-Target': 'target',
                    'HX-Current-URL': 'https://ssstwitter.com/'
                },
                timeout: 15000
            });

            const html = resultRes.data;

            
            let match;

            
            match = html.match(/data-directurl=["']([^"']+)["'][^>]*?quality-best/i);
            if (match && match[1]) {
                videoUrl = match[1];
            }

            
            if (!videoUrl) {
                match = html.match(/data-directurl=["']([^"']+)["']/i);
                if (match && match[1]) {
                    videoUrl = match[1];
                }
            }

            
            if (!videoUrl) {
                match = html.match(/href=["'](https:\/\/ssscdn\.io\/ssstwitter\/[^"']+)["']/i);
                if (match && match[1]) {
                    videoUrl = match[1];
                }
            }

        } catch (err) {
            console.error('SSSTwitter Error:', err.message);
        }

        if (!videoUrl) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal mendapatkan link video HD. Coba lagi nanti.'
            }, { quoted: msg });
            return;
        }

        try {
            const videoBuffer = await fetchBuffer(videoUrl);

            await sock.sendMessage(msg.key.remoteJid, {
                video: videoBuffer,
                caption: `📥 *Twitter/X Downloader*\n⚡ _Via ${successAPI}_`
            }, { quoted: msg });

        } catch (err) {
            console.error('Download/Send Error:', err);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Gagal mengirim video: ${err.message}`
            }, { quoted: msg });
        }
    }
};