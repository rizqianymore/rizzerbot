export default {
    name: 'unblock',
    description: 'Membuka blokir kontak WhatsApp.',
    usage: '<@tag/reply/nomor>',
    example: '@user',
    category: 'Owner',
    ownerOnly: true,
    run: async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
            await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Harap tag, balas pesan, atau masukkan nomor telepon.' }, { quoted: msg });
            return;
        }
        await sock.updateBlockStatus(target, 'unblock');
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Berhasil membuka blokir @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
    }
};
