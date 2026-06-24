import { db } from '@/lib/database.js';

export default {
    name: 'public',
    description: 'Mengubah bot ke mode umum (merespon semua user).',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        db.data.settings.selfMode = false;
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: `🔓 *Mode Umum:* AKTIF\nSemua pengguna dapat menggunakan bot.` }, { quoted: msg });
    }
};
