import { db } from '@/lib/database.js';

export default {
    name: 'self',
    description: 'Mengubah bot ke mode mandiri (hanya merespon owner).',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        db.data.settings.selfMode = true;
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: `👤 *Mode Mandiri:* AKTIF\nBot hanya menerima perintah dari Owner.` }, { quoted: msg });
    }
};
