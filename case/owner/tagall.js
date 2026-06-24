export default {
    name: 'tagall',
    description: 'Mentag seluruh anggota grup secara terbuka.',
    usage: '<teks>',
    example: 'Ada apa',
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

            const messageText = args.join(' ') || 'Halo semua!';
            let tagText = `📢 *Tag All*\n\n*Pesan:* ${messageText}\n\n`;
            const targetJids = participants.map(p => p.id);
            targetJids.forEach((jid, idx) => {
                tagText += `${idx + 1}. @${jid.split('@')[0]}\n`;
            });

            await sock.sendMessage(remoteJid, { text: tagText, mentions: targetJids }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: '❌ Gagal melakukan tagall.' }, { quoted: msg });
        }
    }
};
