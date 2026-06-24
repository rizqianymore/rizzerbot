import { db } from '@/lib/database.js';

export default {
    name: 'jagagrup',
    description: 'Mengaktifkan penjaga grup dari demote admin ilegal.',
    usage: '<on/off>',
    example: 'on',
    aliases: ['guard', 'protect'],
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
        if (option === 'on' || option === 'aktif' || option === '1') {
            db.updateGroup(remoteJid, { guard: true });
            await sock.sendMessage(remoteJid, { text: '✅ *Penjaga Grup (Group Guard) AKTIF!*\nBot akan otomatis melindungi posisi Admin Owner dari demote tidak sah.' }, { quoted: msg });
        } else if (option === 'off' || option === 'nonaktif' || option === '0') {
            db.updateGroup(remoteJid, { guard: false });
            await sock.sendMessage(remoteJid, { text: '🚫 *Penjaga Grup (Group Guard) NONAKTIF!*' }, { quoted: msg });
        } else {
            const groupConfig = db.getGroup(remoteJid);
            await sock.sendMessage(remoteJid, { text: `⚠️ Penggunaan: *.jagagrup on/off*\nStatus saat ini: *${groupConfig?.guard ? 'AKTIF' : 'NONAKTIF'}*` }, { quoted: msg });
        }
    }
};
