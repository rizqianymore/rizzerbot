export default {
    name: 'revoke',
    description: 'Mereset atau menarik kembali tautan undangan grup.',
    usage: '',
    example: '',
    aliases: ['resetlink', 'resetgclink'],
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

            const code = await sock.groupRevokeInvite(remoteJid);
            await sock.sendMessage(remoteJid, { text: `🔄 Link undangan grup berhasil di-reset.\n\n*Link Baru:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(remoteJid, { text: `❌ Gagal me-reset link grup: ${err.message}` }, { quoted: msg });
        }
    }
};
