export default {
    name: 'add',
    category: 'Admin',
    description: 'Menambahkan anggota baru ke dalam grup.',
    usage: '<nomor>',
    example: '628xxx',
    run: async (sock, msg, args, { isOwner, senderJid, sendUsage }) => {
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

            let targetNumber = args[0]?.replace(/[^0-9]/g, '');
            if (!targetNumber) {
                await sendUsage();
                return;
            }
            const target = targetNumber + '@s.whatsapp.net';

            await sock.groupParticipantsUpdate(remoteJid, [target], 'add');
            await sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan @${targetNumber}`, mentions: [target] }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: '❌ Gagal menambahkan anggota. Pastikan nomor valid atau setelan privasi mereka mengizinkan.' }, { quoted: msg });
        }
    }
};
