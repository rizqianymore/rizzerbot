import { db } from '@/lib/database.js';

export default {
    name: 'resetdb',
    description: 'Mereset data seluruh statistik dan pengguna.',
    usage: '',
    example: '',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        db.data.users = {};
        db.data.stats = { totalCommands: 0, commands: {} };
        db.ensurePrivilegedUsers();
        db.save();
        await sock.sendMessage(msg.key.remoteJid, { text: '✅ Database statistik dan pengguna telah di-reset.' }, { quoted: msg });
    }
};
