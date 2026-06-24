import { db } from '@/lib/database.js';

export default {
    name: 'antilink',
    description: 'Mengaktifkan atau menonaktifkan fitur anti-link grup.',
    usage: '<on/off>',
    example: 'on',
    category: 'Admin',
    run: async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants || [];
            const sender = participants.find(p => p.id.replace(/:.*@/, '@') === senderJid.replace(/:.*@/, '@'));
            const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin' || isOwner;

            if (!isSenderAdmin) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!' }, { quoted: msg });
                return;
            }
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: '❌ Gagal memeriksa metadata grup.' }, { quoted: msg });
            return;
        }

        const option = args[0]?.toLowerCase();
        if (option === 'on' || option === '1' || option === 'aktif') {
            db.updateGroup(remoteJid, { antilink: true });
            await sock.sendMessage(remoteJid, { text: '✅ *Anti-Link diaktifkan!* Semua pesan berisi tautan/link dari non-admin akan dihapus otomatis.' }, { quoted: msg });
        } else if (option === 'off' || option === '0' || option === 'nonaktif') {
            db.updateGroup(remoteJid, { antilink: false });
            await sock.sendMessage(remoteJid, { text: '🚫 *Anti-Link dinonaktifkan!*' }, { quoted: msg });
        } else {
            const groupConfig = db.getGroup(remoteJid);
            await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.antilink on/off*\nStatus saat ini: *${groupConfig?.antilink ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
        }
    }
};
