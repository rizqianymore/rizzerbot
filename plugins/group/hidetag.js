export default {
    name: 'hidetag',
    description: 'Mentag seluruh anggota grup secara senyap.',
    usage: '<teks>',
    example: 'Pengumuman',
    aliases: ['ht'],
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

            const targetJids = participants.map(p => p.id);
            const text = args.join(' ') || '';
            await sock.sendMessage(remoteJid, { text, mentions: targetJids });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: '❌ Gagal mengirim hidetag.' }, { quoted: msg });
        }
    }
};
