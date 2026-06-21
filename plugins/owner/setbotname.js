import { settings } from '@/config/settings.js';

export default {
    name: 'setbotname',
    description: 'Mengubah konfigurasi nama bot.',
    usage: '<nama baru>',
    example: 'Kyros-MD V2',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        const name = args.join(' ');
        if (!name) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nama bot baru.' }, { quoted: msg });
            return;
        }
        settings.botName = name;
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Nama bot diubah menjadi: *${name}*` }, { quoted: msg });
    }
};
