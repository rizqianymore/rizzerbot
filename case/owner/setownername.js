import { settings } from '@/config/settings.js';

export default {
    name: 'setownername',
    description: 'Mengubah nama owner bot.',
    usage: '<nama baru>',
    example: 'Pentagon Owner',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        const name = args.join(' ');
        if (!name) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan nama owner baru.' }, { quoted: msg });
            return;
        }
        settings.ownerName = name;
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Nama owner diubah menjadi: *${name}*` }, { quoted: msg });
    }
};
