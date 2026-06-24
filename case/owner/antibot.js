import { db } from '@/lib/database.js';

export default {
    name: 'antibot',
    description: 'Mengaktifkan atau menonaktifkan fitur anti-bot spammer.',
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
            db.updateGroup(remoteJid, { antibot: true });
            await sock.sendMessage(remoteJid, { text: '✅ *Anti-Bot diaktifkan!* Bot lain yang mengirim pesan akan dikeluarkan otomatis.' }, { quoted: msg });
        } else if (option === 'off' || option === '0' || option === 'nonaktif') {
            db.updateGroup(remoteJid, { antibot: false });
            await sock.sendMessage(remoteJid, { text: '🚫 *Anti-Bot dinonaktifkan!*' }, { quoted: msg });
        } else {
            const groupConfig = db.getGroup(remoteJid);
            await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.antibot on/off*\nStatus saat ini: *${groupConfig?.antibot ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
        }
    }
};
