import { db } from '@/lib/database.js';

export default {
    name: 'tutupdaftar',
    description: 'Menutup pendaftaran pengguna baru.',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        db.data.settings.registrationOpen = false;
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: '📴 Pendaftaran pengguna baru berhasil *DITUTUP*.' }, { quoted: msg });
    }
};
