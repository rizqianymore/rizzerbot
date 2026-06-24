export default {
    name: 'listbot',
    description: 'Menampilkan daftar seluruh bot klon yang aktif.',
    usage: '',
    example: '',
    aliases: ['listbots'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        try {
            const { runningBots } = await import('@/index.js');
            if (runningBots.size === 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ Tidak ada bot sekunder yang sedang berjalan.' }, { quoted: msg });
                return;
            }
            let listText = `🤖 *Daftar bot sekunder aktif (${runningBots.size}):*\n\n`;
            let idx = 1;
            for (const key of runningBots.keys()) {
                const phoneNumber = key.replace('session_', '');
                listText += `${idx++}. @${phoneNumber} (Aktif & Terhubung)\n`;
            }
            await sock.sendMessage(msg.key.remoteJid, {
                text: listText,
                mentions: Array.from(runningBots.keys()).map(k => k.replace('session_', '') + '@s.whatsapp.net')
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal mengambil daftar bot: ${err.message}` }, { quoted: msg });
        }
    }
};
