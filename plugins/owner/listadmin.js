import { db } from '@/lib/database.js';

export default {
    name: 'listadmin',
    description: 'Menampilkan daftar seluruh admin bot saat ini.',
    usage: '',
    example: '',
    aliases: ['admins'],
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args) => {
        const admins = db.data.settings.admins || [];
        if (admins.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ Tidak ada admin bot tambahan yang terdaftar.' }, { quoted: msg });
            return;
        }

        const list = admins.map((jid, idx) => `${idx + 1}. @${jid.split('@')[0]}`).join('\n');
        await sock.sendMessage(msg.key.remoteJid, {
            text: `👥 *DAFTAR ADMIN BOT:*\n\n${list}`,
            mentions: admins
        }, { quoted: msg });
    }
};
