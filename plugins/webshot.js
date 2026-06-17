import { fetchBuffer } from '@/lib/scraping.js';

export default {
    premiumOnly: true,
    description: 'Mengambil tangkapan layar/screenshot dari halaman website.',
    usage: '<link web>',
    example: 'https://google.com',
    name: 'ss',
    aliases: ['screenshot', 'webshot', 'ssweb'],
    category: 'User',
    run: async (sock, msg, args, { sendTyping }) => {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Harap sertakan link website!\nContoh: *.ss https://example.com*'
            }, { quoted: msg });
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Link tidak valid. Gunakan link dengan http:// atau https://'
            }, { quoted: msg });
            return;
        }

        let delay = 3000; // default delay 3 seconds
        if (args[1] && !isNaN(args[1])) {
            const parsedDelay = parseInt(args[1], 10);
            if (parsedDelay >= 0 && parsedDelay <= 10000) {
                delay = parsedDelay;
            }
        }

        await sendTyping();
        await sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Sedang mengambil screenshot website (delay ${delay / 1000}s)...`
        }, { quoted: msg });

        try {
            const microUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&embed=screenshot.url&waitForTimeout=${delay}`;
            const buffer = await fetchBuffer(microUrl, { timeout: 40000 });
            await sock.sendMessage(msg.key.remoteJid, {
                image: buffer,
                caption: `📸 *Screenshot Website*\n🔗 ${url}\n⚡ Delay: ${delay / 1000}s\n⚡ _Via Palantir API_`
            }, { quoted: msg });
        } catch (err) {
            console.error('Screenshot Error:', err.message);
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Gagal mengambil screenshot. Coba lagi nanti atau link lain.'
            }, { quoted: msg });
        }
    }
};