export default {
    name: 'promote',
    category: 'Admin',
    description: 'Mempromosikan anggota grup menjadi admin.',
    usage: '<@tag/reply>',
    example: '@user',
    run: async (sock, msg, args, { isOwner, senderJid, getTargetJid, sendUsage }) => {
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

            const target = getTargetJid(args);
            if (!target) {
                await sendUsage();
                return;
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
            await sock.sendMessage(remoteJid, { text: `👑 @${target.split('@')[0]} sekarang adalah Admin Grup.`, mentions: [target] }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: '❌ Gagal mempromosikan anggota.' }, { quoted: msg });
        }
    }
};
