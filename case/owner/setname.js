export default {
    name: 'setname',
    description: 'Mengubah nama judul grup.',
    usage: '<nama baru>',
    example: 'Grup Keren',
    aliases: ['setgcupname', 'setgroupname'],
    category: 'Admin',
    run: async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: msg });
            return;
        }
        const newName = args.join(' ');
        if (!newName) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Harap masukkan nama grup yang baru!' }, { quoted: msg });
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

            await sock.groupUpdateSubject(remoteJid, newName);
            await sock.sendMessage(remoteJid, { text: `✅ Nama grup berhasil diubah menjadi: *${newName}*` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal mengubah nama grup: ${err.message}` }, { quoted: msg });
        }
    }
};
