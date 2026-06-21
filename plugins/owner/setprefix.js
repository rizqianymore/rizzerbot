import { db } from '@/lib/database.js';

export default {
    name: 'setprefix',
    description: 'Mengubah prefix/karakter pemicu perintah bot.',
    usage: '<prefix baru>',
    example: '#',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 3) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tentukan karakter prefix (1-3 karakter).' }, { quoted: msg });
            return;
        }
        db.data.settings.prefix = newPrefix;
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: `🎯 Prefix perintah bot berhasil diubah ke: "${newPrefix}"` }, { quoted: msg });
    }
};
