import { db } from '@/lib/database.js';

export default {
    name: 'group',
    description: 'Membuka atau menutup gerbang chat grup.',
    usage: '<open/close>',
    example: 'open',
    aliases: ['grup'],
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

            const botJid = sock.user.id.replace(/:.*@/, '@');
            const botParticipant = participants.find(p => p.id.replace(/:.*@/, '@') === botJid);
            const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
            if (!isBotAdmin) {
                await sock.sendMessage(remoteJid, { text: '⚠️ Bot harus menjadi admin grup terlebih dahulu!' }, { quoted: msg });
                return;
            }

            const option = args[0]?.toLowerCase();
            if (option === 'open' || option === 'buka') {
                await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                await sock.sendMessage(remoteJid, { text: '🔓 Setelan grup berhasil diubah: *Semua anggota sekarang dapat mengirim pesan!*' }, { quoted: msg });
            } else if (option === 'close' || option === 'tutup') {
                await sock.groupSettingUpdate(remoteJid, 'announcement');
                await sock.sendMessage(remoteJid, { text: '🔒 Setelan grup berhasil diubah: *Hanya admin yang dapat mengirim pesan!*' }, { quoted: msg });
            } else {
                await sock.sendMessage(remoteJid, { text: '⚠️ Penggunaan: *.group open* / *.group close*' }, { quoted: msg });
            }
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: '❌ Gagal mengubah setelan grup.' }, { quoted: msg });
        }
    }
};
