import { db } from '@/lib/database.js';

export default {
    name: 'bukadaftar',
    description: 'Membuka pendaftaran pengguna baru.',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        db.data.settings.registrationOpen = true;
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: '📲 Pendaftaran pengguna baru berhasil *DIBUKA*.' }, { quoted: msg });
    }
};
